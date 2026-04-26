import { test, expect } from '@playwright/test';
import { injectAuth } from '../helpers/auth';
import { keyframe } from '../helpers/screenshot';
import { seedAndPlayGroupStage, seedGroupStageTournament } from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(180_000);

async function loggedInClient() {
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  return client;
}

async function expectMatchStateCount(
  client: ApiClient,
  tournamentId: number,
  state: string,
  expected: number,
) {
  await expect.poll(async () => {
    const matches = await client.get<Array<{ state: string }>>(
      `/tournaments/${tournamentId}/matches`,
      { state },
    );
    expectStatus(matches, 200, `fetch ${state} matches`);
    return matches.json.length;
  }, { timeout: 20_000 }).toBe(expected);
}

test('Owner runs live tournament operations from Mission Control', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(4, 4, 8);
  const client = await loggedInClient();

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ergebnisse' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Teams' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Turnier-Einstellungen' })).toBeVisible();
  await keyframe(page, testInfo, 'mission_control_open');

  await page.getByRole('link', { name: 'Match-Starts' }).click();
  const startsPane = page.locator('.tab-pane.active');
  await page.getByTestId('mission-start-next-groups').click();
  await expectMatchStateCount(client, tournament.id, 'in_progress', 4);
  await expect(startsPane.getByTestId('mission-match-card')).toHaveCount(0);
  await keyframe(page, testInfo, 'mission_control_bulk_start_only');

  await page.getByRole('link', { name: 'Ergebnisse' }).click();
  const scoresPane = page.locator('.tab-pane.active');
  await expect(scoresPane.getByTestId('mission-control-search')).toBeVisible();
  await scoresPane.getByTestId('mission-control-search').fill('gruppe 1');
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 1 6 Matches' })).toBeVisible();
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 2 0 Matches' })).toHaveCount(0);

  await scoresPane.getByTestId('mission-control-search').fill('G1-S1');
  const activeCard = scoresPane
    .getByTestId('mission-match-card')
    .filter({ hasText: 'G1-S1' })
    .filter({ hasText: 'G1-S2' });
  await expect(activeCard).toHaveCount(1);
  await activeCard.getByRole('spinbutton').nth(0).fill('7');
  await activeCard.getByRole('spinbutton').nth(1).fill('4');
  await activeCard.getByTestId('mission-match-save').click();
  await expectMatchStateCount(client, tournament.id, 'in_progress', 4);
  await expect(activeCard.getByRole('spinbutton').nth(0)).toHaveValue('7', {
    timeout: 20_000,
  });
  await expect(activeCard.getByRole('spinbutton').nth(1)).toHaveValue('4', {
    timeout: 20_000,
  });
  await keyframe(page, testInfo, 'mission_control_saved_live_score');

  await expect(activeCard.getByLabel('Live')).toBeVisible({ timeout: 20_000 });
  await expect(activeCard.getByLabel('Live')).toBeChecked();
  await activeCard.getByLabel('Live').uncheck();
  await activeCard.getByTestId('mission-match-save').click();
  await expectMatchStateCount(client, tournament.id, 'finished', 1);
  await expect(scoresPane.getByTestId('mission-match-card').filter({ hasText: 'finished' }).first()).toBeVisible({
    timeout: 20_000,
  });
  await keyframe(page, testInfo, 'mission_control_finished_match');

  await page.getByRole('link', { name: 'Teams' }).click();
  const teamsPane = page.locator('.tab-pane.active');
  await teamsPane.getByTestId('mission-control-search').fill('G1-S1');
  const renamed = `G1-S1 Mission ${Date.now()}`;
  const visibleTeamInput = teamsPane.locator('input.form-control').nth(1);
  await expect(visibleTeamInput).toHaveValue('G1-S1');
  await visibleTeamInput.fill(renamed);
  await teamsPane.getByTestId('mission-team-save').click();
  await expect(visibleTeamInput).toHaveValue(renamed, { timeout: 20_000 });
  await keyframe(page, testInfo, 'mission_control_renamed_team');

  const teams = await client.get<{ teams: Array<{ id: number; name: string }> }>(`/tournaments/${tournament.id}`);
  expectStatus(teams, 200, 'fetch tournament after team rename');
  expect(teams.json.teams.some((team) => team.name === renamed)).toBe(true);
});

test('Mission Control saves independent beamer display controls instantly', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const main = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Main stage',
    display_state: 'between_games',
  });
  expectStatus(main, 201, 'create main stage beamer');
  const side = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Side wall',
    display_state: 'groups',
  });
  expectStatus(side, 201, 'create side wall beamer');

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Beamer' }).click();

  await expect(page.getByTestId('mission-beamer-control')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aktualisieren' })).toHaveCount(0);
  await expect(page.getByText('Main stage')).toBeVisible();
  await expect(page.getByText('Side wall')).toBeVisible();
  await expect(page.getByTestId(`mission-beamer-mode-${main.json.id}`)).toHaveValue('between_games');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toBeVisible();
  await expect(page.getByTestId(`mission-beamer-mode-${side.json.id}`)).toHaveValue('groups');
  await expect(page.getByTestId(`mission-beamer-match-${side.json.id}`)).toHaveCount(0);
  await keyframe(page, testInfo, 'beamer_control_tur37');

  await page.getByTestId(`mission-beamer-mode-${main.json.id}`).selectOption('during_game');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; display_state: string }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after mode update');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.display_state;
  }, { timeout: 20_000 }).toBe('during_game');
  await expect(page.getByTestId(`mission-beamer-mode-${side.json.id}`)).toHaveValue('groups');

  await page.getByTestId(`mission-beamer-match-${main.json.id}`).selectOption('state:in_progress');
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; qr_code_url?: string | null }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after match selection');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.qr_code_url;
  }, { timeout: 20_000 }).toBe('state:in_progress');

  await page.getByTestId(`mission-beamer-mode-${main.json.id}`).selectOption('static_image');
  await expect(page.getByTestId(`mission-beamer-image-${main.json.id}`)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(`mission-beamer-image-${main.json.id}`).selectOption('/static/images/bpwstr_logo.png');
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; logo_url?: string | null }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after image selection');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.logo_url;
  }, { timeout: 20_000 }).toBe('/static/images/bpwstr_logo.png');
});

test('Mission Control mockup panes cover timer, beamer, and playoff match routing', async ({
  context,
  page,
}, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);
  const client = await loggedInClient();

  const leftStage = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'Left stage',
    display_state: 'matches_upcoming',
  });
  expectStatus(leftStage, 201, 'create left stage beamer');
  const backside = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'Backside',
    display_state: 'matches_finished',
  });
  expectStatus(backside, 201, 'create backside beamer');

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-timer-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Countdown starten' })).toBeVisible();
  await expect(page.getByTestId('mission-timer-quick-20')).toContainText('20:00');
  await expect(page.getByTestId('mission-timer-quick-15s')).toContainText('00:15');
  await expect(page.getByRole('heading', { name: 'Countup starten' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timer verwalten' })).toBeVisible();
  await keyframe(page, testInfo, 'timer_control_mockup');

  await page.getByRole('link', { name: 'Beamer' }).click();
  await expect(page.getByTestId('mission-beamer-control')).toBeVisible();
  await expect(page.getByText('Left stage')).toBeVisible();
  await expect(page.getByText('Backside')).toBeVisible();
  await keyframe(page, testInfo, 'beamer_control_mockup');

  await page.getByTestId('mission-beamer-name').fill('Main hall');
  await page.getByTestId('mission-beamer-create').click();
  await expect(page.getByText('Main hall')).toBeVisible({ timeout: 20_000 });
  const beamers = await client.get<Array<{ id: number; name: string; display_state: string }>>(
    `/tournaments/${tournament.id}/beamers`,
  );
  expectStatus(beamers, 200, 'fetch beamers after create');
  const created = beamers.json.find((beamer) => beamer.name === 'Main hall');
  expect(created).toBeTruthy();

  await page.getByTestId(`mission-beamer-mode-${created!.id}`).selectOption('during_game');
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; name: string; display_state: string }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after update');
    return updated.json.find((beamer) => beamer.id === created!.id)?.display_state;
  }, { timeout: 20_000 }).toBe('during_game');

  await page.getByRole('link', { name: 'Match-Starts' }).click();
  const startsPane = page.locator('.tab-pane.active');
  await expect(startsPane.getByTestId('mission-match-control')).toBeVisible();
  await expect(startsPane.getByRole('heading', { name: 'Bulk Match-Starts' })).toBeVisible();
  await expect(startsPane.getByRole('button', { name: 'Viertelfinale starten' })).toBeVisible();
  await expect(startsPane.getByTestId('mission-match-card')).toHaveCount(0);
  await keyframe(page, testInfo, 'match_starts_bulk_only');

  await page.getByRole('link', { name: 'Ergebnisse' }).click();
  const scoresPane = page.locator('.tab-pane.active');
  await expect(scoresPane.getByTestId('mission-score-control')).toBeVisible();
  await expect(scoresPane.getByPlaceholder('Gruppen, Teams, Matches suchen...')).toBeVisible();
  await scoresPane.getByTestId('mission-control-search').fill('Viertelfinale');
  await expect(scoresPane.getByRole('heading', { name: 'Viertelfinale 4 Matches' })).toBeVisible();
  await expect(scoresPane.getByText('Tisch 3 -> Tisch 2')).toBeVisible();
  await expect(scoresPane.getByText('Tisch 4 -> Tisch 2')).toBeVisible();
  await expect(scoresPane.getByText('Tisch 1 -> Tisch 1').first()).toBeVisible();
  await keyframe(page, testInfo, 'scores_wide_match_control');

  await scoresPane.getByTestId('mission-control-search').fill('G3-S1');
  await expect(scoresPane.getByTestId('mission-match-card').filter({ hasText: 'G3-S1' }).first()).toBeVisible();
  await expect(scoresPane.getByTestId('mission-match-card').filter({ hasText: 'G4-S1' })).toHaveCount(0);
});

test('Mission Control hidden for anonymous viewers', async ({ page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(2, 4, 4);

  await page.goto(`/t/${tournament.id}`);
  await expect(page.getByTestId('mission-control')).toHaveCount(0);
  await keyframe(page, testInfo, 'mission_control_hidden_for_viewer');
});

test('Mission Control shows read-only lockout for owner', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const updated = await client.patch(`/tournaments/${tournament.id}`, { read_only_mode: true });
  expectStatus(updated, 200, 'enable read-only mode');
  test.skip(
    (updated.json as { read_only_mode?: boolean }).read_only_mode !== true,
    'Backend image does not expose read_only_mode in tournament payload.',
  );

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Follower-Modus aktiv. Live-Aktionen sind gesperrt.')).toBeVisible();
  await expect(page.getByTestId('mission-start-next-groups')).toBeDisabled();
  await expect(page.getByTestId('mission-timer-countup')).toBeDisabled();
  await keyframe(page, testInfo, 'mission_control_read_only_lockout');
});
