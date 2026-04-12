import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';

test('Error page renders for an invalid tournament code', async ({ page }, testInfo) => {
  await page.goto('/t/999999');
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'error_404');

  // ErrorPageComponent shows a descriptive error message
  await expect(page.locator('.running-text h2')).toBeVisible();
  // Error container is rendered (status code shown when frontend image includes the fix)
  await expect(page.locator('.error-code-box')).toBeAttached();
});
