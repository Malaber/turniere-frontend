import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { expectFullscreenMatchCardFrame } from '../helpers/fullscreen-match-card';
import { ApiClient, expectStatus } from '../helpers/api-client';
import {
  LONG_TEAM_NAME_SENTENCE,
  LONG_TEAM_NAME_SINGLE_WORD,
} from '../helpers/scenario-seeder';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(240_000);

/**
 * Build a group-stage payload where every team name is at least 32 chars.
 * 6 groups × 4 teams = 24 teams → 6 × C(4,2) = 36 group matches.
 */
function longNamePayload() {
  const groups = 6;
  const perGroup = 4;
  const teams: Array<{ name: string; group: number }> = [];

  for (let g = 0; g < groups; g++) {
    for (let s = 0; s < perGroup; s++) {
      const base = s % 2 === 0 ? LONG_TEAM_NAME_SINGLE_WORD : LONG_TEAM_NAME_SENTENCE;
      const name = `${base} G${g + 1}-S${s + 1}`;
      teams.push({ name, group: g });
    }
  }

  return {
    name: `E2E Between ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Playwright E2E tournament',
    public: true,
    group_stage: true,
    playoff_teams_amount: 2,
    teams,
  };
}

test('Between-games view shows 32 matches with truncated long names', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Create tournament with 36 not_started matches and 32+ char names
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const created = await client.post<{ id: number }>('/tournaments', longNamePayload());
  expectStatus(created, 201, 'create long-name tournament');
  const tournamentId = created.json.id;

  await expect.poll(async () => {
    const matches = await client.get<Array<{ id: number; state: string }>>(
      `/tournaments/${tournamentId}/matches`,
    );
    expectStatus(matches, 200, 'fetch long-name matches');
    return matches.json.filter((m) => m.state === 'not_started').length;
  }, { timeout: 20_000 }).toBeGreaterThanOrEqual(32);

  const seededMatches = await client.get<Array<{ id: number; position: number; state: string }>>(
    `/tournaments/${tournamentId}/matches`,
  );
  expectStatus(seededMatches, 200, 'fetch matches for state mix');
  const firstMatch = seededMatches.json.slice().sort((a, b) => a.position - b.position)[0];
  const startRes = await client.patch(`/matches/${firstMatch.id}`, { state: 'in_progress' });
  expectStatus(startRes, 200, 'start first between-games match');
  await expect.poll(async () => {
    const matches = await client.get<Array<{ id: number; state: string }>>(
      `/tournaments/${tournamentId}/matches`,
    );
    expectStatus(matches, 200, 'fetch started match state');
    return matches.json.find((m) => m.id === firstMatch.id)?.state;
  }, { timeout: 20_000 }).toBe('in_progress');

  // Navigate to fullscreen
  await page.goto(`/t/${tournamentId}/fullscreen?display=between_games`);

  // Wait for match cards to render
  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(page.getByText(/Nächste Spiele/)).toBeVisible({ timeout: 15_000 });
  await expect(matchCards.first()).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'between_games_loaded');

  // White background for bright-room projector
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  // First page shows exactly 32 cards (36 total, capped at 32)
  await expect(matchCards).toHaveCount(32, { timeout: 20_000 });
  const badges = page.getByTestId('fullscreen-match-badge');
  await expectFullscreenMatchCardFrame(
    matchCards.first(),
    badges.first(),
    {
      state: 'in_progress',
      cardBackground: 'rgb(255, 243, 205)',
      badgeBackground: 'rgb(181, 129, 0)',
    },
  );
  await expectFullscreenMatchCardFrame(
    matchCards.nth(1),
    badges.nth(1),
    {
      state: 'not_started',
      cardBackground: 'rgb(248, 249, 250)',
      badgeBackground: 'rgb(108, 117, 125)',
    },
  );

  // Team names are rendered (CSS handles truncation via text-overflow)
  const teamNames = page.getByTestId('fullscreen-team-name');
  await expect(teamNames).toHaveCount(64); // 32 matches × 2 teams
  const singleWordName = teamNames.filter({ hasText: LONG_TEAM_NAME_SINGLE_WORD }).first();
  const sentenceName = teamNames.filter({ hasText: LONG_TEAM_NAME_SENTENCE }).first();
  await expect(singleWordName).toHaveAttribute('title', new RegExp(LONG_TEAM_NAME_SINGLE_WORD));
  await expect(sentenceName).toHaveAttribute('title', new RegExp(LONG_TEAM_NAME_SENTENCE));
  await expect(singleWordName).toHaveCSS('overflow-x', 'hidden');
  expect(await singleWordName.evaluate(el => getComputedStyle(el).textOverflow)).toMatch(/ellipsis|"\.\.\."/);
  expect(await sentenceName.evaluate(el => getComputedStyle(el).textOverflow)).toMatch(/ellipsis|"\.\.\."/);
  expect(await singleWordName.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await sentenceName.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);

  // Group number badges should be present
  const badgeTexts = await badges.allInnerTexts();
  expect(badgeTexts.length).toBe(32);
  // Badges show group numbers (1-6)
  expect(badgeTexts.every((t) => /^\d+$/.test(t))).toBe(true);

  await keyframe(page, testInfo, 'between_games_truncated_names');

  // Wait for chunk rotation (12s cycle + buffer)
  await page.waitForTimeout(13_000);

  // Second page shows remaining 4 matches
  await expect(matchCards).toHaveCount(4, { timeout: 20_000 });
  await keyframe(page, testInfo, 'between_games_page2');
});
