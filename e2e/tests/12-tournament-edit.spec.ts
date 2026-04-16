import { test, expect, BrowserContext } from '@playwright/test';
import { injectAuth, injectAuthState, loadAuthState } from '../helpers/auth';
import { ApiClient, expectStatus } from '../helpers/api-client';
import { keyframe } from '../helpers/screenshot';
import { seedGroupStageTournament, seedReadOnlyFollowerTournament } from '../helpers/scenario-seeder';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';

async function makeClient(): Promise<ApiClient> {
  const auth = loadAuthState();
  const client = new ApiClient(backendUrl);
  const login = await client.login(process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com',
    process.env.TURNIERE_E2E_PASSWORD ?? 'password123');
  expectStatus(login, 200, `login as ${auth.username}`);
  return client;
}

async function makeSecondaryUser(context: BrowserContext) {
  const email = `edit-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  const username = `edit-e2e-${Date.now()}`;
  const client = new ApiClient(backendUrl);
  const register = await client.register(email, password, username);
  expectStatus(register, 200, `register ${email}`);
  await injectAuthState(context, {
    username,
    accesstoken: register.headers['access-token'],
    client: register.headers.client,
    expiry: register.headers.expiry ?? '',
    uid: register.headers.uid,
  });
}

async function injectTournamentSyncState(context: BrowserContext, tournamentId: number, syncState: {
  readOnlyMode: boolean;
  syncTargetUrl?: string;
  syncAuthToken?: string;
  syncLastPushedAt?: string | null;
  syncLastPushError?: string;
}) {
  await context.addInitScript(({ id, nextSyncState }) => {
    const existing = localStorage.getItem('reduxState');
    const reduxState = existing ? JSON.parse(existing) : {};
    reduxState.tournamentinfo = {
      ...(reduxState.tournamentinfo || {}),
      id,
      readOnlyMode: nextSyncState.readOnlyMode === true,
      syncTargetUrl: nextSyncState.syncTargetUrl || '',
      syncAuthToken: nextSyncState.syncAuthToken || '',
      syncLastPushedAt: nextSyncState.syncLastPushedAt || null,
      syncLastPushError: nextSyncState.syncLastPushError || '',
    };
    localStorage.setItem('reduxState', JSON.stringify(reduxState));
  }, { id: tournamentId, nextSyncState: syncState });
}

test('Owner can open edit page via tournament id and save normal properties', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = await makeClient();

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#edittournament-textfield-name')).toBeVisible();
  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).toBeVisible();
  await keyframe(page, testInfo, 'edit_page_loaded');

  await page.fill('#edittournament-textfield-name', 'Edited Tournament Name');
  await page.fill('#edittournament-textfield-description', 'Edited Tournament Description');
  await page.click('#edittournament-checkbox-isPublic');
  await page.getByRole('button', { name: 'Ändern' }).click();

  await expect(page.locator('#edittournament-textfield-name')).toHaveValue('Edited Tournament Name');
  await expect(page.locator('#edittournament-textfield-description')).toHaveValue('Edited Tournament Description');
  await keyframe(page, testInfo, 'edit_page_saved');

  const fetched = await client.get(`/tournaments/${tournament.id}`);
  expectStatus(fetched, 200, `fetch tournament ${tournament.id} after edit`);
  expect((fetched.json as { name: string }).name).toBe('Edited Tournament Name');
  expect((fetched.json as { description: string }).description).toBe('Edited Tournament Description');
  expect((fetched.json as { public: boolean }).public).toBe(true);
});

test('Edit page via tournament code shows 404', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);

  await page.goto(`/t/${tournament.code}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await keyframe(page, testInfo, 'edit_page_wrong_code_404');
});

test('Unauthenticated user sees login prompt on edit page', async ({ page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(1, 4, 2);

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Sie müssen angemeldet sein, um ein Turnier zu bearbeiten.')).toBeVisible();
  await keyframe(page, testInfo, 'edit_page_login_required');
});

test('Non-owner gets 403 on edit page', async ({ context, page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  await makeSecondaryUser(context);

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
  await keyframe(page, testInfo, 'edit_page_forbidden');
});

test('Read-only follower edit page shows takeover controls via tournament id', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedReadOnlyFollowerTournament();
  await injectTournamentSyncState(context, tournament.id, {
    readOnlyMode: true,
    syncAuthToken: 'shared-secret'
  });

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('readonly-edit-alert')).toBeVisible();
  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).toBeChecked();
  await keyframe(page, testInfo, 'edit_page_read_only_loaded');
});
