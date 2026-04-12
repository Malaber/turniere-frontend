import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { seedAndPlayGroupStage } from '../helpers/scenario-seeder';

test('Fullscreen beamer pages render correctly', async ({ page }, testInfo) => {
  // Fullscreen/beamer pages are designed for projectors — use a wide viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Seed a group-stage tournament with all group matches played
  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);

  // --- Fullscreen match view ---
  await page.goto(`/t/${tournament.id}/fullscreen`);
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'fullscreen_loaded');

  // Tournament name appears in the fixed-bottom navbar
  const bottomNavbar = page.locator('.fixed-bottom');
  await expect(bottomNavbar).toBeVisible();

  // Cursor is hidden (body gains 'hide-cursor' class on mount)
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);

  // Match filter dropdown is visible
  await expect(page.getByText(/Match-Filter/i)).toBeVisible();

  // --- Fullscreen groups view ---
  await page.goto(`/t/${tournament.id}/fullscreen-groups`);
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'fullscreen_groups_loaded');

  // Cursor hidden here too
  await expect(page.locator('body')).toHaveClass(/hide-cursor/);

  // Group headings are rendered (verifying the group stage data is displayed)
  await expect(page.getByRole('heading', { name: 'Gruppe 1' })).toBeVisible();
  // All 4 groups are present
  await expect(page.getByRole('heading', { name: /^Gruppe \d+$/ })).toHaveCount(4);

  // Group table data is rendered in the DOM (team names from the seeded data).
  // The <td> lives inside a reactstrap <Table responsive> wrapper (overflow-x: auto),
  // so Playwright may consider it clipped — use toBeAttached instead of toBeVisible.
  await expect(page.getByText('G1-S1').first()).toBeAttached();

  // QR code SVG is present
  await expect(page.locator('svg').first()).toBeVisible();
});
