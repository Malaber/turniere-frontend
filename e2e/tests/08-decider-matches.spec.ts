import { test, expect } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { keyframe } from '../helpers/screenshot';
import { seedIrrelevantTieScenario, seedRelevantDeciderScenario } from '../helpers/scenario-seeder';

test.setTimeout(120_000);

test('Owner can create and resolve a decider match, then start playoffs', async ({ context, page }, testInfo) => {
  await injectAuth(context, loadAuthState());
  const { tournament, relevantTeamNames } = await seedRelevantDeciderScenario();
  const deciderCard = page.locator('[data-decider-match="true"]').first();
  let modal = page.getByRole('dialog');

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Tie-Break nötig').first()).toBeVisible();
  await expect(page.getByText(`Entscheidungsmatch gegen ${relevantTeamNames[1]} erforderlich`)).toBeVisible();
  await keyframe(page, testInfo, 'decider_required');

  await page.getByTestId('finish-group-stage').click();
  await expect(page.getByTestId('blocking-ties-alert')).toBeVisible();
  await expect(page.getByTestId('blocking-ties-alert')).toContainText(relevantTeamNames[0]);
  await expect(page.getByTestId('blocking-ties-alert')).toContainText(relevantTeamNames[1]);
  await keyframe(page, testInfo, 'decider_blocking_alert');

  await page.getByRole('button', { name: 'Entscheidungsmatch anlegen' }).click();
  await expect(deciderCard).toBeVisible();
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
  await expect(page.getByText(`Entscheidungsmatch gegen ${relevantTeamNames[0]} verloren`)).toBeVisible();
  await expect(page.getByText('Tie-Break nötig')).toHaveCount(0);
  if (await page.getByRole('dialog').count()) {
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await keyframe(page, testInfo, 'decider_resolved');

  await page.getByTestId('finish-group-stage').click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Finale')).toBeVisible();
  await keyframe(page, testInfo, 'playoffs_started_after_decider');
});

test('Irrelevant bottom ties do not force a decider match in the tournament view', async ({ page }, testInfo) => {
  const { tournament } = await seedIrrelevantTieScenario();

  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Tie-Break nötig')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entscheidungsmatch anlegen' })).toHaveCount(0);
  await expect(page.getByText('Weiterhin gleichauf').first()).toBeVisible();
  await keyframe(page, testInfo, 'irrelevant_tie_no_decider_required');
});
