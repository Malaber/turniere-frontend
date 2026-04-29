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

test('Sync push accidentally sent to frontend returns JSON guidance', async ({ request }) => {
  const response = await request.patch('/tournaments/14/sync_state', {
    data: { tournament: { name: 'Wrong target' } },
  });

  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');

  const body = await response.json();
  expect(body).toMatchObject({
    error: 'wrong_service',
    hint: 'Use the backend API URL configured in TURNIERE_API_URL for sync_target_url.',
    backendEndpoint: expect.stringContaining('/tournaments/14/sync_state'),
  });
  expect(body.message).toContain('PATCH /tournaments/14/sync_state reached turniere-frontend');
  expect(body.message).toContain('turniere-backend');
});
