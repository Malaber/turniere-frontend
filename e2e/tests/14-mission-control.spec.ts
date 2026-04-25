import { test, expect } from '@playwright/test';
import { injectAuth } from '../helpers/auth';
import { keyframe } from '../helpers/screenshot';
import { seedGroupStageTournament } from '../helpers/scenario-seeder';
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

  await page.getByTestId('mission-timer-countup').click();
  await expect(page.getByText(/countup/)).toBeVisible({ timeout: 15_000 });
  await keyframe(page, testInfo, 'mission_control_countup_timer');

  await page.getByLabel('Minuten').fill('2');
  await page.getByTestId('mission-timer-countdown-minutes').click();
  await expect(page.getByText(/countdown/)).toBeVisible({ timeout: 15_000 });
  await keyframe(page, testInfo, 'mission_control_countdown_timer');

  await page.getByRole('link', { name: 'Match-Starts' }).click();
  await page.getByTestId('mission-start-next-groups').click();
  await expectMatchStateCount(client, tournament.id, 'in_progress', 4);
  await expect(page.getByTestId('mission-match-card').filter({ hasText: 'in_progress' })).toHaveCount(4, {
    timeout: 20_000,
  });
  await keyframe(page, testInfo, 'mission_control_started_group_matches');

  await page.getByRole('link', { name: 'Ergebnisse' }).click();
  const activeCard = page
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
  await expect(page.getByTestId('mission-match-card').filter({ hasText: 'finished' }).first()).toBeVisible({
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

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Follower-Modus aktiv. Live-Aktionen sind gesperrt.')).toBeVisible();
  await expect(page.getByTestId('mission-start-next-groups')).toBeDisabled();
  await expect(page.getByTestId('mission-timer-countup')).toBeDisabled();
  await keyframe(page, testInfo, 'mission_control_read_only_lockout');
});
