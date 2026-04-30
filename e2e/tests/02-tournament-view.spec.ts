import { test, expect, type Locator, type Page } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import {
  seedGroupStageTournament,
  seedAndPlayGroupStage,
  seedGroupStageAndRunToBeforeFinal,
  finishGroupStageForTournament,
  longGroupStageTeamName,
} from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(600_000);

type MatchForCardSurface = {
  id: number;
  state: string;
  position: number;
  match_scores: Array<{ id: number; team: { id: number; name: string } | null }>;
};

async function scrollToLocator(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.page().waitForTimeout(250);
}

async function showAllTournamentMatches(page: Page) {
  const showButtons = page.getByRole('button', { name: 'Matches einblenden' });
  await expect(showButtons.first()).toBeVisible({ timeout: 120000 });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const count = await showButtons.count();
    if (count === 0) {
      return;
    }

    await showButtons.evaluateAll((buttons) => {
      buttons.forEach((button) => (button as HTMLElement).click());
    });

    await expect.poll(
      () => showButtons.count(),
      { timeout: 5000 },
    ).toBeLessThan(count);
  }
  await expect(showButtons).toHaveCount(0);
}

async function expectMatchCardToUseSingleSurface(card: Locator) {
  const metric = await card.evaluate((cardElement) => {
    const body = cardElement.querySelector('.card-body');
    const table = cardElement.querySelector('table');
    const badge = cardElement.querySelector('.badge');
    if (!body || !table || !badge) {
      return null;
    }

    const cardRect = cardElement.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(body);
    const tableStyle = window.getComputedStyle(table);
    const cellBackgrounds = Array.from(table.querySelectorAll('th, td'))
      .map((cell) => window.getComputedStyle(cell).backgroundColor);
    const horizontalPadding = parseFloat(bodyStyle.paddingLeft) + parseFloat(bodyStyle.paddingRight);

    return {
      bodyBackground: bodyStyle.backgroundColor,
      tableBackground: tableStyle.backgroundColor,
      cellBackgrounds,
      cardWidth: cardRect.width,
      bodyWidth: bodyRect.width,
      tableWidth: tableRect.width,
      badgeWidth: badgeRect.width,
      horizontalPadding,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  expect(metric).not.toBeNull();
  expect(metric!.bodyBackground).not.toBe('rgb(255, 255, 255)');
  expect(metric!.tableBackground).toBe('rgba(0, 0, 0, 0)');
  for (const background of metric!.cellBackgrounds) {
    expect(background).toBe('rgba(0, 0, 0, 0)');
  }
  expect(metric!.tableWidth / metric!.bodyWidth).toBeGreaterThan(0.86);
  expect(metric!.badgeWidth / metric!.cardWidth).toBeLessThan(0.28);
  expect(metric!.horizontalPadding).toBeLessThanOrEqual(32);
  expect(metric!.documentOverflow).toBeLessThanOrEqual(1);
}

async function prepareRunningAndFinishedLongNameMatches(
  client: ApiClient,
  tournamentId: number,
): Promise<{ running: MatchForCardSurface; finished: MatchForCardSurface }> {
  const matchesRes = await client.get<MatchForCardSurface[]>(`/tournaments/${tournamentId}/matches`);
  expectStatus(matchesRes, 200, 'fetch long-name tournament matches');

  const playable = matchesRes.json
    .filter((match) => match.state === 'not_started' && match.match_scores.length === 2)
    .sort((a, b) => a.position - b.position);
  expect(playable.length).toBeGreaterThanOrEqual(2);

  const finished = playable[0];
  const running = playable[1];

  const startFinished = await client.patch(`/matches/${finished.id}`, { state: 'in_progress' });
  expectStatus(startFinished, 200, 'start long-name finished match');
  for (const score of finished.match_scores) {
    const points = score.id === finished.match_scores[0].id ? 10 : 7;
    const updated = await client.patch(`/match_scores/${score.id}`, { points });
    expectStatus(updated, 200, `update long-name score ${score.id}`);
  }
  const finishMatch = await client.patch(`/matches/${finished.id}`, { state: 'finished' });
  expectStatus(finishMatch, 200, 'finish long-name match');

  const startRunning = await client.patch(`/matches/${running.id}`, { state: 'in_progress' });
  expectStatus(startRunning, 200, 'start long-name running match');

  return { running, finished };
}

function statusText(page: Page, text: string | RegExp) {
  const matcher = typeof text === 'string'
    ? new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
    : text;
  return page.locator('small.text-muted').filter({ hasText: matcher }).last();
}

test('Tournament id view renders basic information while full tournament loads', async ({ page }) => {
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  let sawMetaRequest = false;
  let sawFullRequest = false;
  let releaseFullTournament: (() => void) | null = null;
  const fullTournamentBlocked = new Promise<void>((resolve) => {
    releaseFullTournament = resolve;
  });

  await page.route(new RegExp(`/tournaments/${tournament.id}(\\?.*)?$`), async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('simple') === 'true') {
      sawMetaRequest = true;
      await route.continue();
      return;
    }

    sawFullRequest = true;
    await fullTournamentBlocked;
    await route.continue();
  });

  await page.addInitScript(() => {
    const ClosedWebSocket = class extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = ClosedWebSocket.CLOSED;

      send() { }
      close() { }
    };

    (window as any).WebSocket = ClosedWebSocket;
  });

  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.big-image')).toContainText(tournament.name, { timeout: 120000 });
  await expect(page.getByRole('button', { name: 'Statistiken' })).toBeVisible();
  await expect(page.getByTestId('tournament-favorites-loading')).toBeVisible();
  await expect(page.getByTestId('tournament-details-loading')).toBeVisible();
  expect(sawMetaRequest).toBe(true);
  await expect.poll(() => sawFullRequest, { timeout: 10000 }).toBe(true);

  releaseFullTournament?.();
  await expect(page.getByTestId('tournament-details-loading')).toHaveCount(0, { timeout: 120000 });
  await expect(page.getByTestId('tournament-favorites-loading')).toHaveCount(0);
  await expect(page.getByText(/Gruppe/i).first()).toBeVisible();
});

test('Public tournament view renders group-stage and playoff data', async ({ page }, testInfo) => {
  // --- Seed: create group-stage tournament (4 groups × 4 teams, 8 playoff spots) ---
  const { tournament } = await seedGroupStageTournament(4, 4, 8);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  const timer = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 20 * 60,
    timer_reason: 'custom',
    timer_reason_text: 'Final-Call',
  });
  expectStatus(timer, 200, 'set tournament-page timer reason');

  // --- Step 1: fresh tournament page ---
  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.big-image')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('li').filter({ hasText: /Final-Call:/ }).first())
    .toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Spielzeit:/i)).toHaveCount(0);

  await keyframe(page, testInfo, 'tournament_created');
  await keyframe(page, testInfo, 'tournament_timer_reason_running');

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

test('Tournament view match badges show group-local positions', async ({ page }) => {
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const groupStage = tournament.stages.find((stage) => stage.level === -1);
  const firstGroup = groupStage?.groups[0];
  const groupMatch = firstGroup?.matches.slice().sort((a, b) => a.position - b.position)[0];
  expect(groupMatch).toBeTruthy();

  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.big-image')).toBeVisible({ timeout: 120000 });
  await page.getByRole('button', { name: 'Matches einblenden' }).first().click();

  const groupCard = page.locator(`[data-match-id="${groupMatch!.id}"]`);
  await expect(groupCard).toBeVisible({ timeout: 20_000 });
  const groupBadge = groupCard.getByTestId('match-position-badge');
  await expect(groupBadge).toHaveText(String(groupMatch!.position + 1));
  await expect(groupBadge).toHaveAttribute('data-match-badge-kind', 'position');
  await expect(groupCard.getByTestId('match-position-badge-group')).toHaveCount(0);

  const { tournament: playoffTournament } = await seedAndPlayGroupStage(2, 4, 4);
  const playoffMatch = playoffTournament.stages
    .filter((stage) => stage.level !== -1)
    .flatMap((stage) => stage.matches)
    .filter((match) => match.state === 'not_started' && match.match_scores.every((score) => score.team))
    .sort((a, b) => a.position - b.position)[0];
  expect(playoffMatch).toBeTruthy();

  await page.goto(`/t/${playoffTournament.id}`);
  await expect(page.locator('.stages').first()).toBeVisible({ timeout: 120000 });

  const playoffBadge = page
    .locator(`[data-match-id="${playoffMatch!.id}"]`)
    .getByTestId('match-position-badge');
  await expect(playoffBadge).toHaveText(String(playoffMatch!.position + 1));
  await expect(playoffBadge).toHaveAttribute('data-match-badge-kind', 'position');
});

test('Tournament match cards render all visible states as solid cards', async ({ page }, testInfo) => {
  const { tournament } = await seedAndPlayGroupStage(2, 4, 4);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);

  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.stages').first()).toBeVisible({ timeout: 120000 });
  const notStartedStatus = statusText(page, 'Spiel kann gestartet werden');
  await expect(notStartedStatus).toBeVisible();
  await expect(statusText(page, 'Spiel kann noch nicht gestartet werden')).toBeVisible();
  await scrollToLocator(notStartedStatus);
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
  const runningStatus = statusText(page, 'Spiel läuft');
  await expect(runningStatus).toBeVisible({ timeout: 10000 });
  await scrollToLocator(runningStatus);
  await keyframe(page, testInfo, 'match_cards_in_progress');

  for (const score of running.match_scores) {
    const points = score.id === running.match_scores[0].id ? 10 : 1;
    const updated = await client.patch(`/match_scores/${score.id}`, { points });
    expectStatus(updated, 200, `update score ${score.id} for finished card screenshot`);
  }
  const finished = await client.patch(`/matches/${running.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish match for finished card screenshot');

  await page.reload();
  const finishedStatus = statusText(page, /Gewinner:/);
  await expect(finishedStatus).toBeVisible({ timeout: 10000 });
  await scrollToLocator(finishedStatus);
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
  const byeStatus = statusText(page, 'kein Gegner, Team kommt weiter');
  await expect(byeStatus).toBeVisible({ timeout: 120000 });
  await scrollToLocator(byeStatus);
  await keyframe(page, testInfo, 'match_cards_single_team');
});

test('Tournament match cards use one surface for active long-name cards', async ({ page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(4, 4, 8, longGroupStageTeamName);
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  const { running, finished } = await prepareRunningAndFinishedLongNameMatches(client, tournament.id);
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/t/${tournament.id}`);
    await expect(page.locator('.stages').first()).toBeVisible({ timeout: 120000 });
    await showAllTournamentMatches(page);

    const runningCard = page.locator(`[data-match-id="${running.id}"]`);
    await expect(runningCard).toBeVisible();
    await expect(runningCard).toHaveAttribute('data-match-state', 'in_progress');
    await scrollToLocator(runningCard);
    await expect(statusText(page, 'Spiel läuft')).toBeVisible();
    await expectMatchCardToUseSingleSurface(runningCard);
    await keyframe(page, testInfo, `match_cards_one_surface_running_${viewport.name}`);

    const finishedCard = page.locator(`[data-match-id="${finished.id}"]`);
    await expect(finishedCard).toBeVisible();
    await expect(finishedCard).toHaveAttribute('data-match-state', 'finished');
    await scrollToLocator(finishedCard);
    await expect(statusText(page, /Gewinner:/)).toBeVisible();
    await expectMatchCardToUseSingleSurface(finishedCard);
    await keyframe(page, testInfo, `match_cards_one_surface_finished_${viewport.name}`);
  }
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
  await showAllTournamentMatches(page);

  const matchCard = page.locator(`[data-match-id="${match!.id}"]`);
  await expect(matchCard).toBeVisible({ timeout: 15_000 });
  await expect(matchCard).toContainText('0');
  await keyframe(page, testInfo, 'live_tournament_initial');

  const started = await client.patch(`/matches/${match!.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start match for live tournament view');
  await expect(statusText(page, 'Spiel läuft')).toBeVisible({ timeout: 60_000 });

  const displayedTeamNames = await matchCard.locator('td').allInnerTexts();
  const firstDisplayedScore = match!.match_scores.find((score) => score.team?.name === displayedTeamNames[0].trim());
  const secondDisplayedScore = match!.match_scores.find((score) => score.team?.name === displayedTeamNames[1].trim());
  expect(firstDisplayedScore).toBeTruthy();
  expect(secondDisplayedScore).toBeTruthy();

  const firstScore = await client.patch(`/match_scores/${firstDisplayedScore!.id}`, { points: 7 });
  expectStatus(firstScore, 200, 'update first score for live tournament view');
  const secondScore = await client.patch(`/match_scores/${secondDisplayedScore!.id}`, { points: 3 });
  expectStatus(secondScore, 200, 'update second score for live tournament view');
  await expect.poll(
    async () => (await matchCard.locator('th').allInnerTexts()).sort().join(','),
    { timeout: 60_000 },
  ).toBe('3,7');
  await keyframe(page, testInfo, 'live_tournament_scores');

  const finished = await client.patch(`/matches/${match!.id}`, { state: 'finished' });
  expectStatus(finished, 200, 'finish match for live tournament view');
  await expect(page.getByText(new RegExp(`Gewinner: ${firstDisplayedScore!.team!.name}`))).toBeVisible({
    timeout: 60_000,
  });
  await keyframe(page, testInfo, 'live_tournament_finished');
});

test('Tournament view loads playoff bracket from live tournament snapshot', async ({ page }) => {
  const { tournament } = await seedGroupStageTournament(2, 4, 4);

  await page.goto(`/t/${tournament.id}`);
  await expect(page.locator('.big-image')).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Gruppe/i).first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole('heading', { name: 'Halbfinale', exact: true })).toHaveCount(0);

  const { tournament: updatedTournament } = await finishGroupStageForTournament(tournament.id);
  expect(updatedTournament.stages.some((stage) => stage.level !== -1)).toBe(true);

  await expect(page.getByRole('heading', { name: 'Halbfinale', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[data-match-state="not_started"]').first())
    .toBeVisible();
});
