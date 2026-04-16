import { test, expect } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { keyframe, modalKeyframe } from '../helpers/screenshot';
import { seedIrrelevantTieScenario, seedRelevantDeciderScenario, seedResolvedDeciderScenario } from '../helpers/scenario-seeder';
import { ApiClient, expectStatus } from '../helpers/api-client';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test.setTimeout(240_000);

async function setDefaultBeamerDisplayState(client: ApiClient, tournamentId: number, displayState: string) {
  const beamerRes = await client.get<{ id: number }>(
    `/tournaments/${tournamentId}/beamers/by_name`,
    { name: 'default' },
  );
  expectStatus(beamerRes, 200, 'fetch default beamer');

  const updateRes = await client.patch(
    `/tournaments/${tournamentId}/beamers/${beamerRes.json.id}`,
    { display_state: displayState },
  );
  expectStatus(updateRes, 200, `set default beamer to ${displayState}`);
}

async function expectNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(hasOverflow).toBe(false);
}

function visibleModal(page) {
  return page.getByRole('dialog').first();
}

test('Owner can create and resolve a decider match, then start playoffs', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament, relevantTeamNames } = await seedRelevantDeciderScenario();
  const deciderCard = page.locator('[data-decider-match="true"]').first();
  const decisionIcons = page.locator('[data-ranking-decision-trigger]');
  const deciderOwnerTrigger = page
    .locator('tr', { hasText: relevantTeamNames[0] })
    .locator('[data-ranking-decision-trigger]');
  let modal = page.getByRole('dialog');

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(decisionIcons).toHaveCount(2);
  await keyframe(page, testInfo, 'decider_required');

  await page.getByTestId('finish-group-stage').click();
  await expect(page.getByTestId('blocking-ties-alert')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('blocking-ties-alert')).toContainText(relevantTeamNames[0]);
  await expect(page.getByTestId('blocking-ties-alert')).toContainText(relevantTeamNames[1]);
  await keyframe(page, testInfo, 'decider_blocking_alert');

  await deciderOwnerTrigger.click();
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Deshalb braucht es ein Entscheidungsmatch.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toBeVisible();
  await keyframe(page, testInfo, 'owner_decider_needed_context');
  await modalKeyframe(page, testInfo, 'owner_decider_needed_modal');
  await modalKeyframe(page, testInfo, 'decider_decision_modal');
  await modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' }).click();
  await expect(deciderCard).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'decider_match_created');

  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch kann gestartet werden' })).toBeVisible();
  await modal.getByRole('button', { name: 'Spiel starten' }).click();
  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible();

  await modal.getByRole('spinbutton').nth(0).fill('5');
  await modal.getByRole('spinbutton').nth(1).fill('3');
  await expect(modal.getByText('Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.')).toBeVisible();
  await keyframe(page, testInfo, 'owner_decider_edit_context');
  await modalKeyframe(page, testInfo, 'owner_decider_edit_modal');
  await modalKeyframe(page, testInfo, 'decider_match_modal');

  await modal.getByRole('button', { name: 'Tie-Breaker Punkte ändern' }).click();
  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible();
  await modal.getByRole('button', { name: 'Spiel beenden' }).click();
  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByLabel('Tie-Break erklärt')).toHaveCount(1, { timeout: 20000 });
  await page.getByLabel('Tie-Break erklärt').click();
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/hat das Entscheidungsmatch gegen .* verloren\./)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/Entscheidungsmatch gegen .*: verloren\./)).toBeVisible();
  await keyframe(page, testInfo, 'owner_decider_resolved_context');
  await modalKeyframe(page, testInfo, 'owner_decider_resolved_modal');
  await modalKeyframe(page, testInfo, 'decider_resolved_modal');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await keyframe(page, testInfo, 'decider_resolved');

  await page.getByTestId('finish-group-stage').click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Finale')).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'playoffs_started_after_decider');
});

test('Public user can inspect a required decider modal', async ({ page }, testInfo) => {
  const { tournament } = await seedRelevantDeciderScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);
  await page.locator('[data-ranking-decision-trigger]').first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Deshalb braucht es ein Entscheidungsmatch.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toHaveCount(0);
  await keyframe(page, testInfo, 'public_decider_needed_context');
  await modalKeyframe(page, testInfo, 'public_decider_needed_modal');
});

test('Owner can inspect a resolved decider modal', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedResolvedDeciderScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByLabel('Tie-Break erklärt')).toHaveCount(1);
  await page.getByLabel('Tie-Break erklärt').click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText(/hat das Entscheidungsmatch gegen .* verloren\./)).toBeVisible();
  await keyframe(page, testInfo, 'owner_resolved_decider_context');
  await modalKeyframe(page, testInfo, 'owner_resolved_decider_modal_review');
});

test('Public user can inspect a resolved decider modal', async ({ page }, testInfo) => {
  const { tournament } = await seedResolvedDeciderScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByLabel('Tie-Break erklärt')).toHaveCount(1);
  await page.getByLabel('Tie-Break erklärt').click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText(/hat das Entscheidungsmatch gegen .* verloren\./)).toBeVisible();
  await keyframe(page, testInfo, 'public_decider_resolved_context');
  await modalKeyframe(page, testInfo, 'public_decider_resolved_modal');
});

test('Fullscreen groups view keeps decider tables compact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { tournament } = await seedRelevantDeciderScenario();

  const client = new ApiClient(backendUrl);
  await client.login(e2eEmail, e2ePassword);
  await setDefaultBeamerDisplayState(client, tournament.id, 'groups');

  await page.goto(`/t/${tournament.id}/fullscreen`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2, { timeout: 15000 });
  await expectNoHorizontalOverflow(page);
  await keyframe(page, testInfo, 'fullscreen_decider_groups');
});

test('Mobile tournament view keeps decider tables readable without side scrolling', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  await page.setViewportSize({ width: 390, height: 844 });
  const { tournament } = await seedRelevantDeciderScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);

  await page.locator('[data-ranking-decision-trigger]').first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Deshalb braucht es ein Entscheidungsmatch.')).toBeVisible();
  await keyframe(page, testInfo, 'mobile_decider_info_context');
  await modalKeyframe(page, testInfo, 'mobile_decider_info_modal');
});

test('Owner can inspect a non-blocking tie modal', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedIrrelevantTieScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0);
  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);
  await page.locator('[data-ranking-decision-trigger]').first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Dieser Gleichstand blockiert die Playoffs nicht.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toHaveCount(0);
  await keyframe(page, testInfo, 'owner_irrelevant_tie_context');
  await modalKeyframe(page, testInfo, 'owner_irrelevant_tie_modal');
  await modalKeyframe(page, testInfo, 'irrelevant_tie_modal');
});

test('Public user can inspect a non-blocking tie modal', async ({ page }, testInfo) => {
  const { tournament } = await seedIrrelevantTieScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0);
  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);
  await page.locator('[data-ranking-decision-trigger]').first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Dieser Gleichstand blockiert die Playoffs nicht.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toHaveCount(0);
  await keyframe(page, testInfo, 'public_irrelevant_tie_context');
  await modalKeyframe(page, testInfo, 'public_irrelevant_tie_modal');
  await modalKeyframe(page, testInfo, 'irrelevant_tie_no_decider_required');
});
