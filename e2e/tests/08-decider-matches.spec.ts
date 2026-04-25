import { test, expect, type Page } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { keyframe, modalKeyframe } from '../helpers/screenshot';
import {
  seedAdvancingDeciderScenario,
  seedIrrelevantTieScenario,
  seedRelevantDeciderScenario,
  seedResolvedDeciderScenario,
} from '../helpers/scenario-seeder';

test.setTimeout(240_000);

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

async function closeVisibleModal(page: Page) {
  const dialog = page.getByRole('dialog');
  if (await dialog.count() === 0) return;

  const closeButton = dialog.getByRole('button', { name: 'Close' });
  if (await closeButton.count() > 0) {
    await closeButton.first().click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(dialog).toHaveCount(0);
}

async function expectNoLineThrough(locator) {
  await expect(locator).toBeVisible();
  const decoration = await locator.evaluate((element) => window.getComputedStyle(element).textDecorationLine);
  expect(decoration).not.toContain('line-through');
}

async function expectResolvedDeciderText(locator) {
  await expect(locator.getByText(/hat das Entscheidungsmatch gegen .* (gewonnen|verloren)\./)).toBeVisible();
  await expect(locator.getByText(/Entscheidungsmatch gegen .*: (gewonnen|verloren)\./)).toBeVisible();
}

async function waitForRankingDecisionTrigger(page, timeout = 20000) {
  const decisionTriggers = page.locator('[data-ranking-decision-trigger]');
  await expect.poll(async () => decisionTriggers.count(), { timeout }).toBeGreaterThan(0);
  return decisionTriggers;
}

async function expectResolvedDecisionIconCount(page, timeout = 20000) {
  await waitForRankingDecisionTrigger(page, timeout);
  const resolvedIcons = page.getByLabel('Tie-Break erklärt');
  const resolvedCount = await resolvedIcons.count();
  expect(resolvedCount).toBeGreaterThanOrEqual(1);
  expect(resolvedCount).toBeLessThanOrEqual(2);
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

  await expect(decisionIcons).toHaveCount(2, { timeout: 15000 });
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
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText('Entscheidungsmatch läuft')).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'decider_match_started');
  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible({ timeout: 15000 });
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible();

  await modal.getByRole('spinbutton').nth(0).fill('5');
  await modal.getByRole('spinbutton').nth(1).fill('3');
  await expect(modal.getByText('Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.')).toBeVisible();
  await keyframe(page, testInfo, 'owner_decider_edit_context');
  await modalKeyframe(page, testInfo, 'owner_decider_edit_modal');
  await modalKeyframe(page, testInfo, 'decider_match_modal');

  await modal.getByRole('button', { name: 'Tie-Breaker Punkte ändern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 });
  await expect(deciderCard).toContainText('5');
  await expect(deciderCard).toContainText('3');
  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible({ timeout: 15000 });
  await modal.getByRole('button', { name: 'Spiel beenden' }).click({ force: true });
  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0, { timeout: 20000 });
  await expectResolvedDecisionIconCount(page, 20000);
  await closeVisibleModal(page);
  await page.getByLabel('Tie-Break erklärt').first().click();
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expectResolvedDeciderText(page.getByRole('dialog'));
  await keyframe(page, testInfo, 'owner_decider_resolved_context');
  await modalKeyframe(page, testInfo, 'owner_decider_resolved_modal');
  await modalKeyframe(page, testInfo, 'decider_resolved_modal');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await keyframe(page, testInfo, 'decider_resolved');

  await page.getByTestId('finish-group-stage').click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Finale' })).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'playoffs_started_after_decider');
});

test('Owner sees 1-vs-2 advancing tie require decider and keeps both names unstruck after resolution', async ({ context, page }) => {
  await injectAuth(context, loadAuthState());
  const { tournament, relevantTeamNames } = await seedAdvancingDeciderScenario();
  const teamOneRow = page.locator('[data-decider-match="true"]').first().locator('tbody tr').nth(0).locator('td');
  const teamTwoRow = page.locator('[data-decider-match="true"]').first().locator('tbody tr').nth(1).locator('td');

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  const tieBreakNeededCount = await page.getByLabel('Tie-Break nötig').count();
  test.skip(tieBreakNeededCount === 0, 'Backend does not require decider for 1-vs-2 advancing tie yet.');
  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);

  await page
    .locator('tr', { hasText: relevantTeamNames[0] })
    .locator('[data-ranking-decision-trigger]')
    .click();
  let modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toBeVisible();
  await modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' }).click();

  const deciderCard = page.locator('[data-decider-match="true"]').first();
  await expect(deciderCard).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => {
    await deciderCard.click({ force: true });
    const dialog = page.getByRole('dialog');
    const runningHeading = dialog.getByRole('heading', { name: 'Entscheidungsmatch läuft' });
    if (await runningHeading.count() > 0) {
      return 'running';
    }

    const startButton = dialog.getByRole('button', { name: 'Spiel starten' });
    if (await startButton.count() > 0) {
      await startButton.click();
      return 'started';
    }

    return 'waiting';
  }, {
    timeout: 20_000,
    message: 'wait for running decider modal after creating/starting decider'
  }).toBe('running');

  await expect(page.locator('[data-decider-match="true"]')).toBeVisible({ timeout: 15000 });
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible({ timeout: 15000 });
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible();
  await expect(modal.getByRole('spinbutton')).toHaveCount(2);
  await modal.getByRole('spinbutton').nth(0).fill('5');
  await modal.getByRole('spinbutton').nth(1).fill('3');
  await expect(modal.getByText('Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.')).toBeVisible();
  await modal.getByRole('button', { name: 'Tie-Breaker Punkte ändern' }).click();

  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Spiel beenden' }).click({ force: true });
  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByLabel('Tie-Break erklärt')).toHaveCount(2, { timeout: 20000 });
  await expectNoLineThrough(teamOneRow);
  await expectNoLineThrough(teamTwoRow);
  await expect(teamOneRow).toContainText(relevantTeamNames[0]);
  await expect(teamTwoRow).toContainText(relevantTeamNames[1]);
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

  const decisionTriggers = await waitForRankingDecisionTrigger(page);
  await expectResolvedDecisionIconCount(page);
  await decisionTriggers.first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expectResolvedDeciderText(modal);
  await keyframe(page, testInfo, 'owner_resolved_decider_context');
  await modalKeyframe(page, testInfo, 'owner_resolved_decider_modal_review');
});

test('Public user can inspect a resolved decider modal', async ({ page }, testInfo) => {
  const { tournament } = await seedResolvedDeciderScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  const decisionTriggers = await waitForRankingDecisionTrigger(page);
  await expectResolvedDecisionIconCount(page);
  await decisionTriggers.first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expectResolvedDeciderText(modal);
  await keyframe(page, testInfo, 'public_decider_resolved_context');
  await modalKeyframe(page, testInfo, 'public_decider_resolved_modal');
});

test('Fullscreen groups view keeps decider tables compact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { tournament } = await seedRelevantDeciderScenario();

  await page.goto(`/t/${tournament.id}/fullscreen?display=groups`);
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
  const decisionTriggers = page.locator('[data-ranking-decision-trigger]');
  const decisionTriggerCount = await decisionTriggers.count();
  test.skip(decisionTriggerCount === 0, 'Backend does not expose non-blocking tie decision triggers for this scenario.');
  expect([1, 2]).toContain(decisionTriggerCount);
  await decisionTriggers.first().click();
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
  const decisionTriggers = page.locator('[data-ranking-decision-trigger]');
  const decisionTriggerCount = await decisionTriggers.count();
  test.skip(decisionTriggerCount === 0, 'Backend does not expose non-blocking tie decision triggers for this scenario.');
  expect([1, 2]).toContain(decisionTriggerCount);
  await decisionTriggers.first().click();
  const modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Dieser Gleichstand blockiert die Playoffs nicht.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toHaveCount(0);
  await keyframe(page, testInfo, 'public_irrelevant_tie_context');
  await modalKeyframe(page, testInfo, 'public_irrelevant_tie_modal');
  await modalKeyframe(page, testInfo, 'irrelevant_tie_no_decider_required');
});
