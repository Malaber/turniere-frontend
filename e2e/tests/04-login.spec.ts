import { test, expect } from '@playwright/test';
import { injectAuthState } from '../helpers/auth';
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

test('Auth token renewal is persisted and used by later API requests', async ({ context, page }) => {
  const uid = email;
  await injectAuthState(context, {
    username: 'E2E User',
    accesstoken: 'token-1',
    client: 'client-1',
    expiry: '1000',
    uid,
  });

  let validateTokenWasCalled = false;
  await page.route('**/users/validate_token', async route => {
    validateTokenWasCalled = true;
    expect(route.request().headers()['access-token']).toBe('token-1');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-token': 'token-2',
        client: 'client-2',
        uid,
        expiry: '1001',
        'access-control-expose-headers': 'access-token, client, uid, expiry',
      },
      body: JSON.stringify({ success: true, data: { username: 'E2E User', uid } }),
    });
  });

  await page.goto('/profile');

  expect(validateTokenWasCalled).toBe(true);
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('reduxState') || '{}');
    return state.userinfo?.accesstoken;
  })).toBe('token-2');

  let changeMailToken = '';
  await page.route(/\/users$/, async route => {
    expect(route.request().method()).toBe('PUT');
    changeMailToken = route.request().headers()['access-token'] || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-token': 'token-3',
        client: 'client-3',
        uid,
        expiry: '1002',
        'access-control-expose-headers': 'access-token, client, uid, expiry',
      },
      body: JSON.stringify({ username: 'E2E User', uid }),
    });
  });

  await page.fill('input[type="email"]', 'renewed-e2e@example.com');
  await page.getByRole('button', { name: 'eintragen' }).click();
  await expect.poll(() => changeMailToken).toBe('token-2');
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('reduxState') || '{}');
    return state.userinfo?.accesstoken;
  })).toBe('token-3');
});
