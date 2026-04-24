import { test, expect, BrowserContext, Page } from '@playwright/test';
import { injectAuth, injectAuthState, loadAuthState } from '../helpers/auth';
import { ApiClient, expectStatus } from '../helpers/api-client';
import { keyframe, modalKeyframe } from '../helpers/screenshot';
import { seedGroupStageTournament } from '../helpers/scenario-seeder';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';

interface ApiMatch {
  id: number;
  position: number;
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

async function injectNonOwnerAuth(context: BrowserContext): Promise<void> {
  const client = new ApiClient(backendUrl);
  const login = await client.login(process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com',
    process.env.TURNIERE_E2E_PASSWORD ?? 'password123');
  expectStatus(login, 200, 'fresh login for non-owner swap test');
  await injectAuthState(context, {
    username: `${login.json.username ?? 'e2e-user'}-not-owner`,
    accesstoken: login.headers['access-token'],
    client: login.headers.client,
    expiry: login.headers.expiry ?? '',
    uid: login.headers.uid,
  });
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

async function expandFirstGroup(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Matches einblenden' }).first().click();
}

test('Owner can swap group match positions and backend persists new order', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = await makeClient();
  const before = await fetchFirstGroupMatches(client, tournament.id);
  const sourceMatch = before[0];
  const targetMatch = before[3];
  expect(sourceMatch).toBeTruthy();
  expect(targetMatch).toBeTruthy();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');
  await expandFirstGroup(page);
  await keyframe(page, testInfo, 'swap_group_expanded');

  const sourceCard = page.locator(`[data-match-id="${sourceMatch.id}"]`);
  const targetCard = page.locator(`[data-match-id="${targetMatch.id}"]`);
  await expect(sourceCard).toContainText(`Sp. ${sourceMatch.position + 1}`);
  await expect(targetCard).toContainText(`Sp. ${targetMatch.position + 1}`);

  await sourceCard.click();
  await expect(page.getByTestId('swap-match-position-controls')).toBeVisible();
  await expect(page.getByTestId('swap-match-position-select')).toHaveCount(0);
  await page.getByTestId('swap-match-position-toggle').click();
  await expect(page.getByTestId('swap-match-position-select')).toBeVisible();
  await page.getByTestId('swap-match-position-select').selectOption(String(targetMatch.id));
  await modalKeyframe(page, testInfo, 'swap_modal_before_submit');

  await page.getByTestId('swap-match-position-button').click();
  await expect(page.getByText('Die Positionen wurden getauscht.')).toBeVisible();
  await expect(sourceCard).toContainText(`Sp. ${targetMatch.position + 1}`);
  await expect(targetCard).toContainText(`Sp. ${sourceMatch.position + 1}`);
  await keyframe(page, testInfo, 'swap_done_updated_positions');

  const after = await fetchFirstGroupMatches(client, tournament.id);
  const updatedSource = after.find((match) => match.id === sourceMatch.id);
  const updatedTarget = after.find((match) => match.id === targetMatch.id);
  expect(updatedSource?.position).toBe(targetMatch.position);
  expect(updatedTarget?.position).toBe(sourceMatch.position);
});

test('Non-owner cannot open swap UI in match modal', async ({ context, page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  await injectNonOwnerAuth(context);

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');
  await expandFirstGroup(page);

  await page.locator('[data-match-id]').first().click();
  await expect(page.getByTestId('swap-match-position-controls')).toHaveCount(0);
  await expect(page.locator('.match-modal-content')).toHaveCount(0);
  await keyframe(page, testInfo, 'swap_non_owner_no_controls');
});

test('Read-only owner cannot open swap UI in match modal', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = await makeClient();
  const updateReadOnly = await client.patch(`/tournaments/${tournament.id}`, { read_only_mode: true });
  expectStatus(updateReadOnly, 200, `enable read-only mode for tournament ${tournament.id}`);

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');
  await expandFirstGroup(page);

  await page.locator('[data-match-id]').first().click();
  await expect(page.getByTestId('swap-match-position-controls')).toHaveCount(0);
  await expect(page.locator('.match-modal-content')).toHaveCount(0);
  await keyframe(page, testInfo, 'swap_read_only_no_controls');
});

test('Owner sees dedicated not-found error on swap target missing', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');
  await expandFirstGroup(page);
  await page.locator('[data-match-id]').first().click();

  await expect(page.getByTestId('swap-match-position-controls')).toBeVisible();
  await expect(page.getByTestId('swap-match-position-select')).toHaveCount(0);
  await page.getByTestId('swap-match-position-toggle').click();
  await expect(page.getByTestId('swap-match-position-select')).toBeVisible();
  await modalKeyframe(page, testInfo, 'swap_modal_not_found_before_submit');

  await page.route('**/matches/*/swap', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Match not found' }),
    });
  });

  await page.getByTestId('swap-match-position-button').click();
  await expect(page.getByText('Das Ziel-Match wurde nicht gefunden.')).toBeVisible();
  await keyframe(page, testInfo, 'swap_not_found_error_toast');
});

test('Owner sees backend validation message for invalid swap', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const backendMessage = 'Matches must be different group matches from the same group';

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');
  await expandFirstGroup(page);
  await page.locator('[data-match-id]').first().click();

  await expect(page.getByTestId('swap-match-position-controls')).toBeVisible();
  await expect(page.getByTestId('swap-match-position-select')).toHaveCount(0);
  await page.getByTestId('swap-match-position-toggle').click();
  await expect(page.getByTestId('swap-match-position-select')).toBeVisible();
  await modalKeyframe(page, testInfo, 'swap_modal_422_before_submit');

  await page.route('**/matches/*/swap', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: backendMessage }),
    });
  });

  await page.getByTestId('swap-match-position-button').click();
  await expect(page.getByText(backendMessage)).toBeVisible();
  await keyframe(page, testInfo, 'swap_422_error_toast');
});
