import { test, expect, Page, devices } from '@playwright/test';
import { countBeamerEffects, installBeamerEffectSpies, waitForBeamerEffect } from '../helpers/beamer-audio';
import { waitForActionCableSubscription } from '../helpers/action-cable';
import { keyframe } from '../helpers/screenshot';
import { expectFullscreenMatchCardFrame } from '../helpers/fullscreen-match-card';
import {
  LONG_TEAM_NAME_SINGLE_WORD,
  longGroupStageTeamName,
  seedGroupStageTournament,
} from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

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

async function waitForMatchStateCount(
  client: ApiClient,
  tournamentId: number,
  state: string,
  expected: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await client.get<Array<{ state: string }>>(
          `/tournaments/${tournamentId}/matches`,
          { state },
        );
        expectStatus(res, 200, `fetch ${state} matches`);
        return res.json.length;
      },
      { timeout: 20_000 },
    )
    .toBe(expected);
}

async function setupBeamerAndMatches(
  matchCount: number,
  opts: {
    timerSeconds?: number;
    timerReason?: string;
    timerReasonText?: string;
    beamerName?: string;
    displayState?: string;
    showTimerReason?: boolean;
  } = {},
) {
  const {
    timerSeconds,
    timerReason,
    timerReasonText,
    beamerName = 'e2e-during',
    displayState = 'during_game',
    showTimerReason = true,
  } = opts;

  // Use more groups/teams to have enough matches available
  const { tournament } = await seedGroupStageTournament(8, 4, 8, longGroupStageTeamName);

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  if (timerSeconds !== undefined) {
    const timerPayload: Record<string, string | number> = { timestamp_seconds: timerSeconds };
    if (timerReason) timerPayload.timer_reason = timerReason;
    if (timerReasonText) timerPayload.timer_reason_text = timerReasonText;
    const timerRes = await client.patch(
      `/tournaments/${tournament.id}/timer`,
      timerPayload,
    );
    expectStatus(timerRes, 200, 'set timer');
  }

  // Try creating a beamer; fall back to ?display= URL if backend lacks beamer support
  const beamerPayload = displayState === 'timer_only'
    ? {
      name: beamerName,
      display_state: 'during_game',
      config: { display_mode: 'timer_only', show_timer_reason: showTimerReason },
      is_default: false,
    }
    : { name: beamerName, display_state: displayState, is_default: false };

  const beamerRes = await client.post(
    `/tournaments/${tournament.id}/beamers`,
    beamerPayload,
  );
  const hasBeamer = beamerRes.status === 201;

  await startMatches(client, tournament.id, matchCount);
  await waitForMatchStateCount(client, tournament.id, 'in_progress', matchCount);

  const fullscreenQuery = hasBeamer
    ? `beamer=${beamerName}`
    : `display=${displayState}`;

  return { tournament, client, fullscreenQuery };
}

async function activeCardAnimationName(page: Page): Promise<string> {
  return page
    .getByTestId('fullscreen-match-card')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
}

async function carouselTranslateX(page: Page): Promise<number> {
  return page
    .getByTestId('fullscreen-match-carousel-track')
    .evaluate((el) => {
      const transform = getComputedStyle(el).transform;
      const matrix = transform.match(/^matrix\((.+)\)$/);

      if (!matrix) return 0;

      const values = matrix[1].split(',').map((value) => Number(value.trim()));
      return values[4] || 0;
    });
}

async function readAnimatedTimerText(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => {
    return Array.from(el.children)
      .map((child) => {
        const strip = child.querySelector('[class*="digitStrip"]');
        if (!strip) return child.textContent ?? '';

        const style = (strip as HTMLElement).style.transform;
        const match = style.match(/translateY\((-?\d+(?:\.\d+)?)%\)/);
        return match ? String(Math.abs(parseFloat(match[1])) / 10) : '?';
      })
      .join('');
  });
}

async function expectAnimatedTimerText(page: Page, testId: string, expected: RegExp): Promise<void> {
  await expect
    .poll(() => readAnimatedTimerText(page, testId), { timeout: 10_000 })
    .toMatch(expected);
}

// ---------------------------------------------------------------------------
// Timer tests
// ---------------------------------------------------------------------------

test('During-game view shows animated timer that updates', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(14, {
    timerSeconds: 5 * 60,
    timerReason: 'tournament_start',
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  // Wait for match cards to confirm the page loaded
  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards.first()).toBeVisible({ timeout: 15_000 });
  await expectFullscreenMatchCardFrame(
    matchCards.first(),
    page.getByTestId('fullscreen-match-badge').first(),
    {
      state: 'in_progress',
      cardBackground: 'rgb(255, 243, 205)',
      badgeBackground: 'rgb(181, 129, 0)',
    },
  );
  const longTeamName = page.getByTestId('fullscreen-team-name').filter({ hasText: LONG_TEAM_NAME_SINGLE_WORD }).first();
  await expect(longTeamName).toHaveAttribute('title', new RegExp(LONG_TEAM_NAME_SINGLE_WORD));
  await expect(longTeamName).toHaveCSS('overflow-x', 'hidden');
  expect(await longTeamName.evaluate(el => getComputedStyle(el).textOverflow)).toMatch(/ellipsis|"\.\.\."/);
  expect(await longTeamName.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await keyframe(page, testInfo, 'during_game_loaded');

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
  await expect(page.getByText(/Turnierstart/i)).toHaveCount(0);

  const readTimer = () =>
    page.evaluate(() => {
      const strips = document.querySelectorAll('[class*="digitStrip"]');

      return Array.from(strips)
        .map((el) => {
          const style = (el as HTMLElement).style.transform;
          const match = style.match(/translateY\((-?\d+)/);

          return match ? String(Math.abs(parseInt(match[1], 10)) / 10) : '?';
        })
        .join('');
    });

  const textBefore = await readTimer();
  await page.waitForTimeout(2500);
  const textAfter = await readTimer();

  expect(textBefore).not.toEqual(textAfter);

  await keyframe(page, testInfo, 'during_game_timer_updated');
});

test('Fullscreen timer takeover during countdown and finished', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Load with a long timer first so slower CI still captures normal match cards
  // before the countdown takeover starts.
  const { tournament, client, fullscreenQuery } = await setupBeamerAndMatches(12, {
    timerSeconds: 10 * 60,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  // Wait for match cards to confirm initial render
  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards.first()).toBeVisible({ timeout: 15_000 });
  await waitForActionCableSubscription(page, {
    channel: 'TournamentTimersChannel',
    tournament_id: tournament.id,
  });
  await keyframe(page, testInfo, 'before_countdown');

  // Match cards should be visible in normal mode
  const cardsVisibleBefore = await matchCards.count();
  expect(cardsVisibleBefore).toBeGreaterThan(0);

  const timerRes = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 15,
  });
  expectStatus(timerRes, 200, 'start countdown timer');

  // Wait for countdown phase (timer <= 10s triggers takeover)
  const timerTakeover = page.locator('[class*="timerTakeover"]');
  await expect(timerTakeover).toBeVisible({ timeout: 15_000 });

  // Use direct screenshot — bump animation repeats each second
  await page.screenshot({
    path: 'screenshots/fullscreen_timer_takeover_during_countdown_and_finished/countdown_takeover.png',
  });

  // During takeover, match cards should not be visible
  await expect(matchCards).toHaveCount(0);

  // Timer digits should still be visible inside the takeover
  const timerUrgent = page.locator('[class*="timerUrgent"]');
  await expect(timerUrgent).toBeVisible({ timeout: 5_000 });
  await page.screenshot({
    path: 'screenshots/fullscreen_timer_takeover_during_countdown_and_finished/countdown_urgent.png',
  });

  // Wait for "Spiel vorbei!" finished state
  const finishedText = page.locator('[class*="timerFinished"]');
  await expect(finishedText).toBeVisible({ timeout: 15_000 });
  await expect(finishedText).toContainText('Spiel vorbei!');

  // Use direct screenshot — finishedPulse animation is infinite
  await page.screenshot({
    path: 'screenshots/fullscreen_timer_takeover_during_countdown_and_finished/finished_takeover.png',
  });

  // After ~10s the finished display should disappear and matches return
  await expect(matchCards.first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'screenshots/fullscreen_timer_takeover_during_countdown_and_finished/back_to_normal.png',
  });
});

test('Beamer timer syncs sound files and fires confetti on finish', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installBeamerEffectSpies(page);
  await page.addInitScript(() => {
    (window as any).__blockBeamerAudioUntilInteraction = true;
  });

  const { tournament, client, fullscreenQuery } = await setupBeamerAndMatches(12, {
    timerSeconds: 20 * 60 + 25,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards.first()).toBeVisible({ timeout: 15_000 });
  await waitForActionCableSubscription(page, {
    channel: 'TournamentTimersChannel',
    tournament_id: tournament.id,
  });
  await keyframe(page, testInfo, 'effects_loaded');
  await waitForBeamerEffect(page, 'audio-permission-blocked');
  await expect(page.getByTestId('beamer-sound-unlock')).toBeVisible();
  await page.getByTestId('beamer-sound-unlock').click();
  await waitForBeamerEffect(page, 'audio-permission-allowed');
  await waitForBeamerEffect(page, 'sound', 'start-countdown', 1, 40_000);
  await waitForBeamerEffect(page, 'sound-started', 'start-countdown', 1, 40_000);
  await keyframe(page, testInfo, 'start_countdown_sound_synced');

  const midCue = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 10 * 60 + 10,
  });
  expectStatus(midCue, 200, 'start 10:10 cue timer');
  await waitForBeamerEffect(page, 'sound', 'mid-game-warning', 1, 20_000);
  await keyframe(page, testInfo, 'mid_game_warning_sound');

  const endCue = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 12,
  });
  expectStatus(endCue, 200, 'start 00:10 cue timer');
  await waitForBeamerEffect(page, 'sound', 'end-countdown');

  const timerTakeover = page.locator('[class*="timerTakeover"]');
  await expect(timerTakeover).toBeVisible({ timeout: 8_000 });
  await keyframe(page, testInfo, 'end_countdown_sound_takeover');

  const finishedText = page.locator('[class*="timerFinished"]');
  await expect(finishedText).toBeVisible({ timeout: 15_000 });
  await waitForBeamerEffect(page, 'confetti', undefined, 3);
  await keyframe(page, testInfo, 'timer_finished_confetti');

  const effectEvents = await page.evaluate(() => (window as any).__beamerTimerEffects.events);
  const audioEvents = await page.evaluate(() => (window as any).__beamerAudioEvents);
  const soundCues = effectEvents
    .filter((event) => event.type === 'sound')
    .map((event) => event.cue);
  const audioPlayEvents = audioEvents.filter((event) => event.type === 'audio-play');
  const syncedStart = audioPlayEvents.find(
    (event) => event.src.includes('start_countdown.mp3'),
  );

  expect(soundCues).toEqual(expect.arrayContaining([
    'start-countdown',
    'mid-game-warning',
    'end-countdown',
  ]));
  expect(audioPlayEvents.map((event) => event.src)).toEqual(expect.arrayContaining([
    '/static/sounds/start_countdown.mp3',
    '/static/sounds/10_minute_warning.mp3',
    '/static/sounds/end_countdown.mp3',
  ]));
  expect(syncedStart).toBeTruthy();
  expect(syncedStart.currentTime).toBeGreaterThan(0);
  expect(effectEvents.some((event) => event.type === 'audio-permission-allowed')).toBeTruthy();
  expect(audioEvents.some((event) => event.type === 'audio-pause')).toBeTruthy();

  const finishStop = effectEvents.find(
    (event) => event.type === 'sound-stop' && event.reason === 'timer-finished',
  );
  const confetti = effectEvents.find((event) => event.type === 'confetti');
  expect(finishStop).toBeFalsy();
  expect(confetti).toBeTruthy();
  const confettiBursts = effectEvents.filter((event) => event.type === 'confetti');
  expect(confettiBursts.length).toBeGreaterThanOrEqual(3);
  expect(confettiBursts.every((event) => event.style === 'firework')).toBe(true);
  expect(confettiBursts.every((event) =>
    event.origin &&
    event.origin.x >= 0 &&
    event.origin.x <= 1 &&
    event.origin.y >= 0 &&
    event.origin.y <= 1,
  )).toBe(true);
  const uniqueOrigins = new Set(confettiBursts.map((event) =>
    `${event.origin.x.toFixed(3)}:${event.origin.y.toFixed(3)}`,
  ));
  expect(uniqueOrigins.size).toBeGreaterThan(1);
});

test('Beamer confetti does not fire when expired timer loads', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installBeamerEffectSpies(page);

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(4, {
    beamerName: 'timer-only-expired',
    displayState: 'timer_only',
    timerSeconds: 1,
  });

  await page.waitForTimeout(1_500);

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);
  await expect(page.getByTestId('timer-only-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Spiel vorbei!/)).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(1_000);
  expect(await countBeamerEffects(page, 'confetti')).toBe(0);
});

test('Timer-only beamer renders urgent timer without matches and keeps sound active', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installBeamerEffectSpies(page);

  const { tournament, client, fullscreenQuery } = await setupBeamerAndMatches(8, {
    timerSeconds: 12,
    timerReason: 'playoff_start',
    beamerName: 'timer-only',
    displayState: 'timer_only',
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  await expect(page.getByTestId('timer-only-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('timer-only-timer')).toBeVisible();
  await expect(page.getByTestId('timer-only-reason')).toHaveText('Playoff-Start');
  await expect(page.locator('[class*="timerUrgent"]')).toBeVisible();
  await expect(page.getByTestId('fullscreen-match-card')).toHaveCount(0);
  await expect(page.getByText(/keine laufenden Matches/i)).toHaveCount(0);
  await waitForBeamerEffect(page, 'sound', 'end-countdown');
  await keyframe(page, testInfo, 'timer_only_countdown_sound');

  const resetTimer = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 5 * 60,
    timer_reason: 'playoff_start',
  });
  expectStatus(resetTimer, 200, 'reset timer-only countdown');
  const hiddenReasonBeamer = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'timer-only-hidden-reason',
    display_state: 'during_game',
    config: { display_mode: 'timer_only', show_timer_reason: false },
    is_default: false,
  });
  expectStatus(hiddenReasonBeamer, 201, 'create timer-only hidden reason beamer');
  await page.goto(`/t/${tournament.id}/fullscreen?beamer=timer-only-hidden-reason`);
  await expect(page.getByTestId('timer-only-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('timer-only-timer')).toBeVisible();
  await expect(page.getByTestId('timer-only-reason')).toHaveCount(0);
  await keyframe(page, testInfo, 'timer_only_without_reason');
});

test('Animated fullscreen timer pads minutes after hours and days', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, client, fullscreenQuery } = await setupBeamerAndMatches(0, {
    timerSeconds: 5 * 60 * 60 + 3 * 60 + 30,
    beamerName: 'timer-leading-zero',
    displayState: 'timer_only',
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);
  await expect(page.getByTestId('timer-only-timer')).toBeVisible({ timeout: 20_000 });
  await expectAnimatedTimerText(page, 'timer-only-timer', /^5:03:\d{2}$/);

  const overDay = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 25 * 60 * 60 + 3 * 60 + 30,
  });
  expectStatus(overDay, 200, 'set over-day timer');

  await page.reload();
  await expect(page.getByTestId('timer-only-timer')).toBeVisible({ timeout: 20_000 });
  await expectAnimatedTimerText(page, 'timer-only-timer', /^25:03:\d{2}$/);
});

test.describe('Fullscreen mobile viewport', () => {
  const mobileDevice = devices['iPhone 13'];

  test.use({
    viewport: mobileDevice.viewport,
    userAgent: mobileDevice.userAgent,
    deviceScaleFactor: mobileDevice.deviceScaleFactor,
    isMobile: mobileDevice.isMobile,
    hasTouch: mobileDevice.hasTouch,
  });

  test('Audio unlock responds to mobile tap', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await installBeamerEffectSpies(page);
    await page.addInitScript(() => {
      (window as any).__blockBeamerAudioUntilInteraction = true;
    });

    const { tournament, client, fullscreenQuery } = await setupBeamerAndMatches(8, {
      timerSeconds: 19 * 60 + 43,
      beamerName: 'mobile-audio',
    });

    await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

    await expect(page.getByTestId('fullscreen-match-card').first()).toBeVisible({ timeout: 15_000 });
    await waitForBeamerEffect(page, 'audio-permission-blocked');

    const unlockButton = page.getByTestId('beamer-sound-unlock');
    await expect(unlockButton).toBeVisible();
    await keyframe(page, testInfo, 'mobile_audio_blocked');
    await page.waitForTimeout(3_000);

    await unlockButton.tap();
    await page.waitForFunction(
      () => {
        const events = (window as any).__beamerTimerEffects?.events || [];
        return events.some(
          (event) => event.type === 'audio-permission-allowed' && event.reason === 'manual-unlock',
        );
      },
      undefined,
      { timeout: 8_000 },
    );
    await expect(unlockButton).toHaveCount(0);
    await keyframe(page, testInfo, 'mobile_audio_unlocked');

    const midCue = await client.patch(`/tournaments/${tournament.id}/timer`, {
      timestamp_seconds: 10 * 60 + 4,
    });
    expectStatus(midCue, 200, 'start mobile 10:10 cue timer');
    await waitForBeamerEffect(page, 'sound-started', 'mid-game-warning');
    await expect(unlockButton).toHaveCount(0);
    await keyframe(page, testInfo, 'mobile_audio_next_cue_stays_unlocked');
  });

  test('Long timer stays readable in portrait', async ({ page }, testInfo) => {
    test.setTimeout(180_000);

    const { tournament, fullscreenQuery } = await setupBeamerAndMatches(8, {
      timerSeconds: 27 * 60 * 60 + 58 * 60 + 8,
      beamerName: 'mobile-long-timer',
    });

    await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

    await expect(page.getByTestId('fullscreen-match-card').first()).toBeVisible({ timeout: 15_000 });
    const timer = page.getByTestId('fullscreen-timer');
    await expect(timer).toBeVisible();
    await expectAnimatedTimerText(page, 'fullscreen-timer', /^27:\d{2}:\d{2}$/);
    await keyframe(page, testInfo, 'mobile_long_timer_fits');

    const timerBox = await timer.boundingBox();
    const viewport = page.viewportSize();
    expect(timerBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(timerBox!.x).toBeGreaterThanOrEqual(-1);
    expect(timerBox!.x + timerBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test('During-game match grid stays readable in portrait', async ({ page }, testInfo) => {
    test.setTimeout(180_000);

    const { tournament, fullscreenQuery } = await setupBeamerAndMatches(16, {
      beamerName: 'mobile-layout',
    });

    await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

    await expect(page.getByText('Kein Timer gesetzt')).toBeVisible({ timeout: 15_000 });
    const matchCards = page.getByTestId('fullscreen-match-card');
    await expect(matchCards).toHaveCount(8);
    await expect(page.getByTestId('fullscreen-page-dot')).toHaveCount(2);
    await keyframe(page, testInfo, 'mobile_portrait_matches');

    const layout = await matchCards.evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      }),
    );
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const columns = new Set(layout.map((box) => Math.round(box.x / 10) * 10));
    expect(columns.size).toBeLessThanOrEqual(2);
    expect(Math.min(...layout.map((box) => box.width))).toBeGreaterThan(150);
    expect(Math.min(...layout.map((box) => box.height))).toBeGreaterThan(48);
    expect(Math.max(...layout.map((box) => box.right))).toBeLessThanOrEqual(viewport!.width + 1);
    expect(Math.max(...layout.map((box) => box.bottom))).toBeLessThanOrEqual(viewport!.height + 1);

    const firstTeamName = page.getByTestId('fullscreen-team-name').first();
    await expect(firstTeamName).toBeVisible();
    const firstNameBox = await firstTeamName.boundingBox();
    expect(firstNameBox).not.toBeNull();
    expect(firstNameBox!.height).toBeGreaterThan(10);

    const scrollSize = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }));
    expect(scrollSize.width).toBeLessThanOrEqual(scrollSize.innerWidth + 1);
    expect(scrollSize.height).toBeLessThanOrEqual(scrollSize.innerHeight + 1);
  });
});

// ---------------------------------------------------------------------------
// Match grid layout tests — varying row counts
// ---------------------------------------------------------------------------

test('Match grid with 4 matches (1 row)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(4, {
    timerSeconds: 10 * 60,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards).toHaveCount(4);
  await keyframe(page, testInfo, 'grid_1_row_4_matches');

  // With only 1 row, cards should maintain aspect ratio and not stretch
  // Timer should take more space since fewer matches
  const timerContainer = page.locator('[class*="timerContainer"]');
  const timerBox = await timerContainer.boundingBox();
  expect(timerBox).not.toBeNull();

  // Timer should be significantly taller than minimum (> 30% of viewport)
  expect(timerBox!.height).toBeGreaterThan(1080 * 0.3);

  // No page indicator dots for single page
  const pageDots = page.getByTestId('fullscreen-page-dot');
  await expect(pageDots).toHaveCount(0);
});

test('Match grid with 8 matches (2 rows)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(8, {
    timerSeconds: 10 * 60,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards).toHaveCount(8);
  await keyframe(page, testInfo, 'grid_2_rows_8_matches');

  // No page indicator dots for single page
  const pageDots = page.getByTestId('fullscreen-page-dot');
  await expect(pageDots).toHaveCount(0);
});

test('Match grid with 12 matches (3 rows)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(12, {
    timerSeconds: 10 * 60,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards).toHaveCount(12);
  await keyframe(page, testInfo, 'grid_3_rows_12_matches');
});

test('Match grid with 16 matches (4 rows, full page)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(16, {
    timerSeconds: 10 * 60,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards).toHaveCount(16);
  await keyframe(page, testInfo, 'grid_4_rows_16_matches');

  // Timer should still be visible at its minimum height
  const timerContainer = page.locator('[class*="timerContainer"]');
  const timerBox = await timerContainer.boundingBox();
  expect(timerBox).not.toBeNull();
  expect(timerBox!.height).toBeGreaterThan(1080 * 0.15);

  // No page dots — exactly 16 fits one page
  const pageDots = page.getByTestId('fullscreen-page-dot');
  await expect(pageDots).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Page rotation for overflow
// ---------------------------------------------------------------------------

test('During-game view rotates match pages', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const { tournament, fullscreenQuery } = await setupBeamerAndMatches(30, {
    timerSeconds: 10 * 60,
  });

  await page.goto(`/t/${tournament.id}/fullscreen?${fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards.first()).toBeVisible({ timeout: 15_000 });
  await keyframe(page, testInfo, 'rotation_page1');

  // First page should show 16 matches (MATCHES_PER_PAGE)
  const firstPageCount = await matchCards.count();
  expect(firstPageCount).toBe(16);

  // Page indicator dots should be visible since we have overflow (30 > 16)
  const pageDots = page.getByTestId('fullscreen-page-dot');
  await expect(pageDots.first()).toBeVisible();

  const dotCount = await pageDots.count();
  expect(dotCount).toBe(2); // ceil(30/16) = 2

  const firstPageTexts = await matchCards.allInnerTexts();
  const firstPageTranslateX = await carouselTranslateX(page);
  expect(Math.abs(firstPageTranslateX)).toBeLessThan(1);
  expect(await activeCardAnimationName(page)).toContain('cardEnter');

  // Wait for the 10s page rotation cycle plus buffer
  await page.waitForTimeout(11_000);

  // Second page must show different matches
  const secondPageTexts = await matchCards.allInnerTexts();
  expect(firstPageTexts).not.toEqual(secondPageTexts);
  expect(await activeCardAnimationName(page)).toBe('none');

  // The whole batch slides left instead of re-playing per-card fly-in animations
  const secondPageTranslateX = await carouselTranslateX(page);
  expect(secondPageTranslateX).toBeLessThan(firstPageTranslateX - 100);

  // Second page should show the remaining 14 matches
  const secondPageCount = await matchCards.count();
  expect(secondPageCount).toBe(14);

  await keyframe(page, testInfo, 'rotation_page2');

  // End of the cycle slides back to the first batch without card fatigue
  await page.waitForTimeout(11_000);
  expect(await matchCards.allInnerTexts()).toEqual(firstPageTexts);
  expect(Math.abs(await carouselTranslateX(page))).toBeLessThan(1);
  expect(await activeCardAnimationName(page)).toBe('none');
});

// ---------------------------------------------------------------------------
// Card aspect ratio consistency
// ---------------------------------------------------------------------------

test('Cards maintain consistent aspect ratio across row counts', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Test with 4 matches (1 row) — cards should not stretch to fill all vertical space
  const setup4 = await setupBeamerAndMatches(4, {
    timerSeconds: 10 * 60,
    beamerName: 'ar-4',
  });

  await page.goto(`/t/${setup4.tournament.id}/fullscreen?${setup4.fullscreenQuery}`);

  const matchCards = page.getByTestId('fullscreen-match-card');
  await expect(matchCards).toHaveCount(4);

  const card4 = await matchCards.first().boundingBox();
  expect(card4).not.toBeNull();

  const ratio4 = card4!.width / card4!.height;

  await keyframe(page, testInfo, 'aspect_ratio_1_row');

  // Test with 16 matches (4 rows)
  const setup16 = await setupBeamerAndMatches(16, {
    timerSeconds: 10 * 60,
    beamerName: 'ar-16',
  });

  await page.goto(`/t/${setup16.tournament.id}/fullscreen?${setup16.fullscreenQuery}`);
  await expect(matchCards).toHaveCount(16);

  const card16 = await matchCards.first().boundingBox();
  expect(card16).not.toBeNull();

  const ratio16 = card16!.width / card16!.height;

  await keyframe(page, testInfo, 'aspect_ratio_4_rows');

  // Aspect ratios should be similar (within 30% tolerance)
  // Both should be ~5:1 from the CSS aspect-ratio property
  expect(Math.abs(ratio4 - ratio16) / ratio16).toBeLessThan(0.3);
});
