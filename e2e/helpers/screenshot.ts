import { Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Capture a full-page screenshot at a named visual keyframe.
 * Saved to screenshots/{test-title}/{name}.png — used for manual review and regression spotting.
 */
export async function keyframe(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const sanitize = (s: string) => s.replace(/[^a-z0-9-]/gi, '_').replace(/_+/g, '_').toLowerCase();
  const dir = path.join('screenshots', sanitize(testInfo.title));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}
