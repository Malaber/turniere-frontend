import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import {
  seedGroupStageTournament,
  seedAndPlayGroupStage,
  seedGroupStageAndRunToBeforeFinal,
} from '../helpers/scenario-seeder';

test('Public tournament view renders group-stage and playoff data', async ({ page }, testInfo) => {
  // --- Seed: create group-stage tournament (4 groups × 4 teams, 8 playoff spots) ---
  const { tournament } = await seedGroupStageTournament(4, 4, 8);

  // --- Step 1: fresh tournament page ---
  await page.goto(`/t/${tournament.id}`);
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'tournament_created');

  // Tournament name appears in the big-image header
  await expect(page.locator('.big-image')).toBeVisible();

  // Group stage section contains 4 groups (h3/h4 headings with "Gruppe")
  const groupHeaders = page.getByText(/Gruppe/i);
  await expect(groupHeaders.first()).toBeVisible();

  // --- Step 2: play group matches + finish group stage via API ---
  const { tournament: t2 } = await seedAndPlayGroupStage(4, 4, 8);

  await page.goto(`/t/${t2.id}`);
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'tournament_groups_finished');

  // Group tables should show scores after group stage is finished
  // The playoff section should also be visible
  await expect(page.locator('.stages').first()).toBeVisible();

  // --- Step 3: play up to before final ---
  const { tournament: t3 } = await seedGroupStageAndRunToBeforeFinal(4, 4, 8);

  await page.goto(`/t/${t3.id}`);
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'tournament_before_final');

  // "Statistiken" and "Vollbild-Ansicht" buttons visible in the status bar
  await expect(page.getByRole('button', { name: 'Statistiken' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vollbild-Ansicht' })).toBeVisible();
});
