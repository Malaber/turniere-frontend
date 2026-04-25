import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { seedAndPlayGroupStage, seedGroupStageTournament } from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(240_000);

async function startMatches(
  client: ApiClient,
  tournamentId: number,
  count: number,
): Promise<void> {
  const res = await client.get<Array<{ id: number; state: string }>>(
    `/tournaments/${tournamentId}/matches`,
  );
  expectStatus(res, 200, 'fetch tournament matches');

  const notStarted = res.json.filter((m) => m.state === 'not_started');
  const toStart = notStarted.slice(0, count);

  for (const match of toStart) {
    const started = await client.patch(`/matches/${match.id}`, {
      state: 'in_progress',
    });
    expectStatus(started, 200, `start match ${match.id}`);
  }
}

test('Fullscreen beamer page renders with default fallback', async ({ page }, testInfo) => {
  // Fullscreen/beamer pages are designed for projectors — use a wide viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);

  // Create a default beamer via the API
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  // --- Fullscreen without beamer param (should fallback to default) ---
  await page.goto(`/t/${tournament.id}/fullscreen`);
  const bottomNavbar = page.locator('.fixed-bottom');
  await expect(bottomNavbar).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'fullscreen_loaded');

  // Cursor is hidden
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);

  // Display label shown
  await expect(page.getByText(/Anzeige:/i)).toBeVisible();
});

test('Fullscreen beamer page renders with specific beamer param', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);

  // Create a named beamer
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'projector-a',
    display_state: 'matches_in_progress',
  });

  // --- Fullscreen with beamer param ---
  await page.goto(`/t/${tournament.id}/fullscreen?beamer=projector-a`);
  const bottomNavbar = page.locator('.fixed-bottom');
  await expect(bottomNavbar).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'fullscreen_named_beamer');

  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
});

test('Fullscreen beamer page falls back when beamer name not found', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);

  // Create a default beamer so fallback works
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  // --- Fullscreen with nonexistent beamer name ---
  await page.goto(`/t/${tournament.id}/fullscreen?beamer=nonexistent`);
  const bottomNavbar = page.locator('.fixed-bottom');
  await expect(bottomNavbar).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'fullscreen_fallback');

  // Should still render (falls back to default beamer)
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
});

test('Fullscreen shows during-game and between-games modes with timer', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(6, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/timer`,
    { timestamp_seconds: 5 * 60 },
  );
  expectStatus(timerRes, 200, 'set timer');

  await startMatches(client, tournament.id, 20);

  await page.goto(`/t/${tournament.id}/fullscreen?display=during_game`);
  await expect(page.locator('[class*="digitSlot"]').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[class*="matchCard"]').first()).toBeVisible();
  await keyframe(page, testInfo, 'fullscreen_beamer_during_game');

  await page.goto(`/t/${tournament.id}/fullscreen?display=between_games`);
  await expect(page.getByText(/Nächste Spiele/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[class*="matchCard"]').first()).toBeVisible({ timeout: 15_000 });
  await keyframe(page, testInfo, 'fullscreen_beamer_between_games');
});

test('Fullscreen beamer page updates live from backend ActionCable only', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  const createBeamer = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'live-projector',
    display_state: 'matches_all',
  });
  expectStatus(createBeamer, 201, 'create live beamer');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=live-projector`);
  await expect(page.getByText(/Anzeige: alle/i)).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'live_beamer_all');

  const firstUpdate = await client.patch(
    `/tournaments/${tournament.id}/beamers/${createBeamer.json.id}`,
    { display_state: 'matches_in_progress' },
  );
  expectStatus(firstUpdate, 200, 'update beamer to in-progress');
  await expect(page.getByText(/Anzeige: laufend/i)).toBeVisible({ timeout: 10_000 });
  await keyframe(page, testInfo, 'live_beamer_in_progress');

  const secondUpdate = await client.patch(
    `/tournaments/${tournament.id}/beamers/${createBeamer.json.id}`,
    { display_state: 'matches_finished' },
  );
  expectStatus(secondUpdate, 200, 'update beamer to finished');
  await expect(page.getByText(/Anzeige: beendet/i)).toBeVisible({ timeout: 10_000 });
  await keyframe(page, testInfo, 'live_beamer_finished');
});

test('Fullscreen match list receives live match snapshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const matchesRes = await client.get<Array<{
    id: number;
    state: string;
    match_scores: Array<{ id: number; team: { name: string } | null }>;
  }>>(`/tournaments/${tournament.id}/matches`);
  expectStatus(matchesRes, 200, 'fetch live fullscreen matches');
  const match = matchesRes.json.find((candidate) =>
    candidate.state === 'not_started' && candidate.match_scores.length === 2
  );
  expect(match).toBeTruthy();

  await page.goto(`/t/${tournament.id}/fullscreen?display=matches_in_progress`);
  await expect(page.getByText(/keine Matches/i)).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'live_matches_empty');

  const started = await client.patch(`/matches/${match!.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start live fullscreen match');
  await expect(page.locator(`[data-match-id="${match!.id}"]`)).toBeVisible({ timeout: 10_000 });

  const firstScore = await client.patch(`/match_scores/${match!.match_scores[0].id}`, { points: 5 });
  expectStatus(firstScore, 200, 'update first live fullscreen score');
  const secondScore = await client.patch(`/match_scores/${match!.match_scores[1].id}`, { points: 4 });
  expectStatus(secondScore, 200, 'update second live fullscreen score');
  const matchCard = page.locator(`[data-match-id="${match!.id}"]`);
  await expect(matchCard.locator('th').first()).toHaveText('5', { timeout: 10_000 });
  await expect(matchCard.locator('th').nth(1)).toHaveText('4', { timeout: 10_000 });
  await keyframe(page, testInfo, 'live_matches_in_progress');

  const finished = await client.patch(`/matches/${match!.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish live fullscreen match');
  await expect(page.getByText(/keine Matches/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`[data-match-id="${match!.id}"]`)).toHaveCount(0);
  await keyframe(page, testInfo, 'live_matches_finished_removed');
});

test('Fullscreen timer updates live for countup mode', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  await page.goto(`/t/${tournament.id}/fullscreen?display=matches_all`);
  await expect(page.getByText(/Anzeige: alle/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Spielzeit:/i)).toHaveCount(0);

  const anchor = new Date(Date.now() - 3 * 60 * 1000 - 15 * 1000).toISOString();
  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/timer`,
    { timestamp: anchor, timer_mode: 'countup' },
  );
  expectStatus(timerRes, 200, 'start countup timer');

  await expect(page.getByText(/Spielzeit:/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.timer-container')).toContainText(/3:1[0-9]|3:2[0-9]/, {
    timeout: 10_000,
  });
});
