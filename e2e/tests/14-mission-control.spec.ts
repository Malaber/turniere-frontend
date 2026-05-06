import { test, expect, type Locator, type Page } from '@playwright/test';
import { countBeamerEffects, installBeamerEffectSpies, waitForBeamerEffect } from '../helpers/beamer-audio';
import { waitForActionCableSubscription } from '../helpers/action-cable';
import { injectAuth } from '../helpers/auth';
import { keyframe } from '../helpers/screenshot';
import {
  LONG_TEAM_NAME_SINGLE_WORD,
  longGroupStageTeamName,
  seedAndPlayGroupStage,
  seedGroupStageAndRunToBeforeFinal,
  seedGroupStageReadyForPlayoffs,
  seedGroupStageTournament,
} from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';
const submitShortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
const firstGroupStartCount = 1;

test.setTimeout(180_000);

type TimerStateResponse = {
  timestamp?: string | null;
  timer_mode?: string | null;
  timer_reason?: string | null;
  timer_reason_text?: string | null;
};

async function loggedInClient() {
  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  return client;
}

async function matchStateCount(
  client: ApiClient,
  tournamentId: number,
  state: string,
) {
  const matches = await client.get<Array<{ state: string }>>(
    `/tournaments/${tournamentId}/matches`,
    { state },
  );
  expectStatus(matches, 200, `fetch ${state} matches`);
  return matches.json.length;
}

async function expectMatchStateCount(
  client: ApiClient,
  tournamentId: number,
  state: string,
  expected: number,
) {
  await expect.poll(async () => matchStateCount(client, tournamentId, state), { timeout: 20_000 }).toBe(expected);
}

async function expectMatchStateCountAtLeast(
  client: ApiClient,
  tournamentId: number,
  state: string,
  minimum: number,
) {
  await expect.poll(async () => {
    const matches = await client.get<Array<{ state: string }>>(
      `/tournaments/${tournamentId}/matches`,
      { state },
    );
    expectStatus(matches, 200, `fetch ${state} matches`);
    return matches.json.length;
  }, { timeout: 20_000 }).toBeGreaterThanOrEqual(minimum);
}

async function expectUnlockProgressStarted(card: Locator) {
  const progress = card.getByTestId('mission-match-unlock-progress');
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow')), {
    timeout: 2_000,
  }).toBeGreaterThan(0);
}

async function expectStartHoldProgressStarted(button: Locator) {
  const progress = button.getByTestId('mission-start-hold-progress');
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow')), {
    timeout: 500,
  }).toBeGreaterThan(0);
}

async function expectBeamerCardOrder(page: Page, expectedNames: string[]) {
  await expect.poll(async () => page.locator('.mission-beamer-name').evaluateAll((elements) => (
    elements.map((element) => element.textContent?.trim() ?? '')
  )), { timeout: 20_000 }).toEqual(expectedNames);
}

async function timerState(client: ApiClient, tournamentId: number) {
  const res = await client.get<TimerStateResponse>(`/tournaments/${tournamentId}/timer`);
  expectStatus(res, 200, 'fetch timer state');
  return {
    timestamp: res.json.timestamp ?? null,
    mode: res.json.timer_mode ?? null,
    reason: res.json.timer_reason ?? null,
    reasonText: res.json.timer_reason_text ?? null,
  };
}

async function holdStartUntilConfirmOpen(page: Page, button: Locator) {
  await button.hover();
  await page.mouse.down();
  await expectStartHoldProgressStarted(button);
  await expect(page.getByTestId('mission-start-confirm-modal')).toBeVisible({ timeout: 3_000 });
  await page.mouse.up();
}

async function playoffStageCount(client: ApiClient, tournamentId: number) {
  const tournament = await client.get<{ stages: Array<{ level: number }> }>(`/tournaments/${tournamentId}`);
  expectStatus(tournament, 200, `fetch tournament ${tournamentId}`);
  return tournament.json.stages.filter((stage) => stage.level !== -1).length;
}

function responseErrorMessages(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as {
    error?: unknown;
    errors?: unknown;
    full_messages?: unknown;
  };
  if (typeof record.error === 'string') return [record.error];
  if (Array.isArray(record.errors)) return record.errors.map(String);
  if (
    record.errors &&
    typeof record.errors === 'object' &&
    Array.isArray((record.errors as { full_messages?: unknown }).full_messages)
  ) {
    return ((record.errors as { full_messages: unknown[] }).full_messages).map(String);
  }
  if (Array.isArray(record.full_messages)) return record.full_messages.map(String);
  return [];
}

async function holdMouseUntilUnlocked(page: Page, card: Locator) {
  const lock = card.getByTestId('mission-match-lock');
  await lock.hover();
  await page.mouse.down();
  await expectUnlockProgressStarted(card);
  await page.waitForTimeout(700);
  await page.mouse.up();
}

async function holdTouchUntilUnlocked(page: Page, card: Locator) {
  const lock = card.getByTestId('mission-match-lock');
  await lock.dispatchEvent('pointerdown', {
    pointerId: 41,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
  });
  await expectUnlockProgressStarted(card);
  await page.waitForTimeout(700);
  await lock.dispatchEvent('pointerup', {
    pointerId: 41,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
  });
}

async function holdSpaceUntilUnlocked(page: Page, card: Locator) {
  const lock = card.getByTestId('mission-match-lock');
  await lock.focus();
  await expect(lock).toBeFocused();
  await page.keyboard.down('Space');
  await expectUnlockProgressStarted(card);
  await page.waitForTimeout(700);
  await page.keyboard.up('Space');
}

async function expectUnlockProgressDrainsAndLocks(card: Locator, score: Locator) {
  const progress = card.getByTestId('mission-match-unlock-progress');
  await expect(card.getByRole('button', { name: /Kurz entsperrt/ })).toBeVisible();
  const initialValue = Number(await progress.getAttribute('aria-valuenow'));
  expect(initialValue).toBeGreaterThan(0);
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow')), {
    timeout: 2_000,
  }).toBeLessThan(initialValue);
  await expect(score).toBeDisabled({ timeout: 8_000 });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(card.getByRole('button', { name: /Locked/ })).toBeVisible();
}

test('Mission Control starts and deletes playoffs with modal result feedback', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageReadyForPlayoffs(2, 4, 4);
  const client = await loggedInClient();

  await page.goto(`/t/${tournament.id}/mission-control#starts`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => playoffStageCount(client, tournament.id), { timeout: 20_000 }).toBe(0);

  const playoffStart = page.getByTestId('mission-playoff-start');
  await expect(playoffStart).toBeVisible();
  await playoffStart.click();
  await page.waitForTimeout(250);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.route(/\/stages\/\d+$/, async (route) => {
    await page.waitForTimeout(350);
    await route.continue();
  });
  await holdStartUntilConfirmOpen(page, playoffStart);
  let dialog = page.getByTestId('mission-start-confirm-modal');
  await expect(dialog.getByRole('heading', { name: 'Playoffs starten' })).toBeVisible();
  await dialog.getByTestId('mission-start-confirm-ok').click();
  await expect(dialog.getByTestId('mission-start-confirm-loading')).toContainText('Playoffs werden generiert');
  await expect(dialog.getByTestId('mission-start-confirm-result')).toContainText('Playoffs wurden generiert.', {
    timeout: 20_000,
  });
  await dialog.getByTestId('mission-start-result-ok').click();
  await expect.poll(async () => playoffStageCount(client, tournament.id), { timeout: 20_000 }).toBeGreaterThan(0);

  const playoffDelete = page.getByTestId('mission-playoff-delete');
  await expect(playoffDelete).toBeVisible({ timeout: 20_000 });
  await playoffDelete.click();
  await page.waitForTimeout(250);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.route(/\/tournaments\/\d+\/playoffs$/, async (route) => {
    await page.waitForTimeout(350);
    await route.continue();
  });
  await holdStartUntilConfirmOpen(page, playoffDelete);
  dialog = page.getByTestId('mission-start-confirm-modal');
  await expect(dialog.getByRole('heading', { name: 'Playoffs löschen' })).toBeVisible();
  const deleteResponse = page.waitForResponse((response) => (
    response.request().method() === 'DELETE' &&
    /\/tournaments\/\d+\/playoffs$/.test(response.url())
  ));
  await dialog.getByTestId('mission-start-confirm-ok').click();
  await expect(dialog.getByTestId('mission-start-confirm-loading')).toContainText('Playoffs werden gelöscht');
  expect((await deleteResponse).ok()).toBe(true);
  await expect(dialog.getByTestId('mission-start-confirm-result')).toContainText('Playoffs wurden gelöscht.', {
    timeout: 20_000,
  });
  await dialog.getByTestId('mission-start-result-ok').click();
  await expect.poll(async () => playoffStageCount(client, tournament.id), { timeout: 20_000 }).toBe(0);
});

test('Mission Control keeps playoff deletion errors inside confirmation modal', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedAndPlayGroupStage(2, 4, 4);
  const client = await loggedInClient();
  const matches = await client.get<Array<{ id: number; state: string; group?: { id: number } | null }>>(
    `/tournaments/${tournament.id}/matches`,
  );
  expectStatus(matches, 200, 'fetch matches for playoff deletion failure');
  const playoffMatch = matches.json.find((match) => !match.group && match.state === 'not_started');
  expect(playoffMatch).toBeTruthy();
  const started = await client.patch(`/matches/${playoffMatch!.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start playoff match before deletion');

  await page.goto(`/t/${tournament.id}/mission-control#starts`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  const playoffDelete = page.getByTestId('mission-playoff-delete');
  await expect(playoffDelete).toBeVisible();
  await holdStartUntilConfirmOpen(page, playoffDelete);
  const dialog = page.getByTestId('mission-start-confirm-modal');
  const deleteResponse = page.waitForResponse((response) => (
    response.request().method() === 'DELETE' &&
    /\/tournaments\/\d+\/playoffs$/.test(response.url())
  ));
  await dialog.getByTestId('mission-start-confirm-ok').click();
  const response = await deleteResponse;
  expect(response.ok()).toBe(false);
  const body = await response.json().catch(() => ({}));
  const messages = responseErrorMessages(body);
  const result = dialog.getByTestId('mission-start-confirm-result');
  await expect(result).toBeVisible({ timeout: 20_000 });
  if (messages.length > 0) {
    await expect(result).toContainText(messages[0]);
  }
  await expect(result).not.toContainText('Playoffs wurden gelöscht.');
  expect(await playoffStageCount(client, tournament.id)).toBeGreaterThan(0);
});

test('Mission Control configures Werbung image checklist', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const beamer = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'werbung-control',
    display_state: 'during_game',
    config: {},
  });
  expectStatus(beamer, 201, 'create werbung-control beamer');

  await page.goto(`/t/${tournament.id}/mission-control#beamer`);
  const card = page.getByTestId(`mission-beamer-card-${beamer.json.id}`);
  await expect(card).toBeVisible({ timeout: 20_000 });

  await card.getByTestId(`mission-beamer-mode-${beamer.json.id}`).selectOption('werbung');

  const checklist = card.getByTestId(`mission-beamer-werbung-checklist-${beamer.json.id}`);
  await expect(checklist).toBeVisible();

  const defaultImageKeys = [
    'bpwstr_banner',
    'bpwstr_logo',
    'bpwstr_qr_code',
    'Merch_Werbebanner',
    'Schorlepongturnier_Werbebanner',
  ];

  for (const imageKey of defaultImageKeys) {
    await expect(
      card.getByTestId(`mission-beamer-werbung-image-${beamer.json.id}-${imageKey}`),
    ).toBeChecked();
  }

  await expect(card.getByTestId(`mission-beamer-werbung-image-${beamer.json.id}-tennis_blurred`)).toHaveCount(0);
  await expect(card.getByTestId(`mission-beamer-werbung-image-${beamer.json.id}-tennis-blurred`)).toHaveCount(0);

  const merch = card.getByTestId(`mission-beamer-werbung-image-${beamer.json.id}-Merch_Werbebanner`);
  await merch.uncheck();

  await expect.poll(async () => {
    const beamers = await client.get<Array<{ id: number; config: { werbung_image_keys?: string[] } }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(beamers, 200, 'fetch beamers after werbung merch uncheck');
    const updated = beamers.json.find((candidate) => candidate.id === beamer.json.id);
    return updated?.config.werbung_image_keys || [];
  }, { timeout: 20_000 }).not.toContain('Merch_Werbebanner');

  await merch.check();

  await expect.poll(async () => {
    const beamers = await client.get<Array<{ id: number; config: { werbung_image_keys?: string[] } }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(beamers, 200, 'fetch beamers after werbung merch re-check');
    const updated = beamers.json.find((candidate) => candidate.id === beamer.json.id);
    return updated?.config.werbung_image_keys || [];
  }, { timeout: 20_000 }).toEqual(expect.arrayContaining(defaultImageKeys));
});

test('Mission Control configures Next Matches beamer mode', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const beamer = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'next-control',
    display_state: 'during_game',
    config: { match_filter: 'state:finished' },
  });
  expectStatus(beamer, 201, 'create next-control beamer');

  await page.goto(`/t/${tournament.id}/mission-control#beamer`);
  const card = page.getByTestId(`mission-beamer-card-${beamer.json.id}`);
  await expect(card).toBeVisible({ timeout: 20_000 });

  await card.getByTestId(`mission-beamer-mode-${beamer.json.id}`).selectOption('next_matches');

  await expect.poll(async () => {
    const beamers = await client.get<Array<{
      id: number;
      display_state: string;
      config: { display_mode?: string; match_filter?: string };
    }>>(`/tournaments/${tournament.id}/beamers`);
    expectStatus(beamers, 200, 'fetch beamers after next matches mode change');
    const updated = beamers.json.find((candidate) => candidate.id === beamer.json.id);
    return {
      displayState: updated?.display_state,
      displayMode: updated?.config.display_mode,
      matchFilter: updated?.config.match_filter ?? null,
    };
  }, { timeout: 20_000 }).toEqual({
    displayState: 'between_games',
    displayMode: 'next_matches',
    matchFilter: 'state:finished',
  });

  const matchSelect = card.getByTestId(`mission-beamer-match-${beamer.json.id}`);
  await expect(matchSelect).toBeVisible({ timeout: 20_000 });
  await expect(matchSelect).toHaveValue('state:finished');
  await matchSelect.selectOption('state:in_progress');

  await expect.poll(async () => {
    const beamers = await client.get<Array<{
      id: number;
      display_state: string;
      config: { display_mode?: string; match_filter?: string };
    }>>(`/tournaments/${tournament.id}/beamers`);
    expectStatus(beamers, 200, 'fetch beamers after next matches filter change');
    const updated = beamers.json.find((candidate) => candidate.id === beamer.json.id);
    return {
      displayState: updated?.display_state,
      displayMode: updated?.config.display_mode,
      matchFilter: updated?.config.match_filter ?? null,
    };
  }, { timeout: 20_000 }).toEqual({
    displayState: 'between_games',
    displayMode: 'next_matches',
    matchFilter: 'state:in_progress',
  });
});

test('Mission Control loads transaction log lazily in Verlauf tab', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  let logRequests = 0;

  await page.route('**/api/tournaments/*/transaction_log', async (route) => {
    logRequests += 1;
    await route.continue();
  });

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Verlauf' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(logRequests).toBe(0);

  await page.getByRole('link', { name: 'Verlauf' }).click();
  await expect(page).toHaveURL(/#history$/);
  await expect(page.getByTestId('mission-transaction-log')).toBeVisible();
  await expect.poll(async () => logRequests, { timeout: 20_000 }).toBe(1);

  const entries = page.getByTestId('mission-transaction-log-entry');
  await expect(entries.first()).toBeVisible({ timeout: 20_000 });
  await expect(entries.first()).toContainText('tournament.created');
  await expect(page.getByTestId('mission-transaction-log-sequence').first()).toHaveText('#1');

  const sequences = await page.getByTestId('mission-transaction-log-sequence').evaluateAll((elements) => (
    elements.map((element) => Number((element.textContent ?? '').replace('#', '')))
  ));
  const sortedSequences = [...sequences].sort((left, right) => left - right);
  expect(sequences).toEqual(sortedSequences);

  await page.getByRole('link', { name: 'Timer', exact: true }).click();
  await page.getByTestId('mission-timer-quick-20s').click();
  await expect.poll(async () => logRequests, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

  await page.getByRole('link', { name: 'Verlauf' }).click();
  await expect(entries.filter({ hasText: 'tournament.timer_changed' }).first()).toBeVisible({ timeout: 20_000 });

  const requestsAfterMutationRefresh = logRequests;
  await page.getByRole('link', { name: 'Teams' }).click();
  await page.getByRole('link', { name: 'Verlauf' }).click();
  await page.waitForTimeout(500);
  expect(logRequests).toBe(requestsAfterMutationRefresh);

  await page.getByTestId('mission-transaction-log-refresh').click();
  await expect.poll(async () => logRequests, { timeout: 20_000 }).toBeGreaterThanOrEqual(
    requestsAfterMutationRefresh + 1,
  );
});

test('Mission Control changes active timer reason without restarting timer', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();
  const timerPatchBodies: unknown[] = [];

  await page.route('**/api/tournaments/*/timer', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      const postData = request.postData();
      timerPatchBodies.push(postData ? JSON.parse(postData) : {});
    }
    await route.continue();
  });

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('mission-timer-reason-select')).toContainText('Kein Grund');

  await page.getByTestId('mission-timer-quick-2015').click();
  await expect(page.getByTestId('mission-timer-reason-save')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('mission-timer-reason-remove')).toBeDisabled();
  await expect(page.getByTestId('mission-current-timer-display')).toContainText(/\d{1,2}:[0-5][0-9]/);

  const started = await timerState(client, tournament.id);
  expect(started.mode).toBe('countdown');
  expect(started.timestamp).toBeTruthy();
  expect(started.reason).toBeNull();
  expect(started.reasonText).toBeNull();
  expect(timerPatchBodies[timerPatchBodies.length - 1]).toEqual({
    timestamp_seconds: (20 * 60) + 15,
    timer_mode: 'countdown',
    timer_reason: null,
  });

  await page.getByTestId('mission-timer-reason-select').selectOption('playoff_start');
  await page.getByTestId('mission-timer-reason-save').click();
  await expect.poll(async () => timerState(client, tournament.id), { timeout: 20_000 }).toEqual({
    timestamp: started.timestamp,
    mode: 'countdown',
    reason: 'playoff_start',
    reasonText: null,
  });
  expect(timerPatchBodies[timerPatchBodies.length - 1]).toEqual({ timer_reason: 'playoff_start' });
  await expect(page.getByTestId('mission-current-timer-reason')).toContainText('Playoff-Start', {
    timeout: 20_000,
  });

  await page.getByTestId('mission-timer-reason-select').selectOption('custom');
  await page.getByTestId('mission-timer-reason-text').fill('Opening ceremony ran long');
  await page.getByTestId('mission-timer-reason-save').click();
  await expect.poll(async () => timerState(client, tournament.id), { timeout: 20_000 }).toEqual({
    timestamp: started.timestamp,
    mode: 'countdown',
    reason: 'custom',
    reasonText: 'Opening ceremony ran long',
  });
  expect(timerPatchBodies[timerPatchBodies.length - 1]).toEqual({
    timer_reason: 'custom',
    timer_reason_text: 'Opening ceremony ran long',
  });
  await expect(page.getByTestId('mission-current-timer-reason')).toContainText('Opening ceremony ran long', {
    timeout: 20_000,
  });

  await page.getByTestId('mission-timer-reason-remove').click();
  await expect.poll(async () => timerState(client, tournament.id), { timeout: 20_000 }).toEqual({
    timestamp: started.timestamp,
    mode: 'countdown',
    reason: null,
    reasonText: null,
  });
  expect(timerPatchBodies[timerPatchBodies.length - 1]).toEqual({ timer_reason: null });
  await expect(page.getByTestId('mission-current-timer-reason')).toContainText('Timer', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('mission-timer-reason-select')).toHaveValue('');
});

test('Mission Control stores failed saves locally and retries them from Verlauf', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  let timerPatchRequests = 0;

  await page.route(`**/api/tournaments/${tournament.id}/timer`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    timerPatchRequests += 1;
    if (timerPatchRequests === 1) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Timer state is stale' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ timer_mode: 'countdown', timestamp_seconds: 20 }),
    });
  });

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('mission-timer-quick-20s').click();
  await expect.poll(async () => timerPatchRequests, { timeout: 20_000 }).toBe(1);

  await expect.poll(async () => page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem('turniere.localSaveErrorLog.v1') || '[]');
    return entries.length;
  }), { timeout: 20_000 }).toBe(1);

  await page.getByRole('link', { name: 'Verlauf' }).click();
  const localLog = page.getByTestId('mission-local-save-error-log');
  await expect(localLog.getByTestId('mission-local-save-error-storage-warning')).toContainText('localStorage');
  await expect(localLog.getByTestId('mission-local-save-error-storage-warning')).toContainText(
    'nicht zwischen Geräten synchronisiert',
  );
  await expect(localLog.getByTestId('mission-local-save-error-storage-warning')).toContainText('gefährlich');

  const entry = localLog.getByTestId('mission-local-save-error-entry').first();
  await expect(entry).toBeVisible();
  await expect(entry.getByTestId('mission-local-save-error-summary')).toContainText(
    `/tournaments/${tournament.id}/timer`,
  );
  await expect(entry.getByTestId('mission-local-save-error-summary')).toContainText('HTTP 409');

  await entry.getByTestId('mission-local-save-error-summary').click();
  await expect(entry.getByTestId('mission-local-save-error-message')).toContainText('Timer state is stale');
  await expect(entry.getByTestId('mission-local-save-error-payload')).toContainText('"timestamp_seconds": 20');
  await expect(entry.getByTestId('mission-local-save-error-payload')).toContainText('"timer_mode": "countdown"');

  await entry.getByTestId('mission-local-save-error-retry').click();
  await expect.poll(async () => timerPatchRequests, { timeout: 20_000 }).toBe(2);
  await expect(entry.getByTestId('mission-local-save-error-retry-status')).toContainText('erfolgreich');
  await expect(entry).toHaveClass(/has-success-response/);
  await expect(entry.getByTestId('mission-local-save-error-retry-response')).toContainText('"timer_mode"');
  await expect(entry.getByText('Retry OK')).toBeVisible();

  const retryState = await page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem('turniere.localSaveErrorLog.v1') || '[]');
    return entries[0];
  });
  expect(retryState.lastRetryResult).toBe('success');

  await entry.getByTestId('mission-local-save-error-remove').click();
  await expect(localLog.getByTestId('mission-local-save-error-empty')).toBeVisible();
});

test('Owner runs live tournament operations from Mission Control', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(4, 4, 8);
  const client = new ApiClient(backendUrl);

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole('link', { name: 'Timer', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ergebnisse' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Match-Infos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Teams' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Checklisten' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Verlauf' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Turnier-Einstellungen' })).toBeVisible();
  await expect(page.getByTestId('mission-tournament-link')).toHaveAttribute('href', `/t/${tournament.id}`);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const initialScoresPane = page.locator('.tab-pane.active');
  await expect(initialScoresPane.getByTestId('mission-control-search')).toBeFocused();
  await keyframe(page, testInfo, 'mission_control_open');

  await page.getByRole('link', { name: 'Match-Starts' }).click();
  await expect(page).toHaveURL(/#starts$/);
  const startsPane = page.locator('.tab-pane.active');
  const groupStart = page.getByTestId('mission-start-next-groups');
  await expectMatchStateCount(client, tournament.id, 'in_progress', 0);
  await groupStart.click();
  await page.waitForTimeout(250);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectMatchStateCount(client, tournament.id, 'in_progress', 0);
  await holdStartUntilConfirmOpen(page, groupStart);
  const groupDialog = page.getByTestId('mission-start-confirm-modal');
  await expect(groupDialog.getByRole('heading', { name: 'Match-Starts bestätigen' })).toBeVisible();
  await expect(groupDialog).toContainText('Nächste offene Gruppenmatches');
  await expectMatchStateCount(client, tournament.id, 'in_progress', 0);
  await groupDialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(groupDialog).toHaveCount(0);
  await expectMatchStateCount(client, tournament.id, 'in_progress', 0);
  await holdStartUntilConfirmOpen(page, groupStart);
  await page.getByTestId('mission-start-confirm-ok').click();
  await expectMatchStateCountAtLeast(client, tournament.id, 'in_progress', firstGroupStartCount);
  await expect(startsPane.getByTestId('mission-match-card')).toHaveCount(0);
  await keyframe(page, testInfo, 'mission_control_bulk_start_only');

  await page.getByRole('link', { name: 'Ergebnisse' }).click();
  await expect(page).toHaveURL(/#scores$/);
  const scoresPane = page.locator('.tab-pane.active');
  await expect(scoresPane.getByTestId('mission-control-search')).toBeVisible();
  await expect(scoresPane.getByText('Cmd+K')).toBeVisible();
  await scoresPane.getByTestId('mission-control-search').fill('gruppe 1');
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 1 6 Matches' })).toBeVisible();
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 2 0 Matches' })).toHaveCount(0);
  const notStartedCard = scoresPane.getByTestId('mission-match-card').filter({ hasText: 'Not Started' }).first();
  const notStartedScore = notStartedCard.locator('input[type="number"]').first();
  await expect(notStartedCard.getByTestId('mission-match-lock')).toBeVisible();
  await expect(notStartedCard.getByRole('button', { name: /Locked/ })).toHaveCount(0);
  await expect(notStartedScore).toBeDisabled();
  await notStartedCard.getByTestId('mission-match-lock').dispatchEvent('pointerdown', {
    pointerId: 42,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
  });
  await page.waitForTimeout(700);
  await notStartedCard.getByTestId('mission-match-lock').dispatchEvent('pointerup', {
    pointerId: 42,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
  });
  await expect(notStartedScore).toBeDisabled();

  await scoresPane.getByTestId('mission-control-search').fill('G1-S1');
  const activeCard = scoresPane
    .getByTestId('mission-match-card')
    .filter({ hasText: 'G1-S1' })
    .filter({ hasText: 'G1-S2' });
  await expect(activeCard).toHaveCount(1);
  await expect(activeCard.locator('.mission-start-table')).toHaveCount(0);
  const g1s1Score = activeCard.getByLabel('G1-S1 score');
  const g1s2Score = activeCard.getByLabel('G1-S2 score');
  await g1s1Score.fill('7');
  await g1s2Score.fill('4');
  await expect(g1s1Score).toHaveValue('7');
  await expect(g1s2Score).toHaveValue('4');
  await g1s2Score.press(submitShortcut);
  await expectMatchStateCountAtLeast(client, tournament.id, 'in_progress', firstGroupStartCount);
  await expect(g1s1Score).toHaveValue('7', {
    timeout: 20_000,
  });
  await expect(g1s2Score).toHaveValue('4', {
    timeout: 20_000,
  });
  await keyframe(page, testInfo, 'mission_control_saved_live_score');

  await expect(activeCard.getByLabel('Live')).toBeVisible({ timeout: 20_000 });
  await expect(activeCard.getByLabel('Live')).toBeChecked();
  await expect(activeCard.getByTestId('mission-match-lock')).toHaveCount(0);
  await activeCard.getByLabel('Live').uncheck();
  await expect(activeCard.getByLabel('Live')).not.toBeChecked();
  await activeCard.getByTestId('mission-match-save').click();
  await expectMatchStateCount(client, tournament.id, 'finished', 1);
  await expect(scoresPane.getByTestId('mission-match-card').filter({ hasText: 'finished' }).first()).toBeVisible({
    timeout: 20_000,
  });
  await keyframe(page, testInfo, 'mission_control_finished_match');

  await expect(g1s1Score).toBeDisabled();
  await expect(activeCard.getByTestId('mission-match-lock')).toHaveAttribute(
    'title',
    'Gedrückt halten, um Ergebnis kurz zu entsperren',
  );
  await holdMouseUntilUnlocked(page, activeCard);
  await expect(g1s1Score).toBeEnabled();
  await g1s1Score.fill('8');
  await g1s2Score.fill('5');
  await g1s2Score.press(submitShortcut);
  await expectMatchStateCount(client, tournament.id, 'finished', 1);
  await expect(g1s1Score).toHaveValue('8', { timeout: 20_000 });
  await expect(g1s2Score).toHaveValue('5', { timeout: 20_000 });
  await keyframe(page, testInfo, 'mission_control_unlocked_finished_score');

  await expect(g1s1Score).toBeDisabled({ timeout: 20_000 });
  await holdTouchUntilUnlocked(page, activeCard);
  await expect(g1s1Score).toBeEnabled();
  await g1s1Score.fill('9');
  await g1s2Score.fill('6');
  await g1s2Score.press(submitShortcut);
  await expectMatchStateCount(client, tournament.id, 'finished', 1);
  await expect(g1s1Score).toHaveValue('9', { timeout: 20_000 });
  await expect(g1s2Score).toHaveValue('6', { timeout: 20_000 });

  await expect(g1s1Score).toBeDisabled({ timeout: 20_000 });
  await holdSpaceUntilUnlocked(page, activeCard);
  await expect(g1s1Score).toBeEnabled();
  await expectUnlockProgressDrainsAndLocks(activeCard, g1s1Score);

  await page.getByRole('link', { name: 'Teams' }).click();
  await expect(page).toHaveURL(/#teams$/);
  const teamsPane = page.locator('.tab-pane.active');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await expect(teamsPane.getByTestId('mission-control-search')).toBeFocused();
  await teamsPane.getByTestId('mission-control-search').fill('G1-S1');
  const renamed = `G1-S1 Mission ${Date.now()}`;
  const visibleTeamInput = teamsPane.locator('input.form-control').nth(1);
  await expect(visibleTeamInput).toHaveValue('G1-S1');
  await visibleTeamInput.fill(renamed);
  await visibleTeamInput.press('Enter');
  await expect(visibleTeamInput).toHaveValue(renamed, { timeout: 20_000 });
  await keyframe(page, testInfo, 'mission_control_renamed_team');

  await expect.poll(async () => {
    const teams = await client.get<{ teams: Array<{ id: number; name: string }> }>(`/tournaments/${tournament.id}`);
    expectStatus(teams, 200, 'fetch tournament after team rename');
    return teams.json.teams.some((team) => team.name === renamed);
  }, { timeout: 20_000 }).toBe(true);

  await page.goto(`/t/${tournament.id}/mission-control#scores`);
  await expect(page.getByTestId('mission-score-control')).toBeVisible({ timeout: 20_000 });
  await injectAuth(context);
  await page.goto(`/t/${tournament.id}/mission-control?tab=teams`);
  await expect(page.locator('.tab-pane.active').getByRole('heading', { name: 'Teams' })).toBeVisible({
    timeout: 20_000,
  });
  await page.goto(`/t/${tournament.code}`);
  await expect(page).toHaveURL(new RegExp(`/t/${tournament.id}$`), { timeout: 20_000 });
});

test('Mission Control links player accounts to teams and profile page', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(1, 4, 2);
  const ownerClient = await loggedInClient();
  const unique = Date.now().toString(36);
  const playerEmail = `tur225-player-${unique}@example.com`;
  let playerDisplayName = playerEmail;

  const team = tournament.teams[0];
  await page.goto(`/t/${tournament.id}/mission-control#teams`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  const teamsPane = page.locator('.tab-pane.active');
  await expect(teamsPane.getByTestId('mission-control-search')).toBeVisible();
  await teamsPane.getByTestId('mission-control-search').fill(team.name);
  const teamCard = teamsPane.locator(`[data-testid="mission-team-card"][data-team-id="${team.id}"]`);
  await expect(teamCard.getByTestId('mission-team-name')).toHaveValue(team.name);
  await expect(teamCard.getByTestId('mission-team-players-empty')).toBeVisible();

  await teamCard.getByTestId('mission-team-player-email').fill(playerEmail);
  await teamCard.getByTestId('mission-team-player-add').click();

  let playerId = 0;
  await expect.poll(async () => {
    const tournamentResponse = await ownerClient.get<{
      teams: Array<{
        id: number;
        players?: Array<{ id: number; name?: string; username?: string }>;
      }>;
    }>(`/tournaments/${tournament.id}`);
    expectStatus(tournamentResponse, 200, 'fetch tournament after player link');
    const updatedTeam = tournamentResponse.json.teams.find((candidate) => candidate.id === team.id);
    const player = updatedTeam?.players?.[0];
    playerId = player?.id ?? 0;
    playerDisplayName = player?.username || player?.name || playerEmail;
    return playerId;
  }, { timeout: 20_000 }).toBeGreaterThan(0);

  await expect(teamCard.getByTestId('mission-team-player')).toContainText(playerDisplayName, { timeout: 20_000 });
  await keyframe(page, testInfo, 'mission_control_team_players');

  const profileLink = teamCard.getByTestId('mission-team-player-profile').filter({ hasText: playerDisplayName });
  await expect(profileLink).toHaveAttribute('href', `/profiles/${playerId}`);

  await page.goto(`/profiles/${playerId}`);
  await expect(page.getByTestId('account-profile')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: playerDisplayName })).toBeVisible();
  await expect(page.getByTestId('account-profile-teams')).toContainText(team.name);
  await expect(page.getByTestId('account-profile-teams')).toContainText(tournament.name);
  await keyframe(page, testInfo, 'account_profile_team_owner');

  await page.goto(`/t/${tournament.id}/mission-control#teams`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  const refreshedPane = page.locator('.tab-pane.active');
  await refreshedPane.getByTestId('mission-control-search').fill(playerDisplayName);
  const refreshedTeamCard = refreshedPane.locator(`[data-testid="mission-team-card"][data-team-id="${team.id}"]`);
  await expect(refreshedTeamCard.getByTestId('mission-team-player')).toContainText(playerDisplayName);
  await refreshedTeamCard.getByTestId('mission-team-player-remove').click();
  await refreshedPane.getByTestId('mission-control-search').fill(team.name);
  await expect(refreshedTeamCard.getByTestId('mission-team-players-empty')).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => {
    const tournamentResponse = await ownerClient.get<{
      teams: Array<{ id: number; players?: Array<{ id: number }> }>;
    }>(`/tournaments/${tournament.id}`);
    expectStatus(tournamentResponse, 200, 'fetch tournament after player removal');
    const updatedTeam = tournamentResponse.json.teams.find((candidate) => candidate.id === team.id);
    return updatedTeam?.players?.length ?? 0;
  }, { timeout: 20_000 }).toBe(0);
});

test('Mission Control stops and restarts a running match', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();
  const groupStage = tournament.stages.find((stage) => stage.level === -1);
  const runningMatch = groupStage!.groups[0].matches[0];
  const teamNames = runningMatch.match_scores.map((score) => score.team!.name);

  const started = await client.patch(`/matches/${runningMatch.id}`, { state: 'in_progress' });
  expectStatus(started, 200, 'start match for stop control');

  await page.goto(`/t/${tournament.id}/mission-control#scores`);
  await expect(page.getByTestId('mission-score-control')).toBeVisible({ timeout: 20_000 });
  const scoresPane = page.locator('.tab-pane.active');
  await scoresPane.getByTestId('mission-control-search').fill(teamNames[0]);
  const card = scoresPane
    .getByTestId('mission-match-card')
    .filter({ hasText: teamNames[0] })
    .filter({ hasText: teamNames[1] });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('data-match-id', String(runningMatch.id));
  await expect(card.getByTestId('mission-match-stop')).toBeVisible();
  await expect(card.getByTestId('mission-match-save')).toBeEnabled();

  await card.getByTestId('mission-match-stop').click();
  await expect.poll(async () => {
    const match = await client.get<{ state: string }>(`/matches/${runningMatch.id}`);
    expectStatus(match, 200, 'fetch stopped match');
    return match.json.state;
  }, { timeout: 20_000 }).toBe('not_started');
  await expect(card.getByText('Not Started')).toBeVisible({ timeout: 20_000 });
  await expect(card.getByTestId('mission-match-start')).toBeVisible();
  await expect(card.getByTestId('mission-match-stop')).toHaveCount(0);
  await expect(card.getByTestId('mission-match-save')).toBeDisabled();

  await card.getByTestId('mission-match-start').click();
  await expect.poll(async () => {
    const match = await client.get<{ state: string }>(`/matches/${runningMatch.id}`);
    expectStatus(match, 200, 'fetch restarted match');
    return match.json.state;
  }, { timeout: 20_000 }).toBe('in_progress');
  await expect(card.getByTestId('mission-match-stop')).toBeVisible({ timeout: 20_000 });
  await expect(card.getByTestId('mission-match-save')).toBeEnabled();
});

test('Mission Control edits match metadata one-by-one and in bulk', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();
  const groupStage = tournament.stages.find((stage) => stage.level === -1);
  const firstMatch = groupStage!.groups[0].matches[0];
  const secondMatch = groupStage!.groups[0].matches[1];
  const firstTeamNames = firstMatch.match_scores.map((score) => score.team!.name);
  const secondTeamNames = secondMatch.match_scores.map((score) => score.team!.name);

  await page.goto(`/t/${tournament.id}/mission-control#metadata`);
  await expect(page.getByTestId('mission-metadata-control')).toBeVisible({ timeout: 20_000 });
  const metadataPane = page.locator('.tab-pane.active');
  await expect(metadataPane.getByTestId('mission-control-search')).toBeVisible();
  await metadataPane.getByTestId('mission-control-search').fill(firstTeamNames[0]);
  const firstCard = metadataPane
    .getByTestId('mission-metadata-card')
    .filter({ hasText: firstTeamNames[0] })
    .filter({ hasText: firstTeamNames[1] });
  await expect(firstCard).toHaveCount(1);

  await firstCard.getByTestId('mission-metadata-location').fill('Main Hall');
  await firstCard.getByTestId('mission-metadata-start-time').fill('17:00');
  await firstCard.getByTestId('mission-metadata-notes').fill('Opening match. Stream setup needed.');
  await firstCard.getByTestId('mission-metadata-save').click();

  await expect.poll(async () => {
    const match = await client.get<{ location: string; start_time: string; notes: string }>(
      `/matches/${firstMatch.id}`,
    );
    expectStatus(match, 200, 'fetch match metadata after single save');
    return {
      location: match.json.location,
      startTime: match.json.start_time,
      notes: match.json.notes,
    };
  }, { timeout: 20_000 }).toEqual({
    location: 'Main Hall',
    startTime: '17:00',
    notes: 'Opening match. Stream setup needed.',
  });

  await metadataPane.getByTestId('mission-control-search').fill('');
  const bulkForm = metadataPane.getByTestId('mission-metadata-bulk-form');
  await bulkForm.getByTestId('mission-metadata-bulk-selector-type').selectOption('match_ids');
  await bulkForm
    .locator('.mission-metadata-match-option')
    .filter({ hasText: firstTeamNames[0] })
    .filter({ hasText: firstTeamNames[1] })
    .getByTestId('mission-metadata-bulk-match')
    .check();
  await bulkForm
    .locator('.mission-metadata-match-option')
    .filter({ hasText: secondTeamNames[0] })
    .filter({ hasText: secondTeamNames[1] })
    .getByTestId('mission-metadata-bulk-match')
    .check();
  await bulkForm.getByTestId('mission-metadata-bulk-location').fill('Court 2');
  await bulkForm.getByTestId('mission-metadata-bulk-start-time').fill('18:30');
  await bulkForm.getByTestId('mission-metadata-bulk-notes').fill('Second wave.');
  await bulkForm.getByTestId('mission-metadata-bulk-save').click();

  await expect.poll(async () => {
    const first = await client.get<{ location: string; start_time: string; notes: string }>(
      `/matches/${firstMatch.id}`,
    );
    const second = await client.get<{ location: string; start_time: string; notes: string }>(
      `/matches/${secondMatch.id}`,
    );
    expectStatus(first, 200, 'fetch first match metadata after bulk save');
    expectStatus(second, 200, 'fetch second match metadata after bulk save');
    return [first.json, second.json].map((match) => ({
      location: match.location,
      startTime: match.start_time,
      notes: match.notes,
    }));
  }, { timeout: 20_000 }).toEqual([
    { location: 'Court 2', startTime: '18:30', notes: 'Second wave.' },
    { location: 'Court 2', startTime: '18:30', notes: 'Second wave.' },
  ]);
});

test('Mission Control keeps Ergebnisse search pinned while scrolling scores', async ({
  context,
  page,
}, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1280, height: 720 });
  const { tournament } = await seedGroupStageTournament(8, 4, 8);

  await page.goto(`/t/${tournament.id}/mission-control#scores`);
  await expect(page.getByTestId('mission-score-control')).toBeVisible({ timeout: 20_000 });
  const scoresPane = page.locator('.tab-pane.active');
  const toolbar = scoresPane.locator('.mission-match-toolbar');
  const search = scoresPane.getByTestId('mission-control-search');
  await expect(search).toBeVisible();
  await expect(toolbar).toHaveCSS('position', 'sticky');
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), {
    timeout: 5_000,
  }).toBeGreaterThan(400);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => page.evaluate(() => {
    window.scrollBy(0, Math.max(200, Math.round(window.innerHeight / 2)));
    const toolbarElement = document.querySelector('.tab-pane.active .mission-match-toolbar');
    if (!toolbarElement) {
      return Number.POSITIVE_INFINITY;
    }
    const toolbarTop = toolbarElement.getBoundingClientRect().top;
    const stickyTop = Number.parseFloat(window.getComputedStyle(toolbarElement).top);
    return Math.abs(Math.round(toolbarTop - stickyTop));
  }), {
    timeout: 5_000,
  }).toBeLessThanOrEqual(2);
  const pinnedGeometry = await toolbar.evaluate((el) => {
    const navbar = document.querySelector('.navbar.sticky-top');
    const navbarBottom = navbar?.getBoundingClientRect().bottom ?? 0;
    const rect = el.getBoundingClientRect();
    const stickyTop = Number.parseFloat(window.getComputedStyle(el).top);
    const inputRect = el.querySelector('[data-testid="mission-control-search"]')?.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      navbarBottom: Math.round(navbarBottom),
      stickyTop: Math.round(stickyTop),
      inputTop: Math.round(inputRect?.top ?? -1),
      inputBottom: Math.round(inputRect?.bottom ?? -1),
      inputWidth: Math.round(inputRect?.width ?? 0),
      viewportHeight: window.innerHeight,
    };
  });

  expect(pinnedGeometry.top).toBeGreaterThanOrEqual(pinnedGeometry.stickyTop - 2);
  expect(pinnedGeometry.top).toBeLessThanOrEqual(pinnedGeometry.stickyTop + 2);
  expect(pinnedGeometry.stickyTop).toBeGreaterThanOrEqual(pinnedGeometry.navbarBottom + 4);
  expect(pinnedGeometry.stickyTop).toBeLessThanOrEqual(pinnedGeometry.navbarBottom + 24);
  expect(pinnedGeometry.bottom).toBeLessThan(pinnedGeometry.viewportHeight);
  expect(pinnedGeometry.inputTop).toBeGreaterThanOrEqual(pinnedGeometry.top);
  expect(pinnedGeometry.inputBottom).toBeLessThanOrEqual(pinnedGeometry.bottom);
  expect(pinnedGeometry.inputWidth).toBeGreaterThan(220);

  await search.fill('gruppe 8');
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 8 6 Matches' })).toBeVisible();
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 1 6 Matches' })).toHaveCount(0);
  await keyframe(page, testInfo, 'mission_control_scores_search_pinned');
});

test('Mission Control saves independent beamer display controls instantly', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const main = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Zeta stage',
    display_state: 'between_games',
    config: {},
  });
  expectStatus(main, 201, 'create zeta stage beamer');
  const side = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Alpha wall',
    display_state: 'group_tables',
    config: {},
  });
  expectStatus(side, 201, 'create alpha wall beamer');

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Beamer' }).click();

  await expect(page.getByTestId('mission-beamer-control')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aktualisieren' })).toHaveCount(0);
  await expect(page.getByText('Zeta stage')).toBeVisible();
  await expect(page.getByText('Alpha wall')).toBeVisible();
  await expectBeamerCardOrder(page, ['Alpha wall', 'default', 'Zeta stage']);
  await expect(page.getByTestId(`mission-beamer-mode-${main.json.id}`)).toHaveValue('between_games');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toBeVisible();
  const mainMatchSelect = page.getByTestId(`mission-beamer-match-${main.json.id}`);
  await expect(mainMatchSelect.locator('option').filter({ hasText: /^Gruppenphase Runde 1$/ }))
    .toHaveAttribute('value', 'group_stage_position:0');
  await expect(mainMatchSelect.locator('option').filter({ hasText: /^Gruppenphase Runde 1 - Laufend$/ }))
    .toHaveAttribute('value', 'group_stage_position:0,state:in_progress');
  await expect(mainMatchSelect.locator('option').filter({ hasText: /Gruppenphase Tisch/ })).toHaveCount(0);
  await expect(page.getByTestId(`mission-beamer-mode-${side.json.id}`)).toHaveValue('group_tables');
  await expect(page.getByTestId(`mission-beamer-match-${side.json.id}`)).toHaveCount(0);
  await keyframe(page, testInfo, 'beamer_control_tur37');

  await page.getByTestId(`mission-beamer-mode-${main.json.id}`).selectOption('during_game');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; display_state: string }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after mode update');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.display_state;
  }, { timeout: 20_000 }).toBe('during_game');
  await expectBeamerCardOrder(page, ['Alpha wall', 'default', 'Zeta stage']);
  await expect(page.getByTestId(`mission-beamer-mode-${side.json.id}`)).toHaveValue('group_tables');

  await page.getByTestId(`mission-beamer-match-${main.json.id}`).selectOption('state:in_progress');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toHaveValue('state:in_progress');
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; config?: { match_filter?: string } }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after match filter update');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.config?.match_filter;
  }, { timeout: 20_000 }).toBe('state:in_progress');

  await page.getByTestId(`mission-beamer-mode-${main.json.id}`).selectOption('static_image');
  const staticImages = page.getByTestId(`mission-beamer-static-image-list-${main.json.id}`);
  await expect(staticImages).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(`mission-beamer-static-image-${main.json.id}-bpwstr_logo`)).toBeChecked();
  await page.getByTestId(`mission-beamer-static-image-${main.json.id}-bpwstr_qr_code`).check();
  await expect(page.getByTestId(`mission-beamer-static-image-${main.json.id}-bpwstr_qr_code`)).toBeChecked();
  await expect(page.getByTestId(`mission-beamer-static-image-${main.json.id}-bpwstr_logo`)).not.toBeChecked();
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; config?: { image_key?: string } }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after image update');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.config?.image_key;
  }, { timeout: 20_000 }).toBe('bpwstr_qr_code');

  await page.getByTestId(`mission-beamer-mode-${main.json.id}`).selectOption('timer_only');
  await expect(page.getByTestId(`mission-beamer-mode-${main.json.id}`)).toHaveValue('timer_only');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`mission-beamer-static-image-list-${main.json.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`mission-beamer-timer-reason-${main.json.id}`)).toBeChecked({ timeout: 20_000 });
  await expect(page.getByText('Timer Only · Nur Timer')).toBeVisible({ timeout: 20_000 });
  await keyframe(page, testInfo, 'beamer_timer_only_reason_setting');
  await expect.poll(async () => {
    const updated = await client.get<Array<{
      id: number;
      display_state: string;
      config?: { display_mode?: string; show_timer_reason?: boolean };
    }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after timer-only update');
    const beamer = updated.json.find((candidate) => candidate.id === main.json.id);
    return `${beamer?.display_state}:${beamer?.config?.display_mode}:${beamer?.config?.show_timer_reason}`;
  }, { timeout: 20_000 }).toBe('during_game:timer_only:true');

  await page.getByTestId(`mission-beamer-timer-reason-${main.json.id}`).uncheck();
  await expect(page.getByTestId(`mission-beamer-timer-reason-${main.json.id}`)).not.toBeChecked();
  await keyframe(page, testInfo, 'beamer_timer_only_without_reason_setting');
  await expect.poll(async () => {
    const updated = await client.get<Array<{
      id: number;
      display_state: string;
      config?: { display_mode?: string; show_timer_reason?: boolean };
    }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after timer-only reason toggle');
    const beamer = updated.json.find((candidate) => candidate.id === main.json.id);
    return `${beamer?.display_state}:${beamer?.config?.display_mode}:${beamer?.config?.show_timer_reason}`;
  }, { timeout: 20_000 }).toBe('during_game:timer_only:false');
  await expectBeamerCardOrder(page, ['Alpha wall', 'default', 'Zeta stage']);
});

test('Mission Control soundboard controls beamer audio with timer priority', async ({ context, page }, testInfo) => {
  test.setTimeout(180_000);
  await injectAuth(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const beamer = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Soundboard',
    display_state: 'static_image',
    config: { image_key: 'bpwstr_logo' },
  });
  expectStatus(beamer, 201, 'create soundboard beamer');

  const beamerPage = await context.newPage();
  await installBeamerEffectSpies(beamerPage);
  await beamerPage.goto(`/t/${tournament.id}/fullscreen?beamer=${encodeURIComponent('Soundboard')}`);
  await waitForBeamerEffect(beamerPage, 'audio-permission-allowed');
  await waitForActionCableSubscription(beamerPage, {
    channel: 'TournamentBeamersChannel',
    tournament_id: tournament.id,
    beamer_name: 'Soundboard',
  });

  await page.goto(`/t/${tournament.id}/mission-control#beamer`);
  await expect(page.getByTestId('mission-beamer-control')).toBeVisible({ timeout: 20_000 });
  const card = page.getByTestId(`mission-beamer-card-${beamer.json.id}`);
  await expect(card.getByTestId(`mission-beamer-soundboard-${beamer.json.id}`)).toBeVisible();
  await expect(card.getByTestId(`mission-sound-play-${beamer.json.id}-start-countdown`)).toBeVisible();
  await expect(card.getByTestId(`mission-sound-play-${beamer.json.id}-mid-game-warning`)).toBeVisible();
  await expect(card.getByTestId(`mission-sound-play-${beamer.json.id}-end-countdown`)).toBeVisible();

  const startCount = await countBeamerEffects(beamerPage, 'sound-effect', 'start-countdown');
  const startButton = card.getByTestId(`mission-sound-play-${beamer.json.id}-start-countdown`);
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await waitForBeamerEffect(beamerPage, 'sound-effect', 'start-countdown', startCount + 1);
  await waitForBeamerEffect(beamerPage, 'sound-started', 'start-countdown');

  const warningCount = await countBeamerEffects(beamerPage, 'sound-effect', 'mid-game-warning');
  const warningButton = card.getByTestId(`mission-sound-play-${beamer.json.id}-mid-game-warning`);
  await expect(warningButton).toBeEnabled();
  await warningButton.click();
  await waitForBeamerEffect(beamerPage, 'sound-effect', 'mid-game-warning', warningCount + 1);
  await expect.poll(async () => {
    const events = await beamerPage.evaluate(() => (window as any).__beamerAudioEvents || []);
    return events.some((event) => event.type === 'audio-pause' && event.src.includes('start_countdown.mp3'));
  }, { timeout: 8_000 }).toBe(true);

  const stopButton = card.getByTestId(`mission-sound-stop-${beamer.json.id}`);
  await expect(stopButton).toBeEnabled();
  await stopButton.click();
  await expect.poll(async () => {
    const events = await beamerPage.evaluate(() => (window as any).__beamerTimerEffects?.events || []);
    return events.some((event) => (
      event.type === 'sound-stop' &&
      event.reason === 'soundboard-stop' &&
      event.scope === 'soundboard' &&
      event.stopped === true
    ));
  }, { timeout: 8_000 }).toBe(true);

  const replayCount = await countBeamerEffects(beamerPage, 'sound-effect', 'start-countdown');
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await waitForBeamerEffect(beamerPage, 'sound-effect', 'start-countdown', replayCount + 1);

  const timerCount = await countBeamerEffects(beamerPage, 'sound', 'end-countdown');
  await waitForActionCableSubscription(beamerPage, {
    channel: 'TournamentTimersChannel',
    tournament_id: tournament.id,
  });
  const timerRes = await client.patch(`/tournaments/${tournament.id}/timer`, {
    timestamp_seconds: 12,
  });
  expectStatus(timerRes, 200, 'start timer cue');
  await waitForBeamerEffect(beamerPage, 'sound', 'end-countdown', timerCount + 1);

  const skipCount = await countBeamerEffects(beamerPage, 'sound-effect-skip', 'mid-game-warning');
  await expect(warningButton).toBeEnabled();
  await warningButton.click();
  await waitForBeamerEffect(beamerPage, 'sound-effect-skip', 'mid-game-warning', skipCount + 1);
  await expect.poll(async () => {
    const events = await beamerPage.evaluate(() => (window as any).__beamerTimerEffects?.events || []);
    return events.some((event) => (
      event.type === 'sound-effect-skip' &&
      event.cue === 'mid-game-warning' &&
      event.reason === 'timer-sound-active'
    ));
  }, { timeout: 8_000 }).toBe(true);

  await keyframe(page, testInfo, 'beamer_soundboard');
});

test('Mission Control collapses finished score stages below active stages', async ({ context, page }) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageAndRunToBeforeFinal(2, 4, 4);
  const semifinal = tournament.stages.find((stage) => stage.level === 1);
  expect(semifinal).toBeTruthy();

  await page.goto(`/t/${tournament.id}/mission-control#scores`);
  await expect(page.getByTestId('mission-score-control')).toBeVisible({ timeout: 20_000 });
  const scoresPane = page.locator('.tab-pane.active');
  const finalHeading = scoresPane.getByRole('heading', { name: /Finale \d+ Matches/ });
  await expect(finalHeading).toBeVisible();

  const groupDetails = scoresPane.getByTestId('mission-finished-stage-group-stage');
  const semifinalDetails = scoresPane.getByTestId(`mission-finished-stage-stage-${semifinal!.id}`);
  await expect(groupDetails).toBeVisible();
  await expect(semifinalDetails).toBeVisible();
  await expect(groupDetails.getByTestId('mission-finished-stage-chevron')).toBeVisible();
  await expect(groupDetails).not.toHaveAttribute('open', '');
  await expect(semifinalDetails).not.toHaveAttribute('open', '');
  await expect(groupDetails.getByRole('heading', { name: 'Gruppe 1 6 Matches' })).not.toBeVisible();
  await expect(semifinalDetails.getByRole('heading', { name: 'Halbfinale 2 Matches' })).not.toBeVisible();

  const finalTop = await finalHeading.evaluate((element) => element.getBoundingClientRect().top);
  const groupDetailsTop = await groupDetails.evaluate((element) => element.getBoundingClientRect().top);
  expect(finalTop).toBeLessThan(groupDetailsTop);

  await groupDetails.getByTestId('mission-finished-stage-summary').click();
  await expect(groupDetails).toHaveAttribute('open', '');
  await expect(groupDetails.getByRole('heading', { name: 'Gruppe 1 6 Matches' })).toBeVisible();
  await expect(groupDetails.getByTestId('mission-match-card').filter({ hasText: 'G1-S1' }).first()).toBeVisible();

  await semifinalDetails.getByTestId('mission-finished-stage-summary').click();
  await expect(semifinalDetails).toHaveAttribute('open', '');
  await expect(semifinalDetails.getByRole('heading', { name: 'Halbfinale 2 Matches' })).toBeVisible();
});

test('Mission Control mockup panes cover timer, beamer, and playoff match routing', async ({
  context,
  page,
}, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { tournament } = await seedAndPlayGroupStage(2, 4, 4);
  const client = await loggedInClient();

  const leftStage = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'Left stage',
    display_state: 'between_games',
    config: {},
  });
  expectStatus(leftStage, 201, 'create left stage beamer');
  const backside = await client.post(`/tournaments/${tournament.id}/beamers`, {
    name: 'Backside',
    display_state: 'between_games',
    config: {},
  });
  expectStatus(backside, 201, 'create backside beamer');

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-timer-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('mission-tournament-link')).toHaveText(/Turnier öffnen/);
  await expect(page.getByRole('heading', { name: 'Countdown starten' })).toBeVisible();
  await expect(page.getByTestId('mission-current-timer-display')).toBeVisible();
  await expect(page.getByTestId('mission-timer-reason-control')).toBeVisible();
  await page.getByTestId('mission-timer-reason-select').selectOption('custom');
  await page.getByTestId('mission-timer-reason-text').fill('Final-Call');
  await expect(page.getByTestId('mission-timer-quick-20s')).toContainText('00:20');
  await expect(page.getByTestId('mission-timer-quick-2015')).toContainText('20:15');
  await expect(page.getByRole('heading', { name: 'Countup starten' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timer verwalten' })).toBeVisible();
  await page.locator('#missionTimerMinutes').fill('1');
  await page.locator('#missionTimerSeconds').fill('05');
  await page.locator('#missionTimerSeconds').press('Enter');
  await expect.poll(async () => {
    const timer = await client.get<{
      mode?: string;
      timer_mode?: string;
      timer_reason?: string;
      timer_reason_text?: string;
    }>(`/tournaments/${tournament.id}/timer`);
    expectStatus(timer, 200, 'fetch timer after enter submit');
    return [
      timer.json.mode ?? timer.json.timer_mode,
      timer.json.timer_reason,
      timer.json.timer_reason_text,
    ].join(':');
  }, { timeout: 20_000 }).toBe('countdown:custom:Final-Call');
  await expect(page.getByTestId('mission-current-timer-reason')).toHaveText('Final-Call', { timeout: 20_000 });
  await keyframe(page, testInfo, 'timer_control_mockup');

  await page.getByRole('link', { name: 'Beamer' }).click();
  await expect(page.getByTestId('mission-beamer-control')).toBeVisible();
  await expect(page.getByText('Left stage')).toBeVisible();
  await expect(page.getByText('Backside')).toBeVisible();
  await keyframe(page, testInfo, 'beamer_control_mockup');

  await page.getByTestId('mission-beamer-name').fill('Main hall');
  await page.getByTestId('mission-beamer-create').click();
  await expect(page.getByText('Main hall')).toBeVisible({ timeout: 20_000 });
  const beamers = await client.get<Array<{ id: number; name: string; display_state: string }>>(
    `/tournaments/${tournament.id}/beamers`,
  );
  expectStatus(beamers, 200, 'fetch beamers after create');
  const created = beamers.json.find((beamer) => beamer.name === 'Main hall');
  expect(created).toBeTruthy();

  await page.getByTestId(`mission-beamer-mode-${created!.id}`).selectOption('during_game');
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; name: string; display_state: string }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after update');
    return updated.json.find((beamer) => beamer.id === created!.id)?.display_state;
  }, { timeout: 20_000 }).toBe('during_game');

  await page.getByRole('link', { name: 'Match-Starts' }).click();
  const startsPane = page.locator('.tab-pane.active');
  await expect(startsPane.getByTestId('mission-match-control')).toBeVisible();
  await expect(startsPane.getByRole('heading', { name: 'Bulk Match-Starts' })).toBeVisible();
  const semifinalStart = startsPane.getByRole('button', { name: 'Halbfinale starten' });
  await expect(semifinalStart).toBeVisible();
  await expect(startsPane.getByTestId('mission-match-card')).toHaveCount(0);
  await keyframe(page, testInfo, 'match_starts_bulk_only');
  const runningBeforeSemifinalStart = await matchStateCount(client, tournament.id, 'in_progress');
  await semifinalStart.click();
  await page.waitForTimeout(250);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await matchStateCount(client, tournament.id, 'in_progress')).toBe(runningBeforeSemifinalStart);
  await holdStartUntilConfirmOpen(page, semifinalStart);
  const semifinalDialog = page.getByTestId('mission-start-confirm-modal');
  await expect(semifinalDialog.getByRole('heading', { name: 'Match-Starts bestätigen' })).toBeVisible();
  await expect(semifinalDialog).toContainText('Halbfinale');
  expect(await matchStateCount(client, tournament.id, 'in_progress')).toBe(runningBeforeSemifinalStart);
  await semifinalDialog.getByRole('button', { name: 'OK' }).click();
  await expect.poll(
    async () => matchStateCount(client, tournament.id, 'in_progress'),
    { timeout: 20_000 },
  ).toBeGreaterThan(runningBeforeSemifinalStart);

  await page.getByRole('link', { name: 'Ergebnisse' }).click();
  const scoresPane = page.locator('.tab-pane.active');
  await expect(scoresPane.getByTestId('mission-score-control')).toBeVisible();
  await expect(scoresPane.getByPlaceholder('Gruppen, Teams, Matches suchen...')).toBeVisible();
  await scoresPane.getByTestId('mission-control-search').fill('Halbfinale');
  await expect(scoresPane.getByRole('heading', { name: 'Halbfinale 2 Matches' })).toBeVisible();
  await expect(scoresPane.getByText('Tisch 2 -> Tisch 1')).toBeVisible();
  await expect(scoresPane.getByText('Tisch 1 -> Tisch 1').first()).toBeVisible();
  await keyframe(page, testInfo, 'scores_wide_match_control');

  await scoresPane.getByTestId('mission-control-search').fill('');
  const finishedGroupStage = scoresPane.getByTestId('mission-finished-stage-group-stage');
  await expect(finishedGroupStage).toBeVisible();
  await finishedGroupStage.getByTestId('mission-finished-stage-summary').click();
  await expect(finishedGroupStage).toHaveAttribute('open', '');
  await scoresPane.getByTestId('mission-control-search').fill('G2-S1');
  await expect(scoresPane.getByTestId('mission-match-card').filter({ hasText: 'G2-S1' }).first()).toBeVisible();
  await expect(scoresPane.getByTestId('mission-match-card').filter({ hasText: 'G1-S4' })).toHaveCount(0);
});

test('Mission Control score cards keep long generated team names inside card bounds', async ({
  context,
  page,
}, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { tournament } = await seedGroupStageTournament(2, 4, 4, longGroupStageTeamName);

  await page.goto(`/t/${tournament.id}/mission-control#scores`);
  await expect(page.getByTestId('mission-score-control')).toBeVisible({ timeout: 20_000 });
  const scoresPane = page.locator('.tab-pane.active');
  const card = scoresPane.getByTestId('mission-match-card').filter({
    hasText: LONG_TEAM_NAME_SINGLE_WORD,
  }).first();
  await expect(card).toBeVisible();

  const longName = card.getByTestId('mission-match-team-name').filter({
    hasText: LONG_TEAM_NAME_SINGLE_WORD,
  }).first();
  await expect(longName).toHaveAttribute('title', new RegExp(LONG_TEAM_NAME_SINGLE_WORD));
  await expect(longName).toHaveCSS('overflow-x', 'hidden');
  expect(await longName.evaluate((el) => getComputedStyle(el).textOverflow)).toMatch(/ellipsis|"\.\.\."/);

  const geometry = await card.evaluate((el) => {
    const longTeamName = el.querySelector('[data-testid="mission-match-team-name"]');
    return {
      cardClientWidth: el.clientWidth,
      cardScrollWidth: el.scrollWidth,
      longNameClientWidth: longTeamName?.clientWidth ?? 0,
      longNameScrollWidth: longTeamName?.scrollWidth ?? 0,
    };
  });

  expect(geometry.cardScrollWidth).toBeLessThanOrEqual(geometry.cardClientWidth + 1);
  expect(geometry.longNameScrollWidth).toBeGreaterThan(geometry.longNameClientWidth);
  await keyframe(page, testInfo, 'mission_control_long_team_names_scores');
});

test('Mission Control group tables match compact tournament standings columns', async ({
  context,
  page,
}, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { tournament } = await seedGroupStageTournament(1, 4, 2, longGroupStageTeamName);

  await page.goto(`/t/${tournament.id}/mission-control#scores`);
  await expect(page.getByTestId('mission-score-control')).toBeVisible({ timeout: 20_000 });
  const scoresPane = page.locator('.tab-pane.active');
  await expect(scoresPane.getByRole('heading', { name: 'Gruppe 1 6 Matches' })).toBeVisible();
  const table = scoresPane.getByRole('table').filter({
    hasText: LONG_TEAM_NAME_SINGLE_WORD,
  }).first();
  await expect(table).toBeVisible();
  await expect(table.locator('thead th')).toHaveText(['#', 'Team', 'Pkt.', 'Dif.', 'Gew.']);
  await expect(table.locator('thead')).not.toContainText('Differenz');
  await expect(table.locator('tbody tr').first().locator('td')).toHaveCount(5);
  await expect(table.locator('tbody tr').first().locator('td').nth(4)).toHaveText('0');

  const wideGeometry = await table.evaluate((el) => {
    const stage = el.closest('.mission-match-stage');
    const cells = Array.from(el.querySelectorAll('tbody tr:first-child td')).map((cell) => (
      (cell as HTMLElement).getBoundingClientRect().width
    ));
    return {
      stageWidth: stage?.clientWidth ?? 0,
      tableWidth: el.clientWidth,
      firstColumnWidth: cells[0] ?? 0,
      widestStatColumnWidth: Math.max(...cells.slice(2), 0),
    };
  });
  expect(wideGeometry.tableWidth).toBeLessThanOrEqual(wideGeometry.stageWidth);
  expect(wideGeometry.firstColumnWidth).toBeLessThanOrEqual(80);
  expect(wideGeometry.widestStatColumnWidth).toBeLessThanOrEqual(100);

  await page.setViewportSize({ width: 520, height: 900 });
  const longName = table.getByTestId('team-name').filter({
    hasText: LONG_TEAM_NAME_SINGLE_WORD,
  }).first();
  await expect(longName).toHaveCSS('overflow-x', 'hidden');
  expect(await longName.evaluate((el) => getComputedStyle(el).textOverflow)).toMatch(/ellipsis|"\.\.\."/);

  const narrowGeometry = await table.evaluate((el) => {
    const stage = el.closest('.mission-match-stage');
    const longTeamName = el.querySelector('[data-testid="team-name"]');
    return {
      stageWidth: stage?.clientWidth ?? 0,
      tableWidth: el.clientWidth,
      tableScrollWidth: el.scrollWidth,
      longNameClientWidth: longTeamName?.clientWidth ?? 0,
      longNameScrollWidth: longTeamName?.scrollWidth ?? 0,
    };
  });
  expect(narrowGeometry.tableWidth).toBeLessThanOrEqual(narrowGeometry.stageWidth);
  expect(narrowGeometry.tableScrollWidth).toBeLessThanOrEqual(narrowGeometry.tableWidth + 1);
  expect(narrowGeometry.longNameScrollWidth).toBeGreaterThan(narrowGeometry.longNameClientWidth);
  await keyframe(page, testInfo, 'mission_control_group_table_compact');
});

test('Mission Control hidden for anonymous viewers', async ({ page }, testInfo) => {
  const { tournament } = await seedGroupStageTournament(2, 4, 4);

  await page.goto(`/t/${tournament.id}`);
  await expect(page.getByTestId('mission-control')).toHaveCount(0);
  await keyframe(page, testInfo, 'mission_control_hidden_for_viewer');
});

test('Mission Control shows read-only lockout for owner', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const updated = await client.patch(`/tournaments/${tournament.id}`, { read_only_mode: true });
  expectStatus(updated, 200, 'enable read-only mode');
  test.skip(
    (updated.json as { read_only_mode?: boolean }).read_only_mode !== true,
    'Backend image does not expose read_only_mode in tournament payload.',
  );

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Follower-Modus aktiv. Live-Aktionen sind gesperrt.')).toBeVisible();
  await expect(page.getByTestId('mission-start-next-groups')).toBeDisabled();
  await expect(page.getByTestId('mission-timer-countup')).toBeDisabled();
  await keyframe(page, testInfo, 'mission_control_read_only_lockout');
});
