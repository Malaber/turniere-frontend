import { test, expect } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { keyframe } from '../helpers/screenshot';
import { seedIrrelevantTieScenario, seedRelevantDeciderScenario } from '../helpers/scenario-seeder';

test.setTimeout(240_000);

async function expectNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(hasOverflow).toBe(false);
}

test('Owner can create and resolve a decider match, then start playoffs', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament, relevantTeamNames } = await seedRelevantDeciderScenario();
  const deciderCard = page.locator('[data-decider-match="true"]').first();
  const decisionIcons = page.locator('[data-ranking-decision-trigger]');
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

  await decisionIcons.first().click();
  modal = page.getByRole('dialog');
  await expect(modal.getByText('Deshalb braucht es ein Entscheidungsmatch.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toBeVisible();
  await modal.getByRole('button', { name: 'Entscheidungsmatch anlegen' }).click();
  await expect(deciderCard).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'decider_match_created');

  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch kann gestartet werden' })).toBeVisible();
  await modal.getByRole('button', { name: 'Spiel starten' }).click();
  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible();

  await modal.getByRole('spinbutton').nth(0).fill('5');
  await modal.getByRole('spinbutton').nth(1).fill('3');
  await expect(modal.getByText('Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.')).toBeVisible();
  await keyframe(page, testInfo, 'decider_match_modal');

  await modal.getByRole('button', { name: 'Tie-Breaker Punkte ändern' }).click();
  await deciderCard.click({ force: true });
  modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Entscheidungsmatch läuft' })).toBeVisible();
  await modal.getByRole('button', { name: 'Spiel beenden' }).click();
  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByLabel('Tie-Break erklärt')).toHaveCount(1, { timeout: 20000 });
  await page.getByLabel('Tie-Break erklärt').click();
  await expect(
    page.getByRole('dialog').getByText(`Entscheidungsmatch gegen ${relevantTeamNames[0]}: verloren.`)
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await keyframe(page, testInfo, 'decider_resolved');

  await page.getByTestId('finish-group-stage').click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Finale')).toBeVisible({ timeout: 15000 });
  await keyframe(page, testInfo, 'playoffs_started_after_decider');
});

test('Fullscreen groups view keeps decider tables compact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { tournament } = await seedRelevantDeciderScenario();

  await page.goto(`/t/${tournament.id}/fullscreen-groups`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);
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
  await expect(page.getByRole('dialog').getByText('Deshalb braucht es ein Entscheidungsmatch.')).toBeVisible();
  await keyframe(page, testInfo, 'mobile_decider_table');
});

test('Irrelevant bottom ties do not force a decider match in the tournament view', async ({ page }, testInfo) => {
  const { tournament } = await seedIrrelevantTieScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByLabel('Tie-Break nötig')).toHaveCount(0);
  await expect(page.locator('[data-ranking-decision-trigger]')).toHaveCount(2);
  await page.locator('[data-ranking-decision-trigger]').first().click();
  await expect(page.getByRole('dialog').getByText('Dieser Gleichstand blockiert die Playoffs nicht.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toHaveCount(0);
  await keyframe(page, testInfo, 'irrelevant_tie_no_decider_required');
});
