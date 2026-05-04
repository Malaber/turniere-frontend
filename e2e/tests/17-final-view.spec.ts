import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { waitForActionCableSubscription } from '../helpers/action-cable';
import { ApiClient, ApiResponse, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

type FinalMatch = {
  id: number;
  position: number;
  state: string;
  match_scores: Array<{
    id: number;
    points: number | null;
    team: { id: number; name: string } | null;
  }>;
};

type Tournament = {
  id: number;
  code: string;
  name: string;
  stages: Array<{
    id: number;
    level: number;
    matches: FinalMatch[];
  }>;
};

test.setTimeout(180_000);

async function authenticatedClient(): Promise<ApiClient> {
  const client = new ApiClient(backendUrl);
  const login = await client.login(e2eEmail, e2ePassword);
  expectStatus(login, 200, `login as ${e2eEmail}`);
  return client;
}

async function retryAuth<T>(
  client: ApiClient,
  action: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  const response = await action();
  if (response.status !== 401) return response;

  const login = await client.login(e2eEmail, e2ePassword);
  expectStatus(login, 200, `refresh login as ${e2eEmail}`);
  return action();
}

async function fetchTournament(client: ApiClient, tournamentId: number): Promise<Tournament> {
  const tournament = await retryAuth(client, () => client.get<Tournament>(`/tournaments/${tournamentId}`));
  expectStatus(tournament, 200, `fetch tournament ${tournamentId}`);
  return tournament.json;
}

async function fetchMatch(client: ApiClient, matchId: number): Promise<FinalMatch> {
  const match = await retryAuth(client, () => client.get<FinalMatch>(`/matches/${matchId}`));
  expectStatus(match, 200, `fetch match ${matchId}`);
  return match.json;
}

async function patchOk(client: ApiClient, path: string, body: unknown, action: string): Promise<void> {
  const response = await retryAuth(client, () => client.patch(path, body));
  expectStatus(response, 200, action);
}

async function createPlayoffTournament(client: ApiClient): Promise<Tournament> {
  const created = await retryAuth(client, () => client.post<Tournament>('/tournaments', {
    name: `E2E Final ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Playwright final beamer tournament',
    public: true,
    teams: ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name) => ({ name })),
  }));
  expectStatus(created, 201, 'create playoff tournament');
  return fetchTournament(client, created.json.id);
}

async function playMatch(client: ApiClient, match: FinalMatch): Promise<string> {
  await patchOk(client, `/matches/${match.id}`, { state: 'in_progress' }, `start match ${match.id}`);
  const fresh = await fetchMatch(client, match.id);
  const sortedScores = fresh.match_scores
    .filter((score) => score.team)
    .sort((a, b) => a.id - b.id);
  const winnerName = sortedScores[0].team!.name;

  for (const [index, score] of sortedScores.entries()) {
    await patchOk(
      client,
      `/match_scores/${score.id}`,
      { points: index === 0 ? 10 : 4 },
      `score match score ${score.id}`,
    );
  }

  await patchOk(client, `/matches/${match.id}`, { state: 'finished' }, `finish match ${match.id}`);
  return winnerName;
}

async function seedPlayoffToBeforeFinal(client: ApiClient): Promise<Tournament> {
  const created = await createPlayoffTournament(client);
  const semifinalMatches = created.stages
    .filter((stage) => stage.level !== 0)
    .flatMap((stage) => stage.matches)
    .sort((a, b) => a.position - b.position);

  for (const match of semifinalMatches) {
    await playMatch(client, match);
  }

  return fetchTournament(client, created.id);
}

async function fetchFinalMatches(client: ApiClient, tournamentId: number): Promise<FinalMatch[]> {
  const matches = await client.get<FinalMatch[]>(
    `/tournaments/${tournamentId}/matches`,
    { stage_level: '0' },
  );
  expectStatus(matches, 200, 'fetch final-stage matches');
  return matches.json;
}

async function finishFinalMatch(client: ApiClient, match: FinalMatch): Promise<string> {
  return playMatch(client, match);
}

test('Final beamer shows timer, final, and optional third-place match', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const client = await authenticatedClient();
  const tournament = await seedPlayoffToBeforeFinal(client);

  const timerRes = await retryAuth(client, () => client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 7 * 60,
    timer_reason: 'playoff_start',
  }));
  expectStatus(timerRes, 200, 'set final timer');

  await page.goto(`/t/${tournament.id}/fullscreen?display=final`);
  await expect(page.getByTestId('final-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('final-timer')).toContainText(/Playoff-Start/);
  await expect(page.getByTestId('final-match-card')).toBeVisible();
  await expect(page.getByTestId('third-place-match-card')).toBeVisible();
  await expect(page.getByTestId('final-title')).toContainText('Finale');
  await expect(page.getByTestId('final-subtitle')).toContainText(tournament.name);

  const [finalBox, thirdBox] = await Promise.all([
    page.getByTestId('final-match-card').boundingBox(),
    page.getByTestId('third-place-match-card').boundingBox(),
  ]);
  expect(finalBox).toBeTruthy();
  expect(thirdBox).toBeTruthy();
  expect(finalBox!.width * finalBox!.height).toBeGreaterThan(thirdBox!.width * thirdBox!.height * 1.8);

  await keyframe(page, testInfo, 'final_beamer_before_finish');
});

test('Final beamer can hide third-place match through beamer config', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const client = await authenticatedClient();
  const tournament = await seedPlayoffToBeforeFinal(client);

  const beamer = await retryAuth(client, () => client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'final-only',
    display_state: 'between_games',
    config: { display_mode: 'final', show_third_place: false },
    is_default: false,
  }));
  expectStatus(beamer, 201, 'create final-only beamer');

  await page.goto(`/t/${tournament.id}/fullscreen?beamer=final-only`);
  await expect(page.getByTestId('final-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('final-match-card')).toBeVisible();
  await expect(page.getByTestId('third-place-match-card')).toHaveCount(0);
});

test('Final beamer fires fireworks and shows winner medal when final ends', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const client = await authenticatedClient();
  const tournament = await seedPlayoffToBeforeFinal(client);
  const finalMatches = await fetchFinalMatches(client, tournament.id);
  const finalMatch = finalMatches.find((match) => match.position !== 1) ?? finalMatches[0];

  await page.goto(`/t/${tournament.id}/final`);
  await expect(page.getByTestId('final-view')).toBeVisible({ timeout: 20_000 });
  await waitForActionCableSubscription(page, {
    channel: 'TournamentMatchesChannel',
    tournament_id: tournament.id,
    stage_level: 0,
  });

  const winnerName = await finishFinalMatch(client, finalMatch);

  await expect(page.getByTestId('final-winner-panel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('final-winner-name')).toHaveText(winnerName);
  await expect(page.getByTestId('final-winner-medal')).toHaveAttribute(
    'src',
    /\/static\/images\/logo-questionmark\.png$/,
  );
  await expect
    .poll(async () => page.evaluate(() => {
      const events = (window as any).__beamerFinalView?.events ?? [];
      return events.filter((event: any) => event.type === 'confetti').length;
    }), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(3);

  await keyframe(page, testInfo, 'final_beamer_winner_fireworks');
});
