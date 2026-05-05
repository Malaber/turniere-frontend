import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { keyframe, screenshotFilePath } from '../helpers/screenshot';

test('Manual screenshots are stored flat for artifact browsing', async ({ page }, testInfo) => {
  const file = screenshotFilePath(testInfo, 'home_state');
  expect(path.dirname(file)).toBe('screenshots');
  expect(path.basename(file)).toBe('manual_screenshots_are_stored_flat_for_artifact_browsing__home_state.png');

  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await keyframe(page, testInfo, 'home_state');

  expect(fs.existsSync(file)).toBeTruthy();
  expect(fs.existsSync(path.join('screenshots', 'manual_screenshots_are_stored_flat_for_artifact_browsing'))).toBeFalsy();
});
