import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';

const email = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const password = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

test('Login flow works and shows user state', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'login_page');

  // Login card heading
  await expect(page.locator('h1').filter({ hasText: 'Login' })).toBeVisible();

  // Email and password inputs are present (field name="username" contains an email input)
  await expect(page.locator('input[name="username"][type="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"][type="password"]')).toBeVisible();

  // Submit button
  await expect(page.locator('input[type="submit"]')).toBeVisible();

  // Fill in credentials and submit
  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('input[type="submit"]');

  // After successful login the app redirects to "/"
  await page.waitForURL('/', { timeout: 10_000 });

  await keyframe(page, testInfo, 'login_success');

  // The navbar now shows Logout instead of Login
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
});

test('Navbar login returns to previous page after successful login', async ({ page }, testInfo) => {
  await page.goto('/faq');
  await page.waitForLoadState('networkidle');

  await page.getByRole('link', { name: 'Login' }).click();
  await page.waitForURL('/login?redirect=%2Ffaq');

  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('input[type="submit"]');

  await page.waitForURL('/faq', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await keyframe(page, testInfo, 'navbar_login_return');
});

test('Login failure shows an error instead of crashing the page', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', 'definitely-wrong-password');
  await page.click('input[type="submit"]');

  await expect(page.getByText('Unhandled Runtime Error')).toHaveCount(0);
  await expect(page.locator('.error-box li').first()).toBeVisible({ timeout: 10_000 });
  await keyframe(page, testInfo, 'login_error');
});
