import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { seedAndPlayGroupStage } from '../helpers/scenario-seeder';

test('Statistics page renders standings and dominance data', async ({ page }, testInfo) => {
  // Seed a group-stage tournament with all group matches played so statistics are available
  const { tournament, code } = await seedAndPlayGroupStage(4, 4, 8);

  // The frontend uses the numeric id in statistics URLs (matching how StatisticsButton builds hrefs)
  await page.goto(`/t/${tournament.id}/statistics`);
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'statistics_loaded');

  // "Stärkstes Team" and "Schwächstes Team" dominance cards
  await expect(page.getByText('Stärkstes Team')).toBeVisible();
  await expect(page.getByText('Schwächstes Team')).toBeVisible();

  // Standings table has at least one row
  await expect(page.locator('table').first()).toBeVisible();
  await expect(page.locator('table tbody tr').first()).toBeVisible();

  await keyframe(page, testInfo, 'statistics_full');
});
