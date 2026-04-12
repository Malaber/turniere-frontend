import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { loadAuthState, injectAuth } from '../helpers/auth';

test('Tournament creation flow (requires login)', async ({ page, context }, testInfo) => {
  // Inject auth state so the app treats the session as already logged in
  const auth = loadAuthState();
  await injectAuth(context, auth);

  await page.goto('/create');
  await page.waitForLoadState('networkidle');

  await keyframe(page, testInfo, 'create_page_loaded');

  // Page heading
  await expect(page.locator('h1').filter({ hasText: 'Turnier erstellen' })).toBeVisible();

  // Fill in tournament name
  const tournamentName = `E2E Test Tournament ${Date.now()}`;
  await page.fill('input[name="name"]', tournamentName);

  // Add teams via the EditableStringList component
  // The component renders an input for each new team — find the add button and team input
  for (const teamName of ['Alpha', 'Beta', 'Gamma', 'Delta']) {
    // Type into the last visible team-name input and press Enter or click add
    const addBtn = page.getByRole('button', { name: 'hinzufügen' });
    await expect(addBtn).toBeVisible();

    // Find the text input adjacent to the add button
    const teamInput = page.locator('input[placeholder="Teamname"]');
    await teamInput.fill(teamName);
    await addBtn.click();
  }

  await keyframe(page, testInfo, 'create_teams_added');

  // Submit the form
  await page.getByRole('button', { name: 'Turnier erstellen' }).last().click();

  // After creation, the app redirects to /t/:id
  await page.waitForURL(/\/t\/\d+/, { timeout: 15_000 });

  await keyframe(page, testInfo, 'create_tournament_result');

  // The tournament page shows the name we entered
  await expect(page.getByText(tournamentName)).toBeVisible();
});
