/**
 * Seed a full 64-team group-stage tournament for local development.
 *
 * 16 groups x 4 teams = 64 teams.
 * Each group produces C(4,2) = 6 matches => 96 group matches total.
 * Top 2 per group advance to a 32-team playoff bracket.
 *
 * Usage:
 *   node e2e/scripts/seed-dev-tournament.mjs
 *
 * Environment variables (all optional):
 *   TURNIERE_BACKEND_URL   default http://127.0.0.1:3000
 *   TURNIERE_FRONTEND_URL  default http://127.0.0.1:3001
 *   TURNIERE_E2E_EMAIL     default e2e@example.com
 *   TURNIERE_E2E_PASSWORD  default password123
 */

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://127.0.0.1:3000';
const frontendUrl = process.env.TURNIERE_FRONTEND_URL ?? 'http://127.0.0.1:3001';
const email = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const password = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

// -- API client (standalone, no TS dependencies) -----------------------------

class ApiClient {
  static REQUEST_TIMEOUT_MS = 120_000;

  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.authHeaders = {};
  }

  async login(emailAddress, passwordValue) {
    const response = await this.request('POST', '/users/sign_in', {
      email: emailAddress,
      password: passwordValue,
    });
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
    const next = {};
    for (const key of ['access-token', 'client', 'uid']) {
      if (headers[key]) next[key] = headers[key];
    }
    if (Object.keys(next).length > 0) {
      this.authHeaders = next;
    }
  }
}

function expectStatus(response, expected, action) {
  if (response.status !== expected) {
    throw new Error(
      `${action} failed: expected ${expected}, got ${response.status}\n${JSON.stringify(response.json, null, 2)}`,
    );
  }
}

// -- Team name generator -----------------------------------------------------

const CITIES = [
  'München', 'Berlin', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart',
  'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden',
  'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
  'Bonn', 'Münster', 'Mannheim', 'Karlsruhe', 'Augsburg', 'Wiesbaden',
  'Aachen', 'Braunschweig', 'Kiel', 'Chemnitz', 'Halle', 'Magdeburg',
  'Freiburg', 'Lübeck', 'Erfurt', 'Rostock', 'Mainz', 'Kassel',
  'Saarbrücken', 'Potsdam', 'Oldenburg', 'Osnabrück', 'Regensburg',
  'Ingolstadt', 'Heidelberg', 'Darmstadt', 'Würzburg', 'Ulm',
  'Wolfsburg', 'Göttingen', 'Heilbronn', 'Pforzheim', 'Offenbach',
  'Reutlingen', 'Paderborn', 'Trier', 'Jena', 'Cottbus',
  'Gera', 'Bamberg', 'Erlangen', 'Passau', 'Konstanz',
  'Siegen', 'Gütersloh', 'Schwerin',
];

const PREFIXES = [
  'SV', 'FC', 'TSV', 'SC', 'VfB', 'TuS', 'SpVgg', 'SG',
  'VfL', 'FSV', 'BSC', 'Fortuna', 'Eintracht', 'Viktoria',
  'Alemannia', 'Arminia',
];

function generateTeamName(index) {
  const city = CITIES[index % CITIES.length];
  const prefix = PREFIXES[index % PREFIXES.length];
  return `${prefix} ${city}`;
}

// -- Main --------------------------------------------------------------------

async function main() {
  const groupCount = 16;
  const teamsPerGroup = 4;
  const totalTeams = groupCount * teamsPerGroup;
  const playoffTeamsAmount = 32; // top 2 per group

  console.log(`Seeding tournament: ${groupCount} groups x ${teamsPerGroup} teams = ${totalTeams} teams`);
  console.log(`Backend: ${backendUrl}`);

  const client = new ApiClient(backendUrl);
  const loginRes = await client.login(email, password);
  expectStatus(loginRes, 200, `login as ${email}`);
  console.log('Logged in.');

  // Build teams with realistic names
  const teams = [];
  for (let g = 0; g < groupCount; g++) {
    for (let s = 0; s < teamsPerGroup; s++) {
      const index = g * teamsPerGroup + s;
      teams.push({ name: generateTeamName(index), group: g });
    }
  }

  const payload = {
    name: `Dev Tournament 64 Teams`,
    description: 'Local development seed — 16 groups, 64 teams',
    public: true,
    group_stage: true,
    playoff_teams_amount: playoffTeamsAmount,
    teams,
  };

  const created = await client.post('/tournaments', payload);
  expectStatus(created, 201, 'create tournament');
  const tournamentId = created.json.id;

  const tournament = await client.get(`/tournaments/${tournamentId}`);
  expectStatus(tournament, 200, 'fetch tournament');
  const code = tournament.json.code;

  // Create beamers for all display states
  const beamers = [
    { name: 'between', display_state: 'between_games' },
    { name: 'during', display_state: 'during_game' },
    { name: 'groups', display_state: 'group_tables' },
  ];

  for (const beamer of beamers) {
    const res = await client.post(`/tournaments/${tournamentId}/beamers`, beamer);
    expectStatus(res, 201, `create beamer "${beamer.name}"`);
  }

  const groupStage = tournament.json.stages.find((s) => s.level === -1);
  const matchCount = groupStage ? groupStage.groups.reduce((sum, g) => sum + g.matches.length, 0) : 0;

  console.log('\n--- Tournament seeded ---');
  console.log(`ID:       ${tournamentId}`);
  console.log(`Code:     ${code}`);
  console.log(`Name:     ${payload.name}`);
  console.log(`Teams:    ${totalTeams}`);
  console.log(`Groups:   ${groupCount}`);
  console.log(`Matches:  ${matchCount} group matches`);
  console.log(`Playoffs: top ${playoffTeamsAmount} advance`);
  console.log('');
  console.log('URLs:');
  console.log(`  Tournament:        ${frontendUrl}/t/${tournamentId}`);
  console.log(`  Mission Control:   ${frontendUrl}/t/${tournamentId}/mission-control`);
  console.log(`  Fullscreen:        ${frontendUrl}/t/${tournamentId}/fullscreen`);
  console.log(`  Between games:     ${frontendUrl}/t/${tournamentId}/fullscreen?beamer=between`);
  console.log(`  During game:       ${frontendUrl}/t/${tournamentId}/fullscreen?beamer=during`);
  console.log(`  Groups:            ${frontendUrl}/t/${tournamentId}/fullscreen?beamer=groups`);
  console.log(`  Statistics:        ${frontendUrl}/t/${tournamentId}/statistics`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
