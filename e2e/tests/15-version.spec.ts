import { test, expect } from '@playwright/test';

const expectedFrontendVersion = process.env.TURNIERE_EXPECTED_FRONTEND_VERSION;

const defaultFallbackGitSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const gitCommitShaRegex = /^[0-9a-f]{40}$/;

test('Version page displays frontend and backend versions', async ({ page }) => {
  let requestedVersionUrl = '';
  await page.route('**/api/version', async route => {
    requestedVersionUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 'backend-e2e' }),
    });
  });

  await page.goto('/version');

  await expect(page.getByRole('heading', { name: 'Version' }).last()).toBeVisible();
  await expect.poll(() => requestedVersionUrl).toContain('/api/version');
  expect(new URL(requestedVersionUrl).origin).toBe(new URL(page.url()).origin);
  expect(new URL(requestedVersionUrl).pathname).toBe('/api/version');

  const frontendVersionLocator = page.getByTestId('frontend-version');

  const frontendVersion = (await frontendVersionLocator.textContent())?.trim();

  expect(frontendVersion).toBeTruthy();
  if (expectedFrontendVersion) {
    expect(frontendVersion).toBe(expectedFrontendVersion);
  } else if (frontendVersion !== 'development') {
    expect(frontendVersion).toMatch(gitCommitShaRegex);
    expect(frontendVersion).not.toBe(defaultFallbackGitSha);
  } else {
    expect(frontendVersion).toBe('development');
  }

  await expect(page.getByTestId('backend-version')).toHaveText('backend-e2e');
});
