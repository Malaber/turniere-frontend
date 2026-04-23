import { test, expect, BrowserContext, Page } from '@playwright/test';
import { injectAuth, injectAuthState, loadAuthState } from '../helpers/auth';
import { ApiClient, expectStatus } from '../helpers/api-client';
import { keyframe } from '../helpers/screenshot';
import { seedAndPlayGroupStage } from '../helpers/scenario-seeder';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';
const TEAM_ACTION_LIST_KEY = 'group_stage_survivor_playoff_tokens';

test.setTimeout(360_000);

interface TeamActionItem {
  id: number;
  completed: boolean;
  completed_at: string | null;
  team: {
    id: number;
    name: string;
  } | null;
}

interface TeamActionList {
  id: number;
  key: string;
  name: string;
  action_name: string;
  team_action_items: TeamActionItem[];
}

interface TournamentResponse {
  id: number;
  owner_username: string;
  read_only_mode: boolean;
  team_action_lists: TeamActionList[];
}

async function makeOwnerClient(): Promise<ApiClient> {
  const client = new ApiClient(backendUrl);
  const login = await client.login(e2eEmail, e2ePassword);
  expectStatus(login, 200, 'login owner for team action list tests');
  return client;
}

async function fetchTournament(client: ApiClient, tournamentId: number): Promise<TournamentResponse> {
  const response = await client.get<TournamentResponse>(`/tournaments/${tournamentId}`);
  expectStatus(response, 200, `fetch tournament ${tournamentId}`);
  return response.json;
}

async function waitForTeamActionList(
  client: ApiClient,
  tournamentId: number,
  key: string = TEAM_ACTION_LIST_KEY
): Promise<{ tournament: TournamentResponse; list: TeamActionList }> {
  let lastTournament: TournamentResponse | null = null;
  await expect.poll(async () => {
    const tournament = await fetchTournament(client, tournamentId);
    lastTournament = tournament;
    return tournament.team_action_lists.some((candidate) => candidate.key === key);
  }, {
    timeout: 45_000,
    message: `wait for team action list ${key} in tournament ${tournamentId}`
  }).toBe(true);

  const list = (lastTournament as TournamentResponse).team_action_lists
    .find((candidate) => candidate.key === key);
  if (!list) {
    throw new Error(`team action list ${key} still missing in tournament ${tournamentId}`);
  }

  return {
    tournament: lastTournament as TournamentResponse,
    list
  };
}

function firstTeamActionItemOrThrow(list: TeamActionList): TeamActionItem {
  const first = list.team_action_items[0];
  if (!first) {
    throw new Error(`team action list ${list.key} has no items`);
  }
  return first;
}

async function findItemById(client: ApiClient, tournamentId: number, itemId: number): Promise<TeamActionItem> {
  const tournament = await fetchTournament(client, tournamentId);
  const list = tournament.team_action_lists.find((candidate) => candidate.key === TEAM_ACTION_LIST_KEY);
  if (!list) {
    throw new Error(`team action list ${TEAM_ACTION_LIST_KEY} missing in tournament ${tournamentId}`);
  }
  const item = list.team_action_items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`team action item ${itemId} missing in tournament ${tournamentId}`);
  }
  return item;
}

function checkboxByItem(page: Page, item: TeamActionItem) {
  return page.locator(`#team-action-item-${TEAM_ACTION_LIST_KEY}-${item.team?.id}`);
}

async function injectFakeNonOwner(context: BrowserContext): Promise<void> {
  const client = new ApiClient(backendUrl);
  const login = await client.login(e2eEmail, e2ePassword);
  expectStatus(login, 200, 'fresh login for fake non-owner state');
  const loggedInUser = (login.json as { username?: string }).username ?? 'e2e-user';
  await injectAuthState(context, {
    username: `${loggedInUser}-not-owner`,
    accesstoken: login.headers['access-token'],
    client: login.headers.client,
    expiry: login.headers.expiry ?? '',
    uid: login.headers.uid,
  });
}

test('Team action list renders with metadata and item checkboxes', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedAndPlayGroupStage(1, 4, 2);
  const client = await makeOwnerClient();
  const { list } = await waitForTeamActionList(client, tournament.id);

  await page.goto(`/t/${tournament.id}`);
  await expect(page.getByRole('button', { name: 'Checklisten' })).toBeVisible();
  await page.goto(`/t/${tournament.id}/checklists`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Team Action Lists' })).toBeVisible();
  await expect(page.getByText(list.name)).toBeVisible();
  await expect(page.getByText(TEAM_ACTION_LIST_KEY)).toBeVisible();
  await expect(page.getByText(list.action_name)).toBeVisible();
  await expect(page.locator('.form-check-input[type="checkbox"]')).toHaveCount(list.team_action_items.length);
  await keyframe(page, testInfo, 'team_action_lists_render');
});

test('Owner can toggle item complete/incomplete with idempotent state updates', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedAndPlayGroupStage(1, 4, 2);
  const client = await makeOwnerClient();
  const { list } = await waitForTeamActionList(client, tournament.id);
  const item = firstTeamActionItemOrThrow(list);

  await page.goto(`/t/${tournament.id}/checklists`);
  await page.waitForLoadState('networkidle');

  const checkbox = checkboxByItem(page, item);
  await expect(checkbox).toBeVisible();

  await checkbox.check();
  await expect(checkbox).toBeChecked();

  await expect.poll(async () => {
    const liveItem = await findItemById(client, tournament.id, item.id);
    return liveItem.completed;
  }, {
    timeout: 20_000
  }).toBe(true);
  const completedItem = await findItemById(client, tournament.id, item.id);
  expect(completedItem.completed_at).not.toBeNull();
  const firstCompletedAt = completedItem.completed_at;

  const secondComplete = await client.patch<TeamActionItem>(`/team_action_items/${item.id}`, { completed: true });
  expectStatus(secondComplete, 200, `repeat completed=true for item ${item.id}`);
  expect((secondComplete.json as TeamActionItem).completed).toBe(true);
  expect((secondComplete.json as TeamActionItem).completed_at).toBe(firstCompletedAt);

  await keyframe(page, testInfo, 'team_action_item_completed');

  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();

  await expect.poll(async () => {
    const liveItem = await findItemById(client, tournament.id, item.id);
    return liveItem.completed;
  }, {
    timeout: 20_000
  }).toBe(false);
  const incompleteItem = await findItemById(client, tournament.id, item.id);
  expect(incompleteItem.completed_at).toBeNull();

  const secondIncomplete = await client.patch<TeamActionItem>(`/team_action_items/${item.id}`, { completed: false });
  expectStatus(secondIncomplete, 200, `repeat completed=false for item ${item.id}`);
  expect((secondIncomplete.json as TeamActionItem).completed).toBe(false);
  expect((secondIncomplete.json as TeamActionItem).completed_at).toBeNull();

  await keyframe(page, testInfo, 'team_action_item_incomplete');
});

test('Websocket snapshot propagates owner update to another viewer', async ({ context, browser }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedAndPlayGroupStage(1, 4, 2);
  const client = await makeOwnerClient();
  const { list } = await waitForTeamActionList(client, tournament.id);
  const item = firstTeamActionItemOrThrow(list);

  const ownerPage = await context.newPage();
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();

  await ownerPage.goto(`/t/${tournament.id}/checklists`);
  await viewerPage.goto(`/t/${tournament.id}/checklists`);
  await ownerPage.waitForLoadState('networkidle');
  await viewerPage.waitForLoadState('networkidle');

  const ownerCheckbox = checkboxByItem(ownerPage, item);
  const viewerCheckbox = checkboxByItem(viewerPage, item);

  await expect(ownerCheckbox).toBeVisible();
  await expect(viewerCheckbox).toBeVisible();

  await ownerCheckbox.check();
  await expect(ownerCheckbox).toBeChecked();

  await expect.poll(async () => await viewerCheckbox.isChecked(), {
    timeout: 20_000,
    message: 'wait for websocket update to viewer page'
  }).toBe(true);

  await keyframe(ownerPage, testInfo, 'team_action_owner_after_update');
  await keyframe(viewerPage, testInfo, 'team_action_viewer_live_update');
  await viewerContext.close();
});

test('Non-owner UI blocked and read-only mode returns 423 on update', async ({ context, page }, testInfo) => {
  const ownerClient = await makeOwnerClient();
  const { tournament } = await seedAndPlayGroupStage(1, 4, 2);
  const { list } = await waitForTeamActionList(ownerClient, tournament.id);
  const item = firstTeamActionItemOrThrow(list);

  await injectFakeNonOwner(context);
  await page.goto(`/t/${tournament.id}/checklists`);
  await page.waitForLoadState('networkidle');

  const blockedCheckbox = checkboxByItem(page, item);
  await expect(page.getByText('Nur Turnier-Owner kann Status ändern.')).toBeVisible();
  await expect(blockedCheckbox).toBeDisabled();
  await keyframe(page, testInfo, 'team_action_non_owner_blocked');

  const readOnlyToggle = await ownerClient.patch(`/tournaments/${tournament.id}`, { read_only_mode: true });
  expectStatus(readOnlyToggle, 200, `set tournament ${tournament.id} read only`);

  const updateReadOnlyItem = await ownerClient.patch(`/team_action_items/${item.id}`, { completed: true });
  expect(updateReadOnlyItem.status).toBe(423);
});

test('Invalid update usage returns 401 and 404 statuses', async () => {
  const ownerClient = await makeOwnerClient();
  const { tournament } = await seedAndPlayGroupStage(1, 4, 2);
  const { list } = await waitForTeamActionList(ownerClient, tournament.id);
  const item = firstTeamActionItemOrThrow(list);
  const unauthenticatedClient = new ApiClient(backendUrl);

  const unauthUpdate = await unauthenticatedClient.patch(`/team_action_items/${item.id}`, { completed: true });
  expect(unauthUpdate.status).toBe(401);

  const invalidItemUpdate = await ownerClient.patch('/team_action_items/999999999', { completed: true });
  expect(invalidItemUpdate.status).toBe(404);

  const invalidBusinessKeyUpdate = await ownerClient.patch(
    `/tournaments/${tournament.id}/team_action_lists/unknown_key/teams/${item.team?.id}`,
    { completed: true }
  );
  expect(invalidBusinessKeyUpdate.status).toBe(404);
});
