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

async function injectNonOwnerAuth(context: BrowserContext) {
  const client = new ApiClient(backendUrl);
  const login = await client.login(process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com',
    process.env.TURNIERE_E2E_PASSWORD ?? 'password123');
  expectStatus(login, 200, 'fresh login for non-owner edit test');
  await injectAuthState(context, {
    username: `${login.json.username ?? 'e2e-user'}-not-owner`,
    accesstoken: login.headers['access-token'],
    client: login.headers.client,
    expiry: login.headers.expiry ?? '',
    uid: login.headers.uid,
  });
}

test('Owner can open Mission Control settings and save normal properties', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = await makeClient();

  // Route /edit should redirect to /mission-control
  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForURL(new RegExp(`/t/${tournament.id}/mission-control`));
  
  await page.getByRole('link', { name: 'Turnier-Einstellungen' }).click();

  await expect(page.locator('#edittournament-textfield-name')).toBeVisible();
  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).toBeVisible();
  await keyframe(page, testInfo, 'mission_control_settings_loaded');

  await page.fill('#edittournament-textfield-name', 'Edited Tournament Name');
  await page.fill('#edittournament-textfield-description', 'Edited Tournament Description');
  await page.locator('#edittournament-checkbox-isPublic').check({force: true});
  await expect(page.locator('#edittournament-checkbox-isPublic')).toBeChecked();
  await page.locator('#edittournament-button').click();

  await expect(page.getByText('Turnier-Einstellungen wurden gespeichert.')).toBeVisible();
  await keyframe(page, testInfo, 'mission_control_settings_saved');

  const fetched = await client.get(`/tournaments/${tournament.id}`);
  expectStatus(fetched, 200, `fetch tournament ${tournament.id} after edit`);
  expect((fetched.json as { name: string }).name).toBe('Edited Tournament Name');
  expect((fetched.json as { description: string }).description).toBe('Edited Tournament Description');
  expect((fetched.json as { public: boolean }).public).toBe(true);
});

test('Mission Control for non-existent tournament shows 404', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  
  await page.goto(`/t/9999999/mission-control`);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await keyframe(page, testInfo, 'mission_control_404');
});

test('Read-only follower shows takeover controls in Mission Control settings', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedReadOnlyFollowerTournament();

  await page.goto(`/t/${tournament.id}/mission-control`);
  await page.getByRole('link', { name: 'Turnier-Einstellungen' }).click();

  await expect(page.getByTestId('readonly-edit-alert')).toBeVisible();
  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).toBeChecked();
  await keyframe(page, testInfo, 'mission_control_read_only_settings');
});
