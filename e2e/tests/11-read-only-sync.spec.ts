import { test, expect } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { ApiClient, expectStatus } from '../helpers/api-client';
import { seedGroupStageTournament, seedReadOnlyFollowerTournament } from '../helpers/scenario-seeder';
import { keyframe } from '../helpers/screenshot';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(240_000);

async function makeClient() {
  const client = new ApiClient(backendUrl);
  const login = await client.login(e2eEmail, e2ePassword);
  expectStatus(login, 200, 'login for read-only sync spec');
  return client;
}

test('Owner can create read-only follower tournament from create page', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());

  await page.goto('/create');
  await page.waitForLoadState('networkidle');

  const tournamentName = `Read Only Follower ${Date.now()}`;
  await page.fill('input[name="name"]', tournamentName);
  await page.click('#public');
  await page.click('#read-only-mode');
  await page.fill('#sync-auth-token', 'shared-secret');
  await expect(page.getByText(/Follower braucht nur gemeinsamen Token/)).toBeVisible();
  await expect(page.locator('input[placeholder="Teamname"]')).toHaveCount(0);
  await keyframe(page, testInfo, 'create_read_only_form');

  await page.getByRole('button', { name: 'Turnier erstellen' }).last().click();
  await page.waitForURL(/\/t\/\d+/, { timeout: 15_000 });

  await expect(page.getByTestId('readonly-tournament-banner')).toBeVisible();
  await keyframe(page, testInfo, 'created_read_only_tournament');
  await page.getByRole('button', { name: 'Turnier bearbeiten' }).click();
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('readonly-edit-alert')).toBeVisible();
  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).toBeChecked();
  await expect(page.locator('#edittournament-textfield-syncAuthToken')).toHaveValue('shared-secret');
  await expect(page.getByTestId('readonly-team-lock')).toBeVisible();
  await keyframe(page, testInfo, 'created_read_only_edit_view');
});

test('Owner sees read-only tournament locked on main page and can take over in edit view', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedReadOnlyFollowerTournament();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('readonly-tournament-banner')).toBeVisible();
  await expect(page.getByTestId('finish-group-stage')).toHaveCount(0);
  await expect(page.locator('[data-decider-match="true"]')).toHaveCount(0);
  await keyframe(page, testInfo, 'existing_read_only_tournament');

  await page.getByRole('button', { name: 'Turnier bearbeiten' }).click();
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('readonly-edit-alert')).toBeVisible();
  await expect(page.getByTestId('sync-last-pushed-at')).toContainText('Noch kein erfolgreicher Push');
  await expect(page.getByTestId('sync-last-push-error')).toContainText('Kein Fehler gespeichert');
  await keyframe(page, testInfo, 'read_only_takeover_before_save');

  await page.uncheck('#edittournament-checkbox-readOnlyMode');
  await page.getByRole('button', { name: 'Ändern' }).click();
  await expect(page.getByTestId('readonly-edit-alert')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('#edittournament-textfield-name')).toBeEnabled();
  await expect(page.locator('#edittournament-textfield-syncAuthToken')).toHaveValue('');
  await keyframe(page, testInfo, 'read_only_takeover_after_save');
});

test('Owner can edit leader sync target and token on normal tournament', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const client = await makeClient();

  const updated = await client.patch(`/tournaments/${tournament.id}`, {
    sync_target_url: 'https://remote.example/tournaments/42/sync_state',
    sync_auth_token: 'leader-secret',
  });
  expectStatus(updated, 200, `configure sync for tournament ${tournament.id}`);

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).not.toBeChecked();
  await expect(page.locator('#edittournament-textfield-syncTargetUrl'))
    .toHaveValue('https://remote.example/tournaments/42/sync_state');
  await expect(page.locator('#edittournament-textfield-syncAuthToken')).toHaveValue('leader-secret');
  await keyframe(page, testInfo, 'leader_sync_edit_before_change');

  await page.fill('#edittournament-textfield-syncTargetUrl', 'https://remote.example/tournaments/99/sync_state');
  await page.fill('#edittournament-textfield-syncAuthToken', 'leader-secret-2');
  await page.getByRole('button', { name: 'Ändern' }).click();

  await expect(page.locator('#edittournament-textfield-syncTargetUrl'))
    .toHaveValue('https://remote.example/tournaments/99/sync_state');
  await expect(page.locator('#edittournament-textfield-syncAuthToken')).toHaveValue('leader-secret-2');
  await keyframe(page, testInfo, 'leader_sync_edit_after_change');
});
