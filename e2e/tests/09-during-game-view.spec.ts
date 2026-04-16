import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { seedGroupStageTournament } from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(240_000);

async function setDefaultBeamerDisplayState(client: ApiClient, tournamentId: number, displayState: string) {
  const beamerRes = await client.get<{ id: number }>(
    `/tournaments/${tournamentId}/beamers/by_name`,
    { name: 'default' },
  );
  expectStatus(beamerRes, 200, 'fetch default beamer');

  const updateRes = await client.patch(
    `/tournaments/${tournamentId}/beamers/${beamerRes.json.id}`,
    { display_state: displayState },
  );
  expectStatus(updateRes, 200, `set default beamer to ${displayState}`);
}

/**
 * Start N group-stage matches (without finishing them) so they appear as
 * in_progress. Returns the IDs of started matches.
 */
async function startMatches(
  client: ApiClient,
  tournamentId: number,
  count: number,
): Promise<number[]> {
  const res = await client.get<Array<{ id: number; state: string }>>(
    `/tournaments/${tournamentId}/matches`,
  );
  expectStatus(res, 200, 'fetch tournament matches');

  const notStarted = res.json.filter((m) => m.state === 'not_started');
  const toStart = notStarted.slice(0, count);
  const ids: number[] = [];

  for (const match of toStart) {
    const started = await client.patch(`/matches/${match.id}`, {
      state: 'in_progress',
    });
    expectStatus(started, 200, `start match ${match.id}`);
    ids.push(match.id);
  }

  return ids;
}

test('During-game view shows animated timer that updates', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Seed a tournament (not played — we only need group matches to start)
  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  // Set a timer 5 minutes in the future
  const timerEnd = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/set_timer_end`,
    { timer_end: timerEnd },
  );
  expectStatus(timerRes, 200, 'set timer');

  await setDefaultBeamerDisplayState(client, tournament.id, 'during_game');

  // Start enough matches to populate live grid
  await startMatches(client, tournament.id, 14);

  // Open the fullscreen during-game view
  await page.goto(`/t/${tournament.id}/fullscreen`);

  // White body background for bright-room projector
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  // Cursor is hidden
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);

  // Timer should be visible
  const timerDigits = page.locator('[class*="digitSlot"]');
  await expect(timerDigits.first()).toBeVisible();
  await keyframe(page, testInfo, 'during_game_loaded');

  // Read which digit each odometer strip shows via its translateY offset
  const readTimer = () =>
    page.evaluate(() => {
      const strips = document.querySelectorAll('[class*="digitStrip"]');
      return Array.from(strips).map(el => {
        const style = (el as HTMLElement).style.transform;
        const match = style.match(/translateY\((-?\d+)/);
        return match ? String(Math.abs(parseInt(match[1], 10)) / 10) : '?';
      }).join('');
    });

  const textBefore = await readTimer();
  await page.waitForTimeout(2500);
  const textAfter = await readTimer();
  expect(textBefore).not.toEqual(textAfter);

  await keyframe(page, testInfo, 'during_game_timer_updated');
});

test('During-game view rotates match chunks', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(6, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  await setDefaultBeamerDisplayState(client, tournament.id, 'during_game');

  // Start 20 matches — enough for page 1 (16) plus page 2 overflow (4)
  await startMatches(client, tournament.id, 20);

  await page.goto(`/t/${tournament.id}/fullscreen`);

  // Wait for match cards to render
  const matchCards = page.locator('[class*="matchCard"]');
  await expect(matchCards.first()).toBeVisible();
  await keyframe(page, testInfo, 'during_game_chunk1');

  // First chunk must show exactly 16 cards (a full page)
  const firstChunkTexts = await matchCards.allInnerTexts();
  expect(firstChunkTexts).toHaveLength(16);

  // Wait for the 10s chunk rotation cycle plus a small buffer
  await page.waitForTimeout(11_000);

  // Second chunk shows overflow matches
  const secondChunkTexts = await matchCards.allInnerTexts();
  expect(secondChunkTexts).toHaveLength(4);

  // Chunks must show different matches
  expect(firstChunkTexts).not.toEqual(secondChunkTexts);

  await keyframe(page, testInfo, 'during_game_chunk2');
});
