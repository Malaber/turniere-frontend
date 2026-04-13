const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://127.0.0.1:3000';
const frontendUrl = process.env.TURNIERE_FRONTEND_URL ?? 'http://127.0.0.1:3001';
const email = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const password = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

class ApiClient {
  static REQUEST_TIMEOUT_MS = 120_000;

  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.authHeaders = {};
  }

  async login(emailAddress, passwordValue) {
    const response = await this.request('POST', '/users/sign_in', { email: emailAddress, password: passwordValue });
    this.storeAuthHeaders(response.headers);
    return response;
  }

  async get(path) {
    return this.request('GET', path);
  }

  async post(path, body) {
    return this.request('POST', path, body);
  }

  async patch(path, body) {
    return this.request('PATCH', path, body);
  }

  async request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...this.authHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(ApiClient.REQUEST_TIMEOUT_MS),
    });

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let json = {};
    try {
      const text = await response.text();
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    return { status: response.status, headers, json };
  }

  storeAuthHeaders(headers) {
    const nextHeaders = {};
    for (const key of ['access-token', 'client', 'uid']) {
      if (headers[key]) nextHeaders[key] = headers[key];
    }
    if (Object.keys(nextHeaders).length > 0) {
      this.authHeaders = nextHeaders;
    }
  }
}

function expectStatus(response, expected, action) {
  if (response.status !== expected) {
    throw new ApiError(`${action} failed: expected ${expected}, got ${response.status}`, response.status, response.json);
  }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function groupStagePayload(namePrefix) {
  return {
    name: `${namePrefix} ${randomSuffix()}`,
    description: 'Manual modal test scenario',
    public: true,
    group_stage: true,
    playoff_teams_amount: 2,
    teams: [
      { name: 'G1-S1', group: 0 },
      { name: 'G1-S2', group: 0 },
      { name: 'G1-S3', group: 0 },
      { name: 'G1-S4', group: 0 },
    ],
  };
}

async function makeClient() {
  const client = new ApiClient(backendUrl);
  const loginResponse = await client.login(email, password);
  expectStatus(loginResponse, 200, `login as ${email}`);
  return client;
}

async function fetchTournament(client, tournamentId) {
  const response = await client.get(`/tournaments/${tournamentId}`);
  expectStatus(response, 200, `fetch tournament ${tournamentId}`);
  return response.json;
}

function groupStageOf(tournament) {
  const stage = tournament.stages.find((candidate) => candidate.level === -1);
  if (!stage) throw new Error('Group stage not found');
  return stage;
}

function firstGroup(tournament) {
  const group = groupStageOf(tournament).groups[0];
  if (!group) throw new Error('Group not found');
  return group;
}

function matchByTeams(group, teamA, teamB) {
  const match = group.matches.find((candidate) => {
    const names = candidate.match_scores.map((score) => score.team?.name).filter(Boolean);
    return names.includes(teamA) && names.includes(teamB);
  });
  if (!match) {
    throw new Error(`Could not find match for ${teamA} vs ${teamB}`);
  }
  return match;
}

async function fetchMatch(client, matchId) {
  const response = await client.get(`/matches/${matchId}`);
  expectStatus(response, 200, `fetch match ${matchId}`);
  return response.json;
}

async function patchScores(client, match, scoresByTeamName, scoreField = 'points') {
  for (const score of [...match.match_scores].sort((a, b) => a.id - b.id)) {
    const teamName = score.team?.name;
    if (!teamName || scoresByTeamName[teamName] === undefined) {
      throw new Error(`Missing ${scoreField} for ${teamName ?? 'unknown'} in match ${match.id}`);
    }
    const response = await client.patch(`/match_scores/${score.id}`, { [scoreField]: scoresByTeamName[teamName] });
    expectStatus(response, 200, `update ${scoreField} for match_score ${score.id}`);
  }
}

async function playMatchWithExactScores(client, match, scoresByTeamName, scoreField = 'points') {
  const started = await client.patch(`/matches/${match.id}`, { state: 'in_progress' });
  expectStatus(started, 200, `start match ${match.id}`);

  const freshMatch = await fetchMatch(client, match.id);
  await patchScores(client, freshMatch, scoresByTeamName, scoreField);

  const finished = await client.patch(`/matches/${match.id}`, { state: 'finished' });
  expectStatus(finished, 200, `finish match ${match.id}`);
}

async function createTournament(client, payload) {
  const created = await client.post('/tournaments', payload);
  expectStatus(created, 201, `create tournament ${payload.name}`);
  return fetchTournament(client, created.json.id);
}

async function seedRelevantDeciderNeeded(client) {
  let tournament = await createTournament(client, groupStagePayload('Manual Relevant Decider'));
  const group = firstGroup(tournament);

  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S1', 'G1-S2'), { 'G1-S1': 3, 'G1-S2': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S1', 'G1-S3'), { 'G1-S1': 3, 'G1-S3': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S1', 'G1-S4'), { 'G1-S1': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S2', 'G1-S3'), { 'G1-S2': 2, 'G1-S3': 2 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S2', 'G1-S4'), { 'G1-S2': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S3', 'G1-S4'), { 'G1-S3': 3, 'G1-S4': 1 });

  tournament = await fetchTournament(client, tournament.id);
  return {
    label: 'Relevant tie, decider needed',
    tournament,
    notes: [
      'Open little info icon on places 2 and 3.',
      'Modal explains why decision match needed.',
      'Owner can create decision match from modal.',
    ],
  };
}

async function seedRelevantDeciderResolved(client) {
  const seeded = await seedRelevantDeciderNeeded(client);
  const group = firstGroup(seeded.tournament);
  const createResponse = await client.post(`/groups/${group.id}/matches`, {
    team_ids: [
      group.group_scores.find((score) => score.team.name === 'G1-S2').team.id,
      group.group_scores.find((score) => score.team.name === 'G1-S3').team.id,
    ],
  });
  expectStatus(createResponse, 201, `create decider match for group ${group.id}`);

  let tournament = await fetchTournament(client, seeded.tournament.id);
  const deciderMatch = firstGroup(tournament).matches.find((match) => match.decider);
  if (!deciderMatch) {
    throw new Error('Decider match not found after creation');
  }

  await playMatchWithExactScores(client, deciderMatch, { 'G1-S2': 3, 'G1-S3': 5 }, 'hidden_points');
  tournament = await fetchTournament(client, tournament.id);

  return {
    label: 'Relevant tie, decider resolved',
    tournament,
    notes: [
      'Open little info icon on decided place.',
      'Modal explains hidden-points result.',
      'No blocking tie badge remains.',
    ],
  };
}

async function seedIrrelevantBottomTie(client) {
  let tournament = await createTournament(client, groupStagePayload('Manual Irrelevant Tie'));
  const group = firstGroup(tournament);

  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S1', 'G1-S2'), { 'G1-S1': 3, 'G1-S2': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S1', 'G1-S3'), { 'G1-S1': 3, 'G1-S3': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S1', 'G1-S4'), { 'G1-S1': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S2', 'G1-S3'), { 'G1-S2': 3, 'G1-S3': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S2', 'G1-S4'), { 'G1-S2': 3, 'G1-S4': 1 });
  await playMatchWithExactScores(client, matchByTeams(group, 'G1-S3', 'G1-S4'), { 'G1-S3': 2, 'G1-S4': 2 });

  tournament = await fetchTournament(client, tournament.id);
  return {
    label: 'Bottom tie, no decider needed',
    tournament,
    notes: [
      'Open little info icon on places 3 and 4.',
      'Modal explains this tie does not block playoffs.',
      'No create-decider button shown.',
    ],
  };
}

function printScenario({ label, tournament, notes }) {
  console.log(`\n[${label}]`);
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`Tournament name: ${tournament.name}`);
  console.log(`View: ${frontendUrl}/t/${tournament.id}`);
  console.log(`Fullscreen: ${frontendUrl}/t/${tournament.id}/fullscreen`);
  console.log(`Fullscreen groups: ${frontendUrl}/t/${tournament.id}/fullscreen-groups`);
  console.log(`Statistics: ${frontendUrl}/t/${tournament.id}/statistics`);
  for (const note of notes) {
    console.log(`- ${note}`);
  }
}

async function main() {
  const client = await makeClient();
  const scenarios = [
    await seedRelevantDeciderNeeded(client),
    await seedRelevantDeciderResolved(client),
    await seedIrrelevantBottomTie(client),
  ];

  console.log('Seeded manual modal scenarios.');
  console.log(`Frontend base: ${frontendUrl}`);
  console.log(`Backend base: ${backendUrl}`);
  for (const scenario of scenarios) {
    printScenario(scenario);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
