import { test, expect, type Page } from '@playwright/test';
import { injectAuth, loadAuthState } from '../helpers/auth';
import { seedAndPlayGroupStage } from '../helpers/scenario-seeder';

const titleChildrenWarning = /React expects the `children` prop of <title> tags/;

test.setTimeout(240_000);

function collectTitleWarnings(page: Page): string[] {
  const warnings: string[] = [];

  page.on('console', (message) => {
    if (titleChildrenWarning.test(message.text())) {
      warnings.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    if (titleChildrenWarning.test(error.message)) {
      warnings.push(error.message);
    }
  });

  return warnings;
}

async function expectTitleWithoutReactWarning(
  page: Page,
  url: string,
  expectedTitle: string | RegExp,
  warnings: string[],
): Promise<void> {
  const previousWarningCount = warnings.length;

  await page.goto(url);
  await expect(page).toHaveTitle(expectedTitle, { timeout: 30_000 });

  expect(warnings.slice(previousWarningCount)).toEqual([]);
}

test('Dynamic document titles render as single text values', async ({ context, page }) => {
  await injectAuth(context, loadAuthState());
  const { tournament } = await seedAndPlayGroupStage(4, 4, 8);
  const warnings = collectTitleWarnings(page);

  await expectTitleWithoutReactWarning(page, `/t/${tournament.id}`, `${tournament.name}: turnie.re`, warnings);
  await expectTitleWithoutReactWarning(page, `/t/${tournament.id}/fullscreen`, `${tournament.name}: turnie.re`, warnings);
  await expectTitleWithoutReactWarning(page, `/t/${tournament.id}/statistics`, `${tournament.name}: turnie.re`, warnings);
  await expectTitleWithoutReactWarning(
    page,
    `/tournament-fullscreen-groups?code=${tournament.id}`,
    `${tournament.name}: turnie.re`,
    warnings,
  );
  await expectTitleWithoutReactWarning(
    page,
    `/t/${tournament.id}/mission-control`,
    `${tournament.name}: Mission Control`,
    warnings,
  );
  await expectTitleWithoutReactWarning(page, '/t/999999999', /^turnie\.re - Error \d+$/, warnings);

  expect(warnings).toEqual([]);
});
