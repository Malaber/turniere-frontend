import { test, expect } from '@playwright/test';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const expectedFrontendVersion = process.env.TURNIERE_EXPECTED_FRONTEND_VERSION ?? 'development';

test('Version page displays frontend and backend versions', async ({ page }) => {
  await page.route(`${backendUrl}/version`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 'backend-e2e' }),
    });
  });

  await page.goto('/version');

  await expect(page.getByRole('heading', { name: 'Version' }).last()).toBeVisible();
  await expect(page.getByTestId('frontend-version')).toHaveText(expectedFrontendVersion);
  await expect(page.getByTestId('backend-version')).toHaveText('backend-e2e');
});
