import { test, expect, type Locator, type Page } from '@playwright/test';
import { countBeamerEffects, installBeamerEffectSpies, waitForBeamerEffect } from '../helpers/beamer-audio';
import { injectAuth } from '../helpers/auth';
import { keyframe } from '../helpers/screenshot';
import {
  LONG_TEAM_NAME_SINGLE_WORD,
  longGroupStageTeamName,
  seedAndPlayGroupStage,
  seedGroupStageTournament,
} from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';
const submitShortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
const firstGroupStartCount = 1;

test.setTimeout(180_000);

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

async function holdStartUntilConfirmOpen(page: Page, button: Locator) {
  await button.hover();
  await page.mouse.down();
  await expectStartHoldProgressStarted(button);
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByTestId('mission-start-confirm-modal')).toBeVisible();
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
  await expect(card.getByTestId(`mission-beamer-werbung-image-${beamer.json.id}-bpwstr_banner`)).toBeChecked();

  const tennis = card.getByTestId(`mission-beamer-werbung-image-${beamer.json.id}-tennis_blurred`);
  await tennis.click();

  await expect.poll(async () => {
    const beamers = await client.get<Array<{ id: number; config: Record<string, unknown> }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(beamers, 200, 'fetch beamers after werbung config');
    const updated = beamers.json.find((candidate) => candidate.id === beamer.json.id);
    return updated?.config;
  }, { timeout: 20_000 }).toMatchObject({
    display_mode: 'werbung',
    werbung_image_keys: expect.arrayContaining(['bpwstr_banner', 'bpwstr_logo']),
  });

  await expect.poll(async () => {
    const beamers = await client.get<Array<{ id: number; config: { werbung_image_keys?: string[] } }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(beamers, 200, 'fetch beamers after werbung uncheck');
    const updated = beamers.json.find((candidate) => candidate.id === beamer.json.id);
    return updated?.config.werbung_image_keys || [];
  }, { timeout: 20_000 }).not.toContain('tennis_blurred');
});

test('Owner runs live tournament operations from Mission Control', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  const { tournament } = await seedGroupStageTournament(4, 4, 8);
  const client = await loggedInClient();

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole('link', { name: 'Timer', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ergebnisse' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Teams' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Checklisten' })).toBeVisible();
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

test('Mission Control saves independent beamer display controls instantly', async ({ context, page }, testInfo) => {
  await injectAuth(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { tournament } = await seedGroupStageTournament(2, 4, 4);
  const client = await loggedInClient();

  const main = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Main stage',
    display_state: 'between_games',
    config: {},
  });
  expectStatus(main, 201, 'create main stage beamer');
  const side = await client.post<{ id: number }>(`/tournaments/${tournament.id}/beamers`, {
    name: 'Side wall',
    display_state: 'group_tables',
    config: {},
  });
  expectStatus(side, 201, 'create side wall beamer');

  await page.goto(`/t/${tournament.id}/mission-control`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Beamer' }).click();

  await expect(page.getByTestId('mission-beamer-control')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aktualisieren' })).toHaveCount(0);
  await expect(page.getByText('Main stage')).toBeVisible();
  await expect(page.getByText('Side wall')).toBeVisible();
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
  await expect(page.getByTestId(`mission-beamer-image-${main.json.id}`)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(`mission-beamer-image-${main.json.id}`).selectOption('bpwstr_logo');
  await expect(page.getByTestId(`mission-beamer-image-${main.json.id}`)).toHaveValue('bpwstr_logo');
  await expect.poll(async () => {
    const updated = await client.get<Array<{ id: number; config?: { image_key?: string } }>>(
      `/tournaments/${tournament.id}/beamers`,
    );
    expectStatus(updated, 200, 'fetch beamers after image update');
    return updated.json.find((beamer) => beamer.id === main.json.id)?.config?.image_key;
  }, { timeout: 20_000 }).toBe('bpwstr_logo');

  await page.getByTestId(`mission-beamer-mode-${main.json.id}`).selectOption('timer_only');
  await expect(page.getByTestId(`mission-beamer-mode-${main.json.id}`)).toHaveValue('timer_only');
  await expect(page.getByTestId(`mission-beamer-match-${main.json.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`mission-beamer-image-${main.json.id}`)).toHaveCount(0);
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
    return {
      stageWidth: stage?.clientWidth ?? 0,
      tableWidth: el.clientWidth,
    };
  });
  expect(wideGeometry.tableWidth).toBeLessThan(wideGeometry.stageWidth - 100);

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
