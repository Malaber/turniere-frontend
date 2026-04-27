import { test, expect } from '@playwright/test';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';

const defaultFallbackGitSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const gitCommitShaRegex = /^[0-9a-f]{40}$/;

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

  const frontendVersionLocator = page.getByTestId('frontend-version');

  const frontendVersion = (await frontendVersionLocator.textContent())?.trim();

  expect(frontendVersion).toBeTruthy();
  expect(frontendVersion).toMatch(gitCommitShaRegex);
  expect(frontendVersion).not.toBe(defaultFallbackGitSha);

  await expect(page.getByTestId('backend-version')).toHaveText('backend-e2e');
});
