/**
 * TypeScript port of the seeding half of turniere-backend/e2e/lib/scenario_runner.rb.
 *
 * Creates tournaments and plays matches via the backend API so Playwright tests
 * can navigate to pre-seeded states without going through the browser UI.
 */

import { ApiClient, ApiError, expectStatus } from './api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

// ---------------------------------------------------------------------------
// Lightweight type aliases for the shapes returned by the backend
// ---------------------------------------------------------------------------

interface MatchScore {
  id: number;
  points: number | null;
  team: { id: number; name: string } | null;
}

interface Match {
  id: number;
  position: number;
  state: string;
  match_scores: MatchScore[];
  stage_level?: number; // attached by helpers, not from API
}

interface Group {
  id: number;
  number: number;
  matches: Match[];
}

interface Stage {
  id: number;
  level: number;
  state: string;
  groups: Group[];
  matches: Match[];
}

interface Tournament {
  id: number;
  code: string;
  name: string;
  stages: Stage[];
  teams: { id: number; name: string }[];
}

// ---------------------------------------------------------------------------
// Authenticated client factory
// ---------------------------------------------------------------------------

async function makeClient(): Promise<ApiClient> {
  const client = new ApiClient(backendUrl);
  const res = await client.login(e2eEmail, e2ePassword);
  expectStatus(res, 200, `login as ${e2eEmail}`);
  if (!client.isAuthenticated()) {
    throw new ApiError('Login succeeded but no auth headers returned', 200, res.json);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchTournament(client: ApiClient, id: number): Promise<Tournament> {
  const res = await client.get<Tournament>(`/tournaments/${id}`);
  expectStatus(res, 200, `fetch tournament ${id}`);
  return res.json;
}

async function fetchMatch(client: ApiClient, id: number): Promise<Match> {
  const res = await client.get<Match>(`/matches/${id}`);
  expectStatus(res, 200, `fetch match ${id}`);
  return res.json;
}

/** Determine the preferred winner name (first alphabetically by seed, then group, then name). */
function preferredWinner(match: Match): string {
  const names = match.match_scores
    .map((s) => s.team?.name)
    .filter((n): n is string => !!n);

  if (names.length === 0) return '';

  const seedOf = (n: string) => parseInt(n.match(/S(\d+)/)?.[1] ?? '999', 10);
  const groupOf = (n: string) => parseInt(n.match(/G(\d+)/)?.[1] ?? '999', 10);

  return names.sort((a, b) => {
    const sd = seedOf(a) - seedOf(b);
    if (sd !== 0) return sd;
    const gd = groupOf(a) - groupOf(b);
    if (gd !== 0) return gd;
    return a.localeCompare(b);
  })[0];
}

interface PlayResult {
  matchId: number;
  status: number;
}

async function playMatch(
  client: ApiClient,
  match: Match,
  opts: { expectedFinishStatus?: number } = {},
): Promise<PlayResult> {
  const expectedFinishStatus = opts.expectedFinishStatus ?? 200;

  const started = await client.patch(`/matches/${match.id}`, { state: 'in_progress' });
  expectStatus(started, 200, `start match ${match.id}`);

  const fresh = await fetchMatch(client, match.id);
  const winner = preferredWinner(fresh);

  for (const score of fresh.match_scores.sort((a, b) => a.id - b.id)) {
    const points = score.team?.name === winner ? 10 : 1;
    const updated = await client.patch(`/match_scores/${score.id}`, { points });
    expectStatus(updated, 200, `update match_score ${score.id}`);
  }

  const finished = await client.patch(`/matches/${match.id}`, { state: 'finished' });
  if (finished.status !== expectedFinishStatus) {
    throw new ApiError(
      `finish match ${match.id} failed: expected ${expectedFinishStatus}, got ${finished.status}`,
      finished.status,
      finished.json,
    );
  }

  return { matchId: match.id, status: finished.status };
}

function groupStageOf(tournament: Tournament): Stage {
  const stage = tournament.stages.find((s) => s.level === -1);
  if (!stage) throw new Error('Group stage not found in tournament');
  return stage;
}

function playoffMatches(tournament: Tournament): Match[] {
  return tournament.stages
    .filter((s) => s.level !== -1)
    .flatMap((s) => s.matches.map((m) => ({ ...m, stage_level: s.level })));
}

async function finishGroupStageMatches(client: ApiClient, tournament: Tournament): Promise<void> {
  const gs = groupStageOf(tournament);
  for (const group of gs.groups.sort((a, b) => a.number - b.number)) {
    for (const match of group.matches.sort((a, b) => a.position - b.position)) {
      await playMatch(client, match);
    }
  }
}

async function finishStage(client: ApiClient, stageId: number): Promise<void> {
  const res = await client.patch(`/stages/${stageId}`, { state: 'finished' });
  expectStatus(res, 200, `finish stage ${stageId}`);
}

async function runPlayoffsUntilBeforeFinal(client: ApiClient, tournamentId: number): Promise<void> {
  for (;;) {
    const tournament = await fetchTournament(client, tournamentId);
    const playable = playoffMatches(tournament)
      .filter((m) => m.stage_level !== 0 && m.state === 'not_started')
      .sort((a, b) => (b.stage_level ?? 0) - (a.stage_level ?? 0) || a.position - b.position);

    if (playable.length === 0) break;
    for (const m of playable) await playMatch(client, m);
  }
}

async function runPlayoffsToCompletion(client: ApiClient, tournamentId: number): Promise<void> {
  for (;;) {
    const tournament = await fetchTournament(client, tournamentId);
    const playable = playoffMatches(tournament)
      .filter((m) => m.state === 'not_started')
      .sort((a, b) => (b.stage_level ?? 0) - (a.stage_level ?? 0) || a.position - b.position);

    if (playable.length === 0) break;
    for (const m of playable) await playMatch(client, m);
  }
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function groupStagePayload(groupCount: number, teamsPerGroup: number, playoffTeamsAmount: number) {
  const teams = Array.from({ length: groupCount }, (_, gi) =>
    Array.from({ length: teamsPerGroup }, (__, si) => ({
      name: `G${gi + 1}-S${si + 1}`,
      group: gi,
    })),
  ).flat();

  return {
    name: `E2E Group ${groupCount}x${teamsPerGroup} ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Playwright E2E tournament',
    public: true,
    group_stage: true,
    playoff_teams_amount: playoffTeamsAmount,
    teams,
  };
}

function playoffOnlyPayload(teamCount: number) {
  return {
    name: `E2E Playoff ${teamCount} ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Playwright E2E tournament',
    public: false,
    teams: Array.from({ length: teamCount }, (_, i) => ({ name: `G0-S${i + 1}` })),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SeededTournament {
  tournament: Tournament;
  code: string;
}

/**
 * Create a group-stage tournament and return it — no matches played yet.
 * Default: 4 groups × 4 teams, 8 playoff spots.
 */
export async function seedGroupStageTournament(
  groupCount = 4,
  teamsPerGroup = 4,
  playoffTeamsAmount = 8,
): Promise<SeededTournament> {
  const client = await makeClient();
  const payload = groupStagePayload(groupCount, teamsPerGroup, playoffTeamsAmount);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create group stage tournament');

  const tournament = await fetchTournament(client, (created.json as { id: number }).id);
  return { tournament, code: tournament.code };
}

/**
 * Create a group-stage tournament, play all group matches, finish the group stage,
 * and return the tournament with playoffs populated.
 */
export async function seedAndPlayGroupStage(
  groupCount = 4,
  teamsPerGroup = 4,
  playoffTeamsAmount = 8,
): Promise<SeededTournament> {
  const client = await makeClient();
  const payload = groupStagePayload(groupCount, teamsPerGroup, playoffTeamsAmount);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create group stage tournament');

  let tournament = await fetchTournament(client, (created.json as { id: number }).id);

  await finishGroupStageMatches(client, tournament);

  const gs = groupStageOf(await fetchTournament(client, tournament.id));
  await finishStage(client, gs.id);

  tournament = await fetchTournament(client, tournament.id);
  return { tournament, code: tournament.code };
}

/**
 * Create a playoff-only tournament and return it — no matches played yet.
 */
export async function seedPlayoffTournament(teamCount = 8): Promise<SeededTournament> {
  const client = await makeClient();
  const payload = playoffOnlyPayload(teamCount);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create playoff tournament');

  const tournament = await fetchTournament(client, (created.json as { id: number }).id);
  return { tournament, code: tournament.code };
}

/**
 * Create a group-stage tournament, play all group matches, finish group stage,
 * then play all playoff matches up to (but not including) the final.
 */
export async function seedGroupStageAndRunToBeforeFinal(
  groupCount = 4,
  teamsPerGroup = 4,
  playoffTeamsAmount = 8,
): Promise<SeededTournament> {
  const client = await makeClient();
  const payload = groupStagePayload(groupCount, teamsPerGroup, playoffTeamsAmount);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create group stage tournament');

  let tournament = await fetchTournament(client, (created.json as { id: number }).id);

  await finishGroupStageMatches(client, tournament);
  const gs = groupStageOf(await fetchTournament(client, tournament.id));
  await finishStage(client, gs.id);

  await runPlayoffsUntilBeforeFinal(client, tournament.id);

  tournament = await fetchTournament(client, tournament.id);
  return { tournament, code: tournament.code };
}

/**
 * Create a playoff-only tournament and play all matches to completion.
 */
export async function seedAndPlayToCompletion(teamCount = 8): Promise<SeededTournament> {
  const client = await makeClient();
  const payload = playoffOnlyPayload(teamCount);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create playoff tournament');

  const { id } = created.json as { id: number };
  await runPlayoffsToCompletion(client, id);

  const tournament = await fetchTournament(client, id);
  return { tournament, code: tournament.code };
}
