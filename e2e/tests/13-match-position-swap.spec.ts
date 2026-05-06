import { test, expect, Page } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { ApiClient, expectStatus } from '../helpers/api-client';
import { keyframe } from '../helpers/screenshot';
import { seedGroupStageTournament } from '../helpers/scenario-seeder';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';

interface ApiMatch {
  id: number;
  position: number;
  match_scores?: Array<{
    team?: {
      name: string;
    };
  }>;
}

interface ApiGroupStageTournament {
  id: number;
  stages: Array<{
    level: number;
    groups: Array<{
      matches: ApiMatch[];
    }>;
  }>;
}

async function makeClient(): Promise<ApiClient> {
  const auth = loadAuthState();
  const client = new ApiClient(backendUrl);
  const login = await client.login(process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com',
    process.env.TURNIERE_E2E_PASSWORD ?? 'password123');
  expectStatus(login, 200, `login as ${auth.username}`);
  return client;
}

async function fetchFirstGroupMatches(client: ApiClient, tournamentId: number): Promise<ApiMatch[]> {
  const fetched = await client.get<ApiGroupStageTournament>(`/tournaments/${tournamentId}`);
  expectStatus(fetched, 200, `fetch tournament ${tournamentId} for match ordering`);
  const groupStage = fetched.json.stages.find((stage) => stage.level === -1);
  expect(groupStage).toBeTruthy();
  const firstGroup = groupStage?.groups[0];
  expect(firstGroup).toBeTruthy();
  return (firstGroup?.matches || []).slice().sort((a, b) => a.position - b.position);
}

function firstGroupSeedMatches(tournament: ApiGroupStageTournament): ApiMatch[] {
  const groupStage = tournament.stages.find((stage) => stage.level === -1);
  expect(groupStage).toBeTruthy();
  const firstGroup = groupStage?.groups[0];
  expect(firstGroup).toBeTruthy();
  return firstGroup?.matches || [];
}

function teamNames(match: ApiMatch): string[] {
  return (match.match_scores || []).map((score) => score.team?.name || '').filter(Boolean);
}

async function expandFirstGroup(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Matches einblenden' }).first().click();
}

async function openMissionMetadata(page: Page, tournamentId: number): Promise<void> {
  await page.goto(`/t/${tournamentId}/mission-control#metadata`);
  await expect(page.getByTestId('mission-metadata-control')).toBeVisible({ timeout: 20_000 });
}

function metadataCard(page: Page, names: string[]) {
  return page
    .locator('.tab-pane.active')
    .getByTestId('mission-metadata-card')
    .filter({ hasText: names[0] })
    .filter({ hasText: names[1] });
}

test('Owner cannot swap group match positions from general tournament view', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');
  await expandFirstGroup(page);

  await page.locator('[data-match-id]').first().click();
  await expect(page.getByTestId('swap-match-position-controls')).toHaveCount(0);
  await expect(page.locator('.match-modal-content')).toBeVisible();
  await expect(page.getByTestId('match-metadata-details')).toBeVisible();
  await keyframe(page, testInfo, 'swap_general_view_no_controls');
});

test('Owner can swap group match positions from Mission Control Match-Infos', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = await makeClient();
  const seedMatches = firstGroupSeedMatches(tournament);
  const before = await fetchFirstGroupMatches(client, tournament.id);
  const sourceMatch = before[0];
  const targetMatch = before[3];
  const sourceNames = teamNames(seedMatches.find((match) => match.id === sourceMatch.id) || seedMatches[0]);
  expect(sourceMatch).toBeTruthy();
  expect(targetMatch).toBeTruthy();
  expect(sourceNames.length).toBe(2);

  await openMissionMetadata(page, tournament.id);
  await page.locator('.tab-pane.active').getByTestId('mission-control-search').fill(sourceNames[0]);
  const sourceCard = metadataCard(page, sourceNames);
  await expect(sourceCard).toHaveCount(1);
  await expect(sourceCard).toHaveAttribute('data-match-id', String(sourceMatch.id));
  await expect(sourceCard.getByTestId('swap-match-position-controls')).toBeVisible();
  await expect(sourceCard.getByTestId('swap-match-position-select')).toHaveCount(0);
  await sourceCard.getByTestId('swap-match-position-toggle').click();
  await expect(sourceCard.getByTestId('swap-match-position-select')).toBeVisible();
  await sourceCard.getByTestId('swap-match-position-select').selectOption(String(targetMatch.id));
  await keyframe(page, testInfo, 'swap_mission_metadata_before_submit');

  await sourceCard.getByTestId('swap-match-position-button').click();
  await expect(page.getByText('Die Positionen wurden getauscht.')).toBeVisible();

  const after = await fetchFirstGroupMatches(client, tournament.id);
  const updatedSource = after.find((match) => match.id === sourceMatch.id);
  const updatedTarget = after.find((match) => match.id === targetMatch.id);
  expect(updatedSource?.position).toBe(targetMatch.position);
  expect(updatedTarget?.position).toBe(sourceMatch.position);
  await expect(sourceCard.getByRole('heading', { name: `Gruppe 1 · Spiel ${targetMatch.position}` })).toBeVisible({
    timeout: 20_000,
  });
  await keyframe(page, testInfo, 'swap_mission_metadata_done');
});

test('Read-only owner cannot swap from Mission Control Match-Infos', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const seedMatches = firstGroupSeedMatches(tournament);
  const sourceNames = teamNames(seedMatches[0]);
  const client = await makeClient();
  const updateReadOnly = await client.patch(`/tournaments/${tournament.id}`, { read_only_mode: true });
  expectStatus(updateReadOnly, 200, `enable read-only mode for tournament ${tournament.id}`);

  await openMissionMetadata(page, tournament.id);
  await page.locator('.tab-pane.active').getByTestId('mission-control-search').fill(sourceNames[0]);
  const sourceCard = metadataCard(page, sourceNames);
  await expect(sourceCard).toHaveCount(1);
  await expect(sourceCard.getByTestId('swap-match-position-controls')).toHaveCount(0);
  await keyframe(page, testInfo, 'swap_mission_read_only_no_controls');
});

test('Owner sees dedicated not-found error on swap target missing', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const seedMatches = firstGroupSeedMatches(tournament);
  const sourceNames = teamNames(seedMatches[0]);

  await openMissionMetadata(page, tournament.id);
  await page.locator('.tab-pane.active').getByTestId('mission-control-search').fill(sourceNames[0]);
  const sourceCard = metadataCard(page, sourceNames);
  await expect(sourceCard).toHaveCount(1);

  await expect(sourceCard.getByTestId('swap-match-position-controls')).toBeVisible();
  await expect(sourceCard.getByTestId('swap-match-position-select')).toHaveCount(0);
  await sourceCard.getByTestId('swap-match-position-toggle').click();
  await expect(sourceCard.getByTestId('swap-match-position-select')).toBeVisible();
  await keyframe(page, testInfo, 'swap_mission_not_found_before_submit');

  await page.route('**/matches/*/swap', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Match not found' }),
    });
  });

  await sourceCard.getByTestId('swap-match-position-button').click();
  await expect(page.getByText('Das Ziel-Match wurde nicht gefunden.')).toBeVisible();
  await keyframe(page, testInfo, 'swap_mission_not_found_error_toast');
});

test('Owner sees backend validation message for invalid swap', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const seedMatches = firstGroupSeedMatches(tournament);
  const sourceNames = teamNames(seedMatches[0]);
  const backendMessage = 'Matches must be different group matches from the same group';

  await openMissionMetadata(page, tournament.id);
  await page.locator('.tab-pane.active').getByTestId('mission-control-search').fill(sourceNames[0]);
  const sourceCard = metadataCard(page, sourceNames);
  await expect(sourceCard).toHaveCount(1);

  await expect(sourceCard.getByTestId('swap-match-position-controls')).toBeVisible();
  await expect(sourceCard.getByTestId('swap-match-position-select')).toHaveCount(0);
  await sourceCard.getByTestId('swap-match-position-toggle').click();
  await expect(sourceCard.getByTestId('swap-match-position-select')).toBeVisible();
  await keyframe(page, testInfo, 'swap_mission_422_before_submit');

  await page.route('**/matches/*/swap', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: backendMessage }),
    });
  });

  await sourceCard.getByTestId('swap-match-position-button').click();
  await expect(page.getByText(backendMessage)).toBeVisible();
  await keyframe(page, testInfo, 'swap_mission_422_error_toast');
});
