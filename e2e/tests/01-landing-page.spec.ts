import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';

test('Landing page renders correctly without backend data', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'landing_loaded');

  // Navbar brand
  await expect(page.locator('a.navbar-brand')).toHaveText('turnie.re');

  // Hero text from BigImage component
  await expect(page.getByText('Einfach Turniere organisieren')).toBeVisible();

  // Turniercode form
  await expect(page.locator('#turniercode-form')).toBeVisible();
  await expect(page.locator('#turniercode-form input[name="code"]')).toBeVisible();

  // "Turnier erstellen" button links to /create
  const createButton = page.getByRole('link', { name: 'Turnier erstellen' }).first();
  await expect(createButton).toBeVisible();
  await expect(createButton).toHaveAttribute('href', '/create');

  // Footer
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('footer').getByRole('link', { name: 'Version' })).toHaveAttribute('href', '/version');

  await keyframe(page, testInfo, 'landing_full');
});
