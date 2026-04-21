import { test, expect } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { ApiClient, expectStatus } from '../helpers/api-client';
import {
  seedGroupStageTournament,
  seedLeaderFollowerSyncPair,
  seedReadOnlyFollowerTournament,
} from '../helpers/scenario-seeder';
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

async function injectTournamentSyncState(context, tournamentId, syncState) {
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

test('Owner can configure read-only follower fields on create page', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());

  await page.goto('/create');
  await page.waitForLoadState('networkidle');

  const tournamentName = `Read Only Follower ${Date.now()}`;
  await page.fill('input[name="name"]', tournamentName);
  await page.click('#public');
  await page.click('#read-only-mode');
  await page.fill('#sync-auth-token', 'shared-secret');
  await expect(page.getByText(/Ein Follower braucht ein gemeinsamen Token/)).toBeVisible();
  await expect(page.locator('input[placeholder="Teamname"]')).toHaveCount(0);
  await keyframe(page, testInfo, 'create_read_only_form');
});

test('Owner sees read-only tournament locked on main page and can take over in edit view', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedReadOnlyFollowerTournament();
  await injectTournamentSyncState(context, tournament.id, {
    readOnlyMode: true,
    syncAuthToken: 'shared-secret'
  });

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('readonly-tournament-banner')).toBeVisible();
  await expect(page.getByTestId('finish-group-stage')).toHaveCount(0);
  await expect(page.locator('[data-decider-match="true"]')).toHaveCount(0);
  await keyframe(page, testInfo, 'existing_read_only_tournament');

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('readonly-edit-alert')).toBeVisible();
  await expect(page.getByTestId('sync-last-pushed-at')).toContainText('Noch kein erfolgreicher Push');
  await expect(page.getByTestId('sync-last-push-error')).toContainText('Kein Fehler gespeichert');
  await keyframe(page, testInfo, 'read_only_takeover_before_save');

  await page.uncheck('#edittournament-checkbox-readOnlyMode');
  await page.locator('#edittournament-button').click();
  await page.waitForURL(new RegExp(`/t/${tournament.id}$`), { timeout: 15000 });
  await expect(page.getByTestId('readonly-tournament-banner')).toHaveCount(0);
  await keyframe(page, testInfo, 'read_only_takeover_after_save');
});

test('Owner can run sync test button and get real leader to follower roundtrip', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { leader, follower, syncToken } = await seedLeaderFollowerSyncPair();
  await injectTournamentSyncState(context, leader.id, {
    readOnlyMode: false,
    syncTargetUrl: `${backendUrl}/tournaments/${follower.id}/sync_state`,
    syncAuthToken: syncToken
  });

  const client = await makeClient();
  const renamedLeader = await client.patch(`/tournaments/${leader.id}`, {
    name: `Leader Roundtrip ${Date.now()}`,
    description: 'Sync button should push this to follower',
  });
  expectStatus(renamedLeader, 200, `rename leader tournament ${leader.id}`);

  const followerBefore = await client.get(`/tournaments/${follower.id}`);
  expectStatus(followerBefore, 200, `fetch follower tournament ${follower.id} before sync test`);

  await page.goto(`/t/${leader.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#edittournament-textfield-syncTargetUrl'))
    .toHaveValue(`${backendUrl}/tournaments/${follower.id}/sync_state`);
  await expect(page.locator('#edittournament-textfield-syncAuthToken')).toHaveValue(syncToken);
  await keyframe(page, testInfo, 'sync_test_before_click');

  await page.getByTestId('sync-test-button').click();
  await expect(page.getByTestId('sync-last-pushed-at')).not.toContainText('Noch kein erfolgreicher Push');
  await keyframe(page, testInfo, 'sync_test_after_click');

  await expect.poll(async () => {
    const followerAfter = await client.get(`/tournaments/${follower.id}`);
    expectStatus(followerAfter, 200, `fetch follower tournament ${follower.id} after sync test`);
    return {
      name: (followerAfter.json as { name: string }).name,
      description: (followerAfter.json as { description: string }).description,
      teamCount: (followerAfter.json as { teams: unknown[] }).teams.length,
    };
  }, {
    timeout: 15000,
  }).toEqual({
    name: (renamedLeader.json as { name: string }).name,
    description: (renamedLeader.json as { description: string }).description,
    teamCount: ((renamedLeader.json as { teams: unknown[] }).teams).length,
  });
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
  await injectTournamentSyncState(context, tournament.id, {
    readOnlyMode: false,
    syncTargetUrl: 'https://remote.example/tournaments/42/sync_state',
    syncAuthToken: 'leader-secret'
  });

  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).not.toBeChecked();
  await expect(page.locator('#edittournament-textfield-syncTargetUrl'))
    .toHaveValue('https://remote.example/tournaments/42/sync_state');
  await expect(page.locator('#edittournament-textfield-syncAuthToken')).toHaveValue('leader-secret');
  await keyframe(page, testInfo, 'leader_sync_edit_before_change');

  await page.fill('#edittournament-textfield-syncTargetUrl', 'https://remote.example/tournaments/99/sync_state');
  await page.fill('#edittournament-textfield-syncAuthToken', 'leader-secret-2');
  await page.locator('#edittournament-button').click();

  await page.waitForURL(new RegExp(`/t/${tournament.id}$`), { timeout: 15000 });
  await page.goto(`/t/${tournament.id}/edit`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#edittournament-checkbox-readOnlyMode')).not.toBeChecked();
  await expect(page.locator('#edittournament-textfield-syncTargetUrl'))
    .toHaveValue('https://remote.example/tournaments/99/sync_state');
  await keyframe(page, testInfo, 'leader_sync_edit_after_change');
});
