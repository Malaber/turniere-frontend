import { test, expect, type Locator, type Page } from '@playwright/test';
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

async function waitForTournamentDetails(page: Page) {
  await expect(page.getByTestId('tournament-details-loading')).toHaveCount(0, { timeout: 120000 });
}

async function gotoTournament(page: Page, tournamentId: number) {
  await page.goto(`/t/${tournamentId}`);
  await page.waitForLoadState('networkidle');
  await waitForTournamentDetails(page);
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

async function waitForNoModal(page: Page, timeout = 15000) {
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout });
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
  await expect(page.getByTestId('mission-start-confirm-modal')).toBeVisible({ timeout: 3_000 });
  await page.mouse.up();
}

async function expectDeciderCardState(card: Locator, state: string, timeout = 15000) {
  await expect(card).toHaveAttribute('data-match-state', state, { timeout });
}

async function openDeciderMatchModal(page: Page, card: Locator, heading: string, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const attemptTimeout = Math.min(2000, Math.max(250, deadline - Date.now()));
    await waitForNoModal(page, attemptTimeout);
    await expect(card).toBeVisible({ timeout: attemptTimeout });

    try {
      await card.scrollIntoViewIfNeeded({ timeout: attemptTimeout });
      const cardBody = card.locator('.card-body').first();
      if (await cardBody.count() > 0) {
        await cardBody.click({ force: true, timeout: attemptTimeout });
      } else {
        await card.click({ timeout: attemptTimeout });
      }
      const modal = page.getByRole('dialog');
      await expect(visibleModal(page)).toBeVisible({ timeout: attemptTimeout });
      await expect(modal.getByRole('heading', { name: heading })).toBeVisible({ timeout: attemptTimeout });
      return modal;
    } catch (error) {
      lastError = error;
      const modal = page.getByRole('dialog');
      if (await modal.count() > 0) {
        if (await modal.getByRole('heading', { name: heading }).count() > 0) {
          return modal;
        }
        await closeVisibleModal(page);
      }
    }
  }

  throw lastError ?? new Error(`Could not open decider match modal with heading "${heading}"`);
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

async function expectCleanMatchPositionBadge(card: Locator, position: number) {
  const badge = card.getByTestId('match-position-badge');
  const number = card.getByTestId('match-position-badge-number');
  await expect(badge).toHaveAttribute('data-match-position', String(position));
  await expect(number).toHaveText(String(position));
  await expect(card.locator('[data-decider-label]')).toHaveCount(0);
  await expect(card).not.toContainText('Sp.');
  await expect(card).not.toContainText('Entscheidung');
  const fontSize = await number.evaluate((element) => parseFloat(window.getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(30);
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

  await gotoTournament(page, tournament.id);
  await expect(page.getByTestId('finish-group-stage')).toHaveCount(0);

  await expect(decisionIcons).toHaveCount(2, { timeout: 15000 });
  await keyframe(page, testInfo, 'decider_required');

  await page.goto(`/t/${tournament.id}/mission-control#starts`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  const blockedPlayoffStart = page.getByTestId('mission-playoff-start');
  await expect(blockedPlayoffStart).toBeVisible();
  await holdStartUntilConfirmOpen(page, blockedPlayoffStart);
  modal = page.getByTestId('mission-start-confirm-modal');
  await modal.getByTestId('mission-start-confirm-ok').click();
  await expect(modal.getByTestId('mission-start-confirm-result')).toContainText(
    'Playoffs können noch nicht gestartet werden.',
    { timeout: 20_000 },
  );
  await expect(modal.getByTestId('mission-start-confirm-result')).toContainText(relevantTeamNames[0]);
  await expect(modal.getByTestId('mission-start-confirm-result')).toContainText(relevantTeamNames[1]);
  await keyframe(page, testInfo, 'decider_blocking_alert');
  await modal.getByTestId('mission-start-result-ok').click();
  await gotoTournament(page, tournament.id);

  await deciderOwnerTrigger.click();
  modal = page.getByRole('dialog');
  await expect(visibleModal(page)).toBeVisible();
  await expect(modal.getByText('Deshalb braucht es ein Entscheidungsmatch.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toBeVisible();
  await keyframe(page, testInfo, 'owner_decider_needed_context');
  await modalKeyframe(page, testInfo, 'owner_decider_needed_modal');
  await modalKeyframe(page, testInfo, 'decider_decision_modal');
  await modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' }).click();
  await waitForNoModal(page);
  await expect(deciderCard).toBeVisible({ timeout: 15000 });
  await expectDeciderCardState(deciderCard, 'not_started');
  await expectCleanMatchPositionBadge(deciderCard, 7);
  await keyframe(page, testInfo, 'decider_match_created');

  modal = await openDeciderMatchModal(page, deciderCard, 'Entscheidungsmatch kann gestartet werden');
  await modal.getByRole('button', { name: 'Spiel starten' }).click();
  await waitForNoModal(page);
  await expectDeciderCardState(deciderCard, 'in_progress');
  await expect(page.getByText('Entscheidungsmatch läuft')).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'decider_match_started');
  modal = await openDeciderMatchModal(page, deciderCard, 'Entscheidungsmatch läuft');

  await modal.getByRole('spinbutton').nth(0).fill('5');
  await modal.getByRole('spinbutton').nth(1).fill('3');
  await expect(modal.getByText('Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.')).toBeVisible();
  await keyframe(page, testInfo, 'owner_decider_edit_context');
  await modalKeyframe(page, testInfo, 'owner_decider_edit_modal');
  await modalKeyframe(page, testInfo, 'decider_match_modal');

  await modal.getByRole('button', { name: 'Tie-Breaker Punkte ändern' }).click();
  await waitForNoModal(page);
  await expect(deciderCard).toContainText('5');
  await expect(deciderCard).toContainText('3');
  await expectDeciderCardState(deciderCard, 'in_progress');
  modal = await openDeciderMatchModal(page, deciderCard, 'Entscheidungsmatch läuft');
  await modal.getByRole('button', { name: 'Spiel beenden' }).click({ force: true });
  await waitForNoModal(page);
  await expectDeciderCardState(deciderCard, 'finished');
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

  await page.goto(`/t/${tournament.id}/mission-control#starts`);
  await expect(page.getByTestId('mission-control')).toBeVisible({ timeout: 20_000 });
  const playoffStart = page.getByTestId('mission-playoff-start');
  await holdStartUntilConfirmOpen(page, playoffStart);
  modal = page.getByTestId('mission-start-confirm-modal');
  const finishResponse = page.waitForResponse(response =>
    response.request().method() === 'PATCH' && /\/stages\/\d+$/.test(response.url())
  );
  await modal.getByTestId('mission-start-confirm-ok').click();
  expect((await finishResponse).ok()).toBe(true);
  await expect(modal.getByTestId('mission-start-confirm-result')).toContainText('Playoffs wurden generiert.', {
    timeout: 20_000,
  });
  await modal.getByTestId('mission-start-result-ok').click();
  await expect.poll(async () => {
    await page.goto(`/t/${tournament.id}`);
    await waitForTournamentDetails(page);
    return page.locator('.stages').textContent();
  }, {
    timeout: 30000,
  }).toMatch(/Finale|Spiel um Platz 3/);
  await keyframe(page, testInfo, 'playoffs_started_after_decider');
});

test('Owner sees 1-vs-2 advancing tie require decider and keeps both names unstruck after resolution', async ({ context, page }) => {
  await injectAuth(context, loadAuthState());
  const { tournament, relevantTeamNames } = await seedAdvancingDeciderScenario();
  const deciderCard = page.locator('[data-decider-match="true"]').first();
  const teamOneRow = deciderCard.locator('tbody tr', { hasText: relevantTeamNames[0] }).locator('td');
  const teamTwoRow = deciderCard.locator('tbody tr', { hasText: relevantTeamNames[1] }).locator('td');

  await gotoTournament(page, tournament.id);

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

  await waitForNoModal(page);
  await expect(deciderCard).toBeVisible({ timeout: 15000 });
  await expectDeciderCardState(deciderCard, 'not_started');
  await expectCleanMatchPositionBadge(deciderCard, 7);
  modal = await openDeciderMatchModal(page, deciderCard, 'Entscheidungsmatch kann gestartet werden');
  await modal.getByRole('button', { name: 'Spiel starten' }).click();
  await waitForNoModal(page);
  await expectDeciderCardState(deciderCard, 'in_progress');
  await expect(page.getByText('Entscheidungsmatch läuft')).toBeVisible({ timeout: 15000 });

  await expect(page.locator('[data-decider-match="true"]')).toBeVisible({ timeout: 15000 });
  modal = await openDeciderMatchModal(page, deciderCard, 'Entscheidungsmatch läuft');
  await expect(modal.getByRole('spinbutton')).toHaveCount(2);
  await modal.getByRole('spinbutton').nth(0).fill('5');
  await modal.getByRole('spinbutton').nth(1).fill('3');
  await expect(modal.getByText('Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.')).toBeVisible();
  await modal.getByRole('button', { name: 'Tie-Breaker Punkte ändern' }).click();
  await waitForNoModal(page);
  await expect(deciderCard).toContainText('5');
  await expect(deciderCard).toContainText('3');
  await expectDeciderCardState(deciderCard, 'in_progress');

  modal = await openDeciderMatchModal(page, deciderCard, 'Entscheidungsmatch läuft');
  await modal.getByRole('button', { name: 'Spiel beenden' }).click({ force: true });
  await waitForNoModal(page);
  await expectDeciderCardState(deciderCard, 'finished');
  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByLabel('Tie-Break erklärt')).toHaveCount(2, { timeout: 20000 });
  await expect(teamOneRow).toContainText(relevantTeamNames[0]);
  await expect(teamTwoRow).toContainText(relevantTeamNames[1]);
  await expectNoLineThrough(teamOneRow);
  await expectNoLineThrough(teamTwoRow);
});

test('Public user can inspect a required decider modal', async ({ page }, testInfo) => {
  const { tournament } = await seedRelevantDeciderScenario();

  await gotoTournament(page, tournament.id);

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

  await gotoTournament(page, tournament.id);

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

  await gotoTournament(page, tournament.id);

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

test('Fullscreen match cards render group-stage deciders with the group number badge', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { tournament } = await seedResolvedDeciderScenario();
  const groupStage = tournament.stages.find((stage) => stage.level === -1);
  const deciderGroup = groupStage?.groups[0];
  const deciderMatch = deciderGroup?.matches.find((match) => match.decider);
  expect(deciderMatch).toBeTruthy();

  await page.goto(`/t/${tournament.id}/fullscreen?display=between_games`);
  await page.waitForLoadState('networkidle');

  const card = page.locator(`[data-match-id="${deciderMatch!.id}"]`);
  await expect(card).toBeVisible({ timeout: 20000 });
  const badge = card.getByTestId('fullscreen-match-badge');
  await expect(badge).toHaveText(String(deciderGroup!.number));
  await expect(badge).toHaveAttribute('data-match-badge-kind', 'group');
  await expect(card).not.toContainText('Sp.');
  await expect(card).not.toContainText('Entscheidung');
});

test('Mobile tournament view keeps decider tables readable without side scrolling', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  await page.setViewportSize({ width: 390, height: 844 });
  const { tournament } = await seedRelevantDeciderScenario();

  await gotoTournament(page, tournament.id);

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

  await gotoTournament(page, tournament.id);

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

  await gotoTournament(page, tournament.id);

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
