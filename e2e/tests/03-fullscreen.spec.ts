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
  await expect(bottomNavbar).toBeVisible();
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
  await expect(bottomNavbar).toBeVisible();
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
  await expect(bottomNavbar).toBeVisible();
  await keyframe(page, testInfo, 'fullscreen_fallback');

  // Should still render (falls back to default beamer)
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
});

test('Fullscreen beamer switches between during-game and between-games modes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(6, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const timerEnd = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/set_timer_end`,
    { timer_end: timerEnd },
  );
  expectStatus(timerRes, 200, 'set timer');

  const beamerRes = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'projector-switch',
    display_state: 'during_game',
  });
  expectStatus(beamerRes, 201, 'create switching beamer');

  await startMatches(client, tournament.id, 20);

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=projector-switch`);
  await expect(page.locator('[class*="digitSlot"]').first()).toBeVisible();
  await expect(page.locator('[class*="matchCard"]').first()).toBeVisible();
  await keyframe(page, testInfo, 'fullscreen_beamer_during_game');

  const updateRes = await client.patch(
    `/tournaments/${tournament.id}/beamers/${beamerRes.json.id}`,
    { display_state: 'between_games' },
  );
  expectStatus(updateRes, 200, 'switch beamer to between_games');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=projector-switch`);
  await expect(page.getByText('Nächste Spiele')).toBeVisible();
  await expect(page.locator('[class*="matchCard"]').first()).toBeVisible();
  await keyframe(page, testInfo, 'fullscreen_beamer_between_games');
});
