import { test, expect, type Locator } from '@playwright/test';
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

async function scrollToLocator(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.page().waitForTimeout(250);
}

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

  const finalHeading = page.getByRole('heading', { name: 'Finale', exact: true });
  const thirdPlaceHeading = page.getByRole('heading', { name: 'Spiel um Platz 3', exact: true });
  await expect(finalHeading).toBeVisible();
  await expect(thirdPlaceHeading).toBeVisible();
  await scrollToLocator(finalHeading);
  await keyframe(page, testInfo, 'tournament_final_match');
  await scrollToLocator(thirdPlaceHeading);
  await keyframe(page, testInfo, 'tournament_third_place_match');
});

test('Tournament match cards render all visible states as solid cards', async ({ page }, testInfo) => {
  const { tournament } = await seedAndPlayGroupStage(2, 4, 4);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.stages').first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByText('Spiel kann gestartet werden').first()).toBeVisible();
  await expect(page.getByText('Spiel kann noch nicht gestartet werden').first()).toBeVisible();
  await scrollToLocator(page.locator('.match').first());
  await keyframe(page, testInfo, 'match_cards_not_started_and_not_ready');

  const matchesRes = await client.get<Array<{
    id: number;
    state: string;
    position: number;
    match_scores: Array<{ id: number; team: { id: number; name: string } | null }>;
  }>>(`/tournaments/${tournament.id}/matches`);
  expectStatus(matchesRes, 200, 'fetch tournament matches for state screenshots');

  const playable = matchesRes.json
    .filter((match) => match.state === 'not_started' && match.match_scores.length === 2)
    .sort((a, b) => a.position - b.position);
  expect(playable.length).toBeGreaterThanOrEqual(2);

  const running = playable[0];
  const started = await client.patch(`/matches/${running.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start match for running card screenshot');

  await page.reload();
  await expect(page.getByText('Spiel läuft').first()).toBeVisible({ timeout: 10000 });
  await scrollToLocator(page.locator(`[data-match-id="${running.id}"]`));
  await keyframe(page, testInfo, 'match_cards_in_progress');

  for (const score of running.match_scores) {
    const points = score.id === running.match_scores[0].id ? 10 : 1;
    const updated = await client.patch(`/match_scores/${score.id}`, { points });
    expectStatus(updated, 200, `update score ${score.id} for finished card screenshot`);
  }
  const finished = await client.patch(`/matches/${running.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish match for finished card screenshot');

  await page.reload();
  const finishedMatchBlock = page.locator(`[data-match-id="${running.id}"]`).locator('xpath=..');
  await expect(finishedMatchBlock).toContainText(/Gewinner:/, { timeout: 10000 });
  await scrollToLocator(finishedMatchBlock);
  await keyframe(page, testInfo, 'match_cards_finished');

  const byeCreated = await client.post<{ id: number }>('/tournaments', {
    name: `E2E Playoff Bye ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Playwright E2E tournament',
    public: true,
    teams: [
      { name: 'Bye Seed 1' },
      { name: 'Bye Seed 2' },
      { name: 'Bye Seed 3' },
    ],
  });
  expectStatus(byeCreated, 201, 'create public playoff tournament with bye');

  await page.goto(`/t/${byeCreated.json.id}`);
  await expect(page.getByText('kein Gegner, Team kommt weiter').first()).toBeVisible({ timeout: 120000 });
  await scrollToLocator(page.locator('.match').first());
  await keyframe(page, testInfo, 'match_cards_single_team');
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

  const displayedTeamNames = await matchCard.locator('td').allInnerTexts();
  const firstDisplayedScore = match!.match_scores.find((score) => score.team?.name === displayedTeamNames[0].trim());
  const secondDisplayedScore = match!.match_scores.find((score) => score.team?.name === displayedTeamNames[1].trim());
  expect(firstDisplayedScore).toBeTruthy();
  expect(secondDisplayedScore).toBeTruthy();

  const firstScore = await client.patch(`/match_scores/${firstDisplayedScore!.id}`, { points: 7 });
  expectStatus(firstScore, 200, 'update first score for live tournament view');
  const secondScore = await client.patch(`/match_scores/${secondDisplayedScore!.id}`, { points: 3 });
  expectStatus(secondScore, 200, 'update second score for live tournament view');
  await expect(matchCard.locator('th').first()).toHaveText('7', { timeout: 10_000 });
  await expect(matchCard.locator('th').nth(1)).toHaveText('3', { timeout: 10_000 });
  await keyframe(page, testInfo, 'live_tournament_scores');

  const finished = await client.patch(`/matches/${match!.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish match for live tournament view');
  await expect(page.getByText(new RegExp(`Gewinner: ${firstDisplayedScore!.team!.name}`))).toBeVisible({
    timeout: 10_000,
  });
  await keyframe(page, testInfo, 'live_tournament_finished');
});
