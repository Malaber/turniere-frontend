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
  hidden_points?: number | null;
  team: { id: number; name: string } | null;
}

interface Match {
  id: number;
  position: number;
  state: string;
  decider?: boolean;
  match_scores: MatchScore[];
  stage_level?: number; // attached by helpers, not from API
}

interface Group {
  id: number;
  number: number;
  group_scores?: Array<{
    team: { id: number; name: string };
    ranking_decision?: {
      resolved_by: string;
      compared_with_team_id?: number | null;
      compared_with_team_name?: string | null;
      needs_decider_match: boolean;
      decider_match_id?: number | null;
    } | null;
  }>;
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

async function patchScores(
  client: ApiClient,
  match: Match,
  scoresByTeamName: Record<string, number>,
  scoreField: 'points' | 'hidden_points' = 'points',
): Promise<void> {
  for (const score of match.match_scores.sort((a, b) => a.id - b.id)) {
    const teamName = score.team?.name;
    if (!teamName || scoresByTeamName[teamName] === undefined) {
      throw new Error(`Missing score for team ${teamName ?? 'unknown'} in match ${match.id}`);
    }
    const updated = await client.patch(`/match_scores/${score.id}`, { [scoreField]: scoresByTeamName[teamName] });
    expectStatus(updated, 200, `update ${scoreField} for match_score ${score.id}`);
  }
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

async function playMatchWithExactScores(
  client: ApiClient,
  match: Match,
  scoresByTeamName: Record<string, number>,
  scoreField: 'points' | 'hidden_points' = 'points',
): Promise<PlayResult> {
  const started = await client.patch(`/matches/${match.id}`, { state: 'in_progress' });
  expectStatus(started, 200, `start match ${match.id}`);

  const fresh = await fetchMatch(client, match.id);
  await patchScores(client, fresh, scoresByTeamName, scoreField);

  const finished = await client.patch(`/matches/${match.id}`, { state: 'finished' });
  expectStatus(finished, 200, `finish match ${match.id}`);

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
  for (; ;) {
    const tournament = await fetchTournament(client, tournamentId);
    const playable = playoffMatches(tournament)
      .filter((m) => m.stage_level !== 0 && m.state === 'not_started')
      .sort((a, b) => (b.stage_level ?? 0) - (a.stage_level ?? 0) || a.position - b.position);

    if (playable.length === 0) break;
    for (const m of playable) await playMatch(client, m);
  }
}

async function runPlayoffsToCompletion(client: ApiClient, tournamentId: number): Promise<void> {
  for (; ;) {
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

interface DeciderScenario extends SeededTournament {
  groupId: number;
  stageId: number;
  relevantTeamNames: [string, string];
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

export async function seedRelevantDeciderScenario(): Promise<DeciderScenario> {
  const client = await makeClient();
  const payload = groupStagePayload(1, 4, 2);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create relevant decider scenario tournament');

  let tournament = await fetchTournament(client, (created.json as { id: number }).id);
  const groupStage = groupStageOf(tournament);
  const group = groupStage.groups[0];
  if (!group) {
    throw new Error('Expected a group in the relevant decider scenario');
  }

  const matchByTeams = (teamA: string, teamB: string): Match => {
    const match = group.matches.find((candidate) => {
      const names = candidate.match_scores.map((score) => score.team?.name).filter((name): name is string => !!name);
      return names.includes(teamA) && names.includes(teamB);
    });
    if (!match) {
      throw new Error(`Could not find match for ${teamA} vs ${teamB}`);
    }
    return match;
  };

  await playMatchWithExactScores(client, matchByTeams('G1-S1', 'G1-S2'), { 'G1-S1': 3, 'G1-S2': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S1', 'G1-S3'), { 'G1-S1': 3, 'G1-S3': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S1', 'G1-S4'), { 'G1-S1': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S2', 'G1-S3'), { 'G1-S2': 2, 'G1-S3': 2 });
  await playMatchWithExactScores(client, matchByTeams('G1-S2', 'G1-S4'), { 'G1-S2': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S3', 'G1-S4'), { 'G1-S3': 3, 'G1-S4': 1 });

  tournament = await fetchTournament(client, tournament.id);

  return {
    tournament,
    code: tournament.code,
    groupId: group.id,
    stageId: groupStage.id,
    relevantTeamNames: ['G1-S2', 'G1-S3'],
  };
}

export async function seedResolvedDeciderScenario(): Promise<DeciderScenario> {
  const client = await makeClient();
  const seeded = await seedRelevantDeciderScenario();

  const createDecider = await client.post(`/groups/${seeded.groupId}/matches`, {
    team_ids: seeded.tournament.teams
      .filter((team) => seeded.relevantTeamNames.includes(team.name))
      .map((team) => team.id),
  });
  expectStatus(createDecider, 201, `create decider match for group ${seeded.groupId}`);

  let tournament = await fetchTournament(client, seeded.tournament.id);
  const deciderMatch = groupStageOf(tournament).groups[0]?.matches.find((match) => match.decider);
  if (!deciderMatch) {
    throw new Error('Expected a decider match after creating one');
  }

  await playMatchWithExactScores(
    client,
    deciderMatch,
    {
      [seeded.relevantTeamNames[0]]: 3,
      [seeded.relevantTeamNames[1]]: 5,
    },
    'hidden_points',
  );

  tournament = await fetchTournament(client, seeded.tournament.id);

  return {
    tournament,
    code: tournament.code,
    groupId: seeded.groupId,
    stageId: seeded.stageId,
    relevantTeamNames: seeded.relevantTeamNames,
  };
}

export async function seedIrrelevantTieScenario(): Promise<SeededTournament> {
  const client = await makeClient();
  const payload = groupStagePayload(1, 4, 2);

  const created = await client.post<Tournament>('/tournaments', payload);
  expectStatus(created, 201, 'create irrelevant tie scenario tournament');

  let tournament = await fetchTournament(client, (created.json as { id: number }).id);
  const group = groupStageOf(tournament).groups[0];
  if (!group) {
    throw new Error('Expected a group in the irrelevant tie scenario');
  }

  const matchByTeams = (teamA: string, teamB: string): Match => {
    const match = group.matches.find((candidate) => {
      const names = candidate.match_scores.map((score) => score.team?.name).filter((name): name is string => !!name);
      return names.includes(teamA) && names.includes(teamB);
    });
    if (!match) {
      throw new Error(`Could not find match for ${teamA} vs ${teamB}`);
    }
    return match;
  };

  await playMatchWithExactScores(client, matchByTeams('G1-S1', 'G1-S2'), { 'G1-S1': 3, 'G1-S2': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S1', 'G1-S3'), { 'G1-S1': 3, 'G1-S3': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S1', 'G1-S4'), { 'G1-S1': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S2', 'G1-S3'), { 'G1-S2': 3, 'G1-S3': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S2', 'G1-S4'), { 'G1-S2': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams('G1-S3', 'G1-S4'), { 'G1-S3': 2, 'G1-S4': 2 });

  tournament = await fetchTournament(client, tournament.id);
  return { tournament, code: tournament.code };
}

export async function seedReadOnlyFollowerTournament(): Promise<SeededTournament> {
  const client = await makeClient();
  const created = await client.post<Tournament>('/tournaments', playoffOnlyPayload(4));
  expectStatus(created, 201, 'create base tournament for read only follower');

  const tournamentId = (created.json as { id: number }).id;
  const updated = await client.patch<Tournament>(`/tournaments/${tournamentId}`, {
    read_only_mode: true,
    sync_auth_token: 'shared-secret',
  });
  expectStatus(updated, 200, 'enable read only mode on follower tournament');

  const tournament = await fetchTournament(client, tournamentId);
  return { tournament, code: tournament.code };
}

export async function seedLeaderFollowerSyncPair(): Promise<{
  leader: Tournament;
  follower: Tournament;
  syncToken: string;
}> {
  const client = await makeClient();
  const syncToken = `playwright-sync-${Date.now()}`;

  const leaderCreated = await client.post<Tournament>('/tournaments', groupStagePayload(2, 4, 4));
  expectStatus(leaderCreated, 201, 'create leader tournament for sync pair');
  const leaderId = (leaderCreated.json as { id: number }).id;

  const followerCreated = await client.post<Tournament>('/tournaments', {
    name: `Follower ${Date.now()}`,
    public: false,
    read_only_mode: true,
    sync_auth_token: syncToken
  });
  expectStatus(followerCreated, 201, 'create follower tournament for sync pair');
  const followerId = (followerCreated.json as { id: number }).id;

  const syncTargetUrl = `${backendUrl}/tournaments/${followerId}/sync_state`;
  const leaderConfigured = await client.patch<Tournament>(`/tournaments/${leaderId}`, {
    sync_target_url: syncTargetUrl,
    sync_auth_token: syncToken,
  });
  expectStatus(leaderConfigured, 200, 'configure leader sync pair');

  const leader = await fetchTournament(client, leaderId);
  const follower = await fetchTournament(client, followerId);
  return { leader, follower, syncToken };
}
