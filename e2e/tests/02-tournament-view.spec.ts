import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import {
  seedGroupStageTournament,
  seedAndPlayGroupStage,
  seedGroupStageAndRunToBeforeFinal,
} from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(600_000);

test('Public tournament view renders group-stage and playoff data', async ({ page }, testInfo) => {
  // --- Seed: create group-stage tournament (4 groups × 4 teams, 8 playoff spots) ---
  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  // --- Step 1: fresh tournament page ---
  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.big-image')).toBeVisible({ timeout: 120000 });

  await keyframe(page, testInfo, 'tournament_created');

  // Tournament name appears in the big-image header
  await expect(page.locator('.big-image')).toBeVisible();

  // Group stage section contains 4 groups (h3/h4 headings with "Gruppe")
  const groupHeaders = page.getByText(/Gruppe/i);
  await expect(groupHeaders.first()).toBeVisible();

  // --- Step 2: play group matches + finish group stage via API ---
  const { tournament: t2 } = await seedAndPlayGroupStage(4, 4, 8);

  await page.goto(`/t/${t2.id}`);
  await expect(page.locator('.stages').first()).toBeVisible({ timeout: 120000 });

  await keyframe(page, testInfo, 'tournament_groups_finished');

  // Group tables should show scores after group stage is finished
  // The playoff section should also be visible
  await expect(page.locator('.stages').first()).toBeVisible();

  // --- Step 3: play up to before final ---
  const { tournament: t3 } = await seedGroupStageAndRunToBeforeFinal(4, 4, 8);

  await page.goto(`/t/${t3.id}`);
  const statusBarActions = page.locator('.me-auto.btn-group');
  const statisticsAction = statusBarActions.getByRole('button', { name: 'Statistiken' });
  const fullscreenAction = statusBarActions.getByRole('button', { name: 'Vollbild-Ansicht' });
  await expect(statisticsAction).toBeVisible({ timeout: 120000 });
  await expect(fullscreenAction).toBeVisible({ timeout: 120000 });

  await keyframe(page, testInfo, 'tournament_before_final');

  await expect(statisticsAction).toBeVisible();
  await expect(fullscreenAction).toBeVisible();
});

test('Tournament view receives live tournament snapshots', async ({ page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const matchesRes = await client.get<Array<{
    id: number;
    state: string;
    match_scores: Array<{ id: number; team: { id: number; name: string } | null }>;
  }>>(`/tournaments/${tournament.id}/matches`);
  expectStatus(matchesRes, 200, 'fetch tournament matches');
  const match = matchesRes.json.find((candidate) =>
    candidate.state === 'not_started' && candidate.match_scores.length === 2
  );
  expect(match).toBeTruthy();

  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.big-image')).toBeVisible({ timeout: 120000 });
  await page.getByTitle('Matches einblenden').first().click();

  const matchCard = page.locator(`[data-match-id="${match!.id}"]`);
  await expect(matchCard).toBeVisible({ timeout: 15_000 });
  await expect(matchCard).toContainText('0');
  await keyframe(page, testInfo, 'live_tournament_initial');

  const started = await client.patch(`/matches/${match!.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start match for live tournament view');
  await expect(page.getByText('Spiel läuft').first()).toBeVisible({ timeout: 10_000 });

  const firstScore = await client.patch(`/match_scores/${match!.match_scores[0].id}`, { points: 7 });
  expectStatus(firstScore, 200, 'update first score for live tournament view');
  const secondScore = await client.patch(`/match_scores/${match!.match_scores[1].id}`, { points: 3 });
  expectStatus(secondScore, 200, 'update second score for live tournament view');
  await expect(matchCard.locator('th').first()).toHaveText('7', { timeout: 10_000 });
  await expect(matchCard.locator('th').nth(1)).toHaveText('3', { timeout: 10_000 });
  await keyframe(page, testInfo, 'live_tournament_scores');

  const finished = await client.patch(`/matches/${match!.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish match for live tournament view');
  await expect(page.getByText(new RegExp(`Gewinner: ${match!.match_scores[0].team!.name}`))).toBeVisible({
    timeout: 10_000,
  });
  await keyframe(page, testInfo, 'live_tournament_finished');
});
