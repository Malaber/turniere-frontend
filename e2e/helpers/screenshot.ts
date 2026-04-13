import { Locator, Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function screenshotPath(testInfo: TestInfo, name: string): string {
  const sanitize = (s: string) => s.replace(/[^a-z0-9-]/gi, '_').replace(/_+/g, '_').toLowerCase();
  const dir = path.join('screenshots', sanitize(testInfo.title));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}.png`);
}

/**
 * Capture a viewport screenshot at a named visual keyframe.
 * Saved to screenshots/{test-title}/{name}.png — used for manual review and regression spotting.
 */
export async function keyframe(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const file = screenshotPath(testInfo, name);
  await page.screenshot({ path: file, fullPage: false });
}

/**
 * Capture a focused screenshot of one visible UI element such as a modal.
 */
export async function locatorKeyframe(locator: Locator, testInfo: TestInfo, name: string): Promise<void> {
  const file = screenshotPath(testInfo, name);
  await locator.screenshot({ path: file });
}

/**
 * Capture the visible bootstrap modal content box itself.
 */
export async function modalKeyframe(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const file = screenshotPath(testInfo, name);
  await page.locator('.modal.show .modal-content').first().screenshot({ path: file });
}
