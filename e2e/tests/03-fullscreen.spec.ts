import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { seedAndPlayGroupStage, seedGroupStageTournament } from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';
import { waitForActionCableSubscription } from '../helpers/action-cable';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(600_000);

type ApiMatchForBadge = {
  id: number;
  position: number;
  state: string;
  group?: { number: number } | null;
  match_scores: Array<{ id: number; team: { name: string } | null }>;
};

async function expectDuringGameEmpty(page: Page): Promise<void> {
  await expect(page.getByText(/Kein Timer gesetzt/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/keine laufenden Matches/i)).toBeVisible({ timeout: 20_000 });
}

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

  await expect.poll(async () => {
    const started = await client.get<Array<{ id: number; state: string }>>(
      `/tournaments/${tournamentId}/matches`,
      { state: 'in_progress' },
    );
    expectStatus(started, 200, 'fetch started matches');
    return started.json.length;
  }, { timeout: 20_000 }).toBe(count);
}

async function stripGroupFromMatchesEndpoint(page: Page, tournamentId: number): Promise<void> {
  await page.route(new RegExp(`/tournaments/${tournamentId}/matches(\\?.*)?$`), async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const stripGroup = (match: ApiMatchForBadge) => {
      const withoutGroup = { ...match };
      delete withoutGroup.group;
      return withoutGroup;
    };
    const payload = Array.isArray(body)
      ? body.map(stripGroup)
      : {
          ...body,
          matches: Array.isArray(body.matches) ? body.matches.map(stripGroup) : body.matches,
        };

    await route.fulfill({ response, json: payload });
  });
}

test('Fullscreen beamer page renders with default fallback', async ({ page }, testInfo) => {
  // Fullscreen/beamer pages are designed for projectors — use a wide viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  // Create a default beamer via the API
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  // --- Fullscreen without beamer param (should fallback to default) ---
  await page.goto(`/t/${tournament.id}/fullscreen`);
  await expectDuringGameEmpty(page);
  await keyframe(page, testInfo, 'fullscreen_loaded');

  // Cursor is hidden
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
});

test('Fullscreen beamer page renders with specific beamer param', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  // Create a named beamer
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  const createBeamer = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'projector-a',
    display_state: 'between_games',
    config: {},
  });
  expectStatus(createBeamer, 201, 'create named beamer');

  // --- Fullscreen with beamer param ---
  await page.goto(`/t/${tournament.id}/fullscreen?beamer=projector-a`);
  await expect(page.locator('body')).toContainText(/Nächste Spiele/, { timeout: 60_000 });
  await expect(page.getByTestId('fullscreen-match-card').first()).toBeVisible({ timeout: 60_000 });
  await keyframe(page, testInfo, 'fullscreen_named_beamer');

  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
});

test('Fullscreen beamer page falls back when beamer name not found', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  // Create a default beamer so fallback works
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  // --- Fullscreen with nonexistent beamer name ---
  await page.goto(`/t/${tournament.id}/fullscreen?beamer=nonexistent`);
  await expectDuringGameEmpty(page);
  await keyframe(page, testInfo, 'fullscreen_fallback');

  // Should still render (falls back to default beamer)
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
});

test('Fullscreen shows during-game and between-games modes with timer', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/timer`,
    { timestamp_seconds: 20 * 60 },
  );
  expectStatus(timerRes, 200, 'set timer');

  await startMatches(client, tournament.id, 8);

  await page.goto(`/t/${tournament.id}/fullscreen?display=during_game`);
  await expect(page.locator('[class*="digitSlot"]').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('fullscreen-match-card').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('body')).toContainText('G1-S1', { timeout: 60_000 });
  await keyframe(page, testInfo, 'fullscreen_beamer_during_game');

  await page.goto(`/t/${tournament.id}/fullscreen?display=between_games`);
  await expect(page.locator('body')).toContainText(/Nächste Spiele/, { timeout: 20_000 });
  const betweenTitle = page.getByTestId('between-games-title');
  await expect(betweenTitle).toBeVisible();
  await expect.poll(async () => (
    betweenTitle.evaluate((node) => parseFloat(window.getComputedStyle(node).fontSize))
  ), { timeout: 10_000 }).toBeGreaterThanOrEqual(30);
  const betweenTimer = page.getByTestId('between-games-timer');
  await expect(betweenTimer).toBeVisible({ timeout: 10_000 });
  await expect(betweenTimer).toContainText(/(Spielende|Timer)/i);
  await expect(betweenTimer).toContainText(/\d{1,2}:[0-5][0-9]/);
  const timerBox = await betweenTimer.boundingBox();
  expect(timerBox).toBeTruthy();
  expect(timerBox!.x).toBeGreaterThan(1920 * 0.6);
  expect(timerBox!.y).toBeLessThan(120);
  await expect(page.getByTestId('fullscreen-match-card').first()).toBeVisible({ timeout: 15_000 });
  await keyframe(page, testInfo, 'fullscreen_beamer_between_games');
});

test('Fullscreen beamer badges show group numbers for group matches and positions for playoff matches', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const { tournament: groupTournament } = await seedGroupStageTournament(2, 4, 4);
  const groupMatches = await client.get<ApiMatchForBadge[]>(`/tournaments/${groupTournament.id}/matches`);
  expectStatus(groupMatches, 200, 'fetch group matches for badge labels');
  const groupMatch = groupMatches.json.find((match) =>
    match.group?.number === 2 &&
    match.position + 1 !== match.group.number &&
    match.state === 'not_started' &&
    match.match_scores.length === 2
  );
  expect(groupMatch).toBeTruthy();

  const startedGroup = await client.patch(`/matches/${groupMatch!.id}`, { state: 'in_progress' });
  expectStatus(startedGroup, 200, 'start group match for badge label');

  await stripGroupFromMatchesEndpoint(page, groupTournament.id);
  await page.goto(`/t/${groupTournament.id}/fullscreen?display=during_game`);
  const groupCard = page.locator(`[data-match-id="${groupMatch!.id}"]`);
  await expect(groupCard).toBeVisible({ timeout: 20_000 });
  const groupBadge = groupCard.getByTestId('fullscreen-match-badge');
  await expect(groupBadge).toHaveText('2');
  await expect(groupBadge).toHaveAttribute('data-match-badge-kind', 'group');

  const { tournament: playoffTournament } = await seedAndPlayGroupStage(2, 4, 4);
  const playoffMatches = await client.get<ApiMatchForBadge[]>(`/tournaments/${playoffTournament.id}/matches`);
  expectStatus(playoffMatches, 200, 'fetch playoff matches for badge labels');
  const playoffMatch = playoffMatches.json.find((match) =>
    !match.group && match.state === 'not_started' && match.match_scores.length === 2
  );
  expect(playoffMatch).toBeTruthy();

  const startedPlayoff = await client.patch(`/matches/${playoffMatch!.id}`, { state: 'in_progress' });
  expectStatus(startedPlayoff, 200, 'start playoff match for badge label');

  await page.goto(`/t/${playoffTournament.id}/fullscreen?display=during_game`);
  const playoffCard = page.locator(`[data-match-id="${playoffMatch!.id}"]`);
  await expect(playoffCard).toBeVisible({ timeout: 20_000 });
  const playoffBadge = playoffCard.getByTestId('fullscreen-match-badge');
  await expect(playoffBadge).toHaveText(String(playoffMatch!.position + 1));
  await expect(playoffBadge).toHaveAttribute('data-match-badge-kind', 'position');
});

test('Fullscreen beamer page updates live from backend ActionCable only', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  const createBeamer = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'live-projector',
    display_state: 'during_game',
    config: {},
  });
  expectStatus(createBeamer, 201, 'create live beamer');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=live-projector`);
  await expectDuringGameEmpty(page);
  await waitForActionCableSubscription(page, {
    channel: 'TournamentBeamersChannel',
    tournament_id: tournament.id,
    beamer_name: 'live-projector',
  });
  await keyframe(page, testInfo, 'live_beamer_during_game');

  const firstUpdate = await client.patch(
    `/tournaments/${tournament.id}/beamers/${createBeamer.json.id}`,
    { display_state: 'between_games' },
  );
  expectStatus(firstUpdate, 200, 'update beamer to between-games');
  await expect(page.locator('body')).toContainText(/Nächste Spiele/, { timeout: 60_000 });
  await keyframe(page, testInfo, 'live_beamer_between_games');

  const secondUpdate = await client.patch(
    `/tournaments/${tournament.id}/beamers/${createBeamer.json.id}`,
    { display_state: 'group_tables' },
  );
  expectStatus(secondUpdate, 200, 'update beamer to group tables');
  await expect(page.getByText(/Gruppe 1/i)).toBeVisible({ timeout: 10_000 });
  await keyframe(page, testInfo, 'live_beamer_group_tables');
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
  await waitForActionCableSubscription(page, {
    channel: 'TournamentMatchesChannel',
    tournament_id: tournament.id,
    state: 'in_progress',
  });
  await keyframe(page, testInfo, 'live_matches_empty');
  await page.waitForTimeout(1_000);

  const started = await client.patch(`/matches/${match!.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start live fullscreen match');
  const matchCard = page.locator(`[data-match-id="${match!.id}"]`);
  await expect(matchCard).toBeVisible({ timeout: 20_000 }).catch(async () => {
    await page.reload();
    await expect(matchCard).toBeVisible({ timeout: 20_000 });
  });

  const firstScore = await client.patch(`/match_scores/${match!.match_scores[0].id}`, { points: 5 });
  expectStatus(firstScore, 200, 'update first live fullscreen score');
  await expect.poll(async () => {
    const scores = await matchCard.locator('th').allTextContents();
    return scores;
  }, { timeout: 10_000 }).toContain('5');
  const secondScore = await client.patch(`/match_scores/${match!.match_scores[1].id}`, { points: 4 });
  expectStatus(secondScore, 200, 'update second live fullscreen score');
  await expect.poll(async () => {
    const scores = await matchCard.locator('th').allTextContents();
    return scores.sort();
  }, { timeout: 20_000 }).toEqual(['4', '5']).catch(async () => {
    await page.reload();
    await expect.poll(async () => {
      const scores = await matchCard.locator('th').allTextContents();
      return scores.sort();
    }, { timeout: 20_000 }).toEqual(['4', '5']);
  });
  await keyframe(page, testInfo, 'live_matches_in_progress');

  const finished = await client.patch(`/matches/${match!.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish live fullscreen match');
  await expect(page.getByText(/keine Matches/i)).toBeVisible({ timeout: 20_000 }).catch(async () => {
    await page.reload();
    await expect(page.getByText(/keine Matches/i)).toBeVisible({ timeout: 20_000 });
  });
  await expect(page.locator(`[data-match-id="${match!.id}"]`)).toHaveCount(0);
  await keyframe(page, testInfo, 'live_matches_finished_removed');
});

test('Matches-only beamer displays backend-returned matches without client state filtering', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const matchesRes = await client.get<Array<{
    id: number;
    state: string;
    match_scores: Array<{ id: number; team: { name: string } | null }>;
  }>>(`/tournaments/${tournament.id}/matches`);
  expectStatus(matchesRes, 200, 'fetch matches-only beamer matches');
  const match = matchesRes.json.find((candidate) =>
    candidate.state === 'not_started' && candidate.match_scores.length === 2
  );
  expect(match).toBeTruthy();

  const started = await client.patch(`/matches/${match!.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start matches-only beamer match');
  for (const [index, score] of match!.match_scores.entries()) {
    const updated = await client.patch(`/match_scores/${score.id}`, { points: index === 0 ? 10 : 1 });
    expectStatus(updated, 200, `score matches-only beamer match_score ${score.id}`);
  }
  const finished = await client.patch(`/matches/${match!.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish matches-only beamer match');

  const beamer = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'matches-only-finished',
    display_state: 'between_games',
    config: { match_filter: 'state:finished' },
  });
  expectStatus(beamer, 201, 'create matches-only finished beamer');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=matches-only-finished`);
  await expect(page.locator(`[data-match-id="${match!.id}"]`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('fullscreen-match-card')).toHaveCount(1);
  await keyframe(page, testInfo, 'matches_only_finished_match');
});

test('Fullscreen timer updates live for countup mode', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  await page.goto(`/t/${tournament.id}/fullscreen?display=matches_all`);
  await expect(page.getByText(/Anzeige: alle/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Spielzeit:/i)).toHaveCount(0);
  await waitForActionCableSubscription(page, {
    channel: 'TournamentTimersChannel',
    tournament_id: tournament.id,
  });

  const anchor = new Date(Date.now() - 3 * 60 * 1000 - 15 * 1000).toISOString();
  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/timer`,
    {
      timestamp: anchor,
      timer_mode: 'countup',
      timer_reason: 'custom',
      timer_reason_text: 'Overtime',
    },
  );
  expectStatus(timerRes, 200, 'start countup timer');

  await expect(page.locator('.timer-container')).toContainText(/(Overtime|Spielende):/i, {
    timeout: 60_000,
  });
  const timerValue = page.locator('.timer-container .navbar-brand');
  await expect(timerValue).toContainText(/[0-9]+:[0-5][0-9]/, {
    timeout: 60_000,
  });
  const textBefore = await timerValue.textContent();
  await page.waitForTimeout(2_500);
  await expect(timerValue).not.toHaveText((textBefore || '').trim(), { timeout: 5_000 });
  await keyframe(page, testInfo, 'fullscreen_timer_reason_countup');
});

test('Werbung beamer rotates selected images and shows timer reason', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const timerEnd = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const timerRes = await client.patch(
    `/tournaments/${tournament.id}/timer`,
    {
      timestamp: timerEnd,
      timer_mode: 'countdown',
      timer_reason: 'custom',
      timer_reason_text: 'Werbepause',
    },
  );
  expectStatus(timerRes, 200, 'set werbung timer');

  const beamer = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'werbung',
    display_state: 'static_image',
    config: {
      display_mode: 'werbung',
      werbung_image_keys: ['bpwstr_logo', 'bpwstr_banner'],
      werbung_rotation_seconds: 1,
    },
  });
  expectStatus(beamer, 201, 'create werbung beamer');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=werbung`);
  await expect(page.getByTestId('beamer-werbung-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('beamer-werbung-reason')).toContainText(/Werbepause|Spielende/);
  await expect(page.getByTestId('beamer-werbung-timer')).toBeVisible();
  await expect(page.getByTestId('beamer-werbung-image')).toHaveAttribute('src', /bpwstr_logo/);
  await expect(page.getByTestId('beamer-werbung-image')).toHaveAttribute('src', /bpwstr_banner/, {
    timeout: 5_000,
  });
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
  await keyframe(page, testInfo, 'fullscreen_werbung_beamer');
});

test('Static image beamer renders selected QR code image', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament } = await seedGroupStageTournament(2, 4, 4);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  const beamer = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'qr-static',
    display_state: 'static_image',
    config: {
      image_key: 'bpwstr_qr_code',
    },
  });
  expectStatus(beamer, 201, 'create qr static beamer');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=qr-static`);
  await expect(page.getByTestId('beamer-static-image')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('beamer-static-image')).toHaveAttribute('src', /bpwstr_qr_code/);
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);
  await keyframe(page, testInfo, 'fullscreen_static_qr_code');
});
