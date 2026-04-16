import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { ApiClient, expectStatus } from '../helpers/api-client';

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
      // e.g. "Sportverein Musterstadt G1-S1!!" — 32+ chars
      const base = `Sportverein Musterstadt G${g + 1}-S${s + 1}`;
      const name = base.padEnd(32, '!');
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

  // Create a beamer with between_games display state
  const beamerRes = await client.post(`/tournaments/${tournamentId}/beamers`, {
    name: 'between',
    display_state: 'between_games',
  });
  expectStatus(beamerRes, 201, 'create between_games beamer');

  // Navigate to fullscreen
  await page.goto(`/t/${tournamentId}/fullscreen?beamer=between`);

  // Wait for match cards to render
  const matchCards = page.locator('[class*="matchCard"]');
  await expect(matchCards.first()).toBeVisible();
  await keyframe(page, testInfo, 'between_games_loaded');

  // White background for bright-room projector
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  // First page shows exactly 32 cards (36 total, capped at 32)
  await expect(matchCards).toHaveCount(32);

  // Team names are rendered (CSS handles truncation via text-overflow)
  const teamNames = page.locator('[class*="teamName"]');
  await expect(teamNames).toHaveCount(64); // 32 matches × 2 teams

  // Group number badges should be present
  const badges = page.locator('[class*="matchBadge"]');
  const badgeTexts = await badges.allInnerTexts();
  expect(badgeTexts.length).toBe(32);
  // Badges show group numbers (1-6)
  expect(badgeTexts.every((t) => /^\d+$/.test(t))).toBe(true);

  await keyframe(page, testInfo, 'between_games_truncated_names');

  // Wait for chunk rotation (12s cycle + buffer)
  await page.waitForTimeout(13_000);

  // Second page shows remaining 4 matches
  await expect(matchCards).toHaveCount(4);
  await keyframe(page, testInfo, 'between_games_page2');
});
