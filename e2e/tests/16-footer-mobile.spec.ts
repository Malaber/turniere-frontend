import { test, expect } from '@playwright/test';
import { keyframe } from '../helpers/screenshot';
import { seedGroupStageTournament } from '../helpers/scenario-seeder';

test.setTimeout(600_000);

test.describe('Mobile footer', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });

  test('stacks copyright above links and uses the current year', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    const copyright = footer.getByTestId('footer-copyright');
    const footerLinks = footer.locator('nav[aria-label="Footer"]');
    await footer.scrollIntoViewIfNeeded();

    await expect(footer).toBeVisible();
    await expect(footer).toBeInViewport();
    await expect(copyright).toHaveText(`© ${new Date().getFullYear()} turnie.re`);
    await expect(footer.getByRole('link', { name: 'Version' })).toHaveAttribute('href', '/version');
    await expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy');
    await expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint');

    const copyrightBox = await copyright.boundingBox();
    const linksBox = await footerLinks.boundingBox();
    expect(copyrightBox).not.toBeNull();
    expect(linksBox).not.toBeNull();
    expect(copyrightBox!.y + copyrightBox!.height).toBeLessThanOrEqual(linksBox!.y);
    await expect(footer.getByRole('link', { name: 'iOS-App', exact: true })).toHaveAttribute('href', '/app');
    await expect(footer.getByRole('link', { name: 'App-Hilfe', exact: true })).toHaveAttribute('href', '/support');
    const linkBoxes = await footer.getByRole('link').evaluateAll(links =>
      links.map(link => {
        const { x, y, width, height } = link.getBoundingClientRect();
        return { x, y, width, height };
      })
    );
    // Links may wrap as navigation grows. Every link must remain inside its
    // navigation container, below copyright, and separate from every other link.
    for (const [index, box] of linkBoxes.entries()) {
      expect(box.x).toBeGreaterThanOrEqual(linksBox!.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(linksBox!.x + linksBox!.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(linksBox!.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(linksBox!.y + linksBox!.height + 1);
      for (const other of linkBoxes.slice(index + 1)) {
        const separated = box.x + box.width <= other.x + 1 ||
          other.x + other.width <= box.x + 1 ||
          box.y + box.height <= other.y + 1 || other.y + other.height <= box.y + 1;
        expect(separated, 'Footer links must not overlap').toBe(true);
      }
    }

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);

    await keyframe(page, testInfo, 'mobile_footer_landing');
  });

  test('stays below long mobile content without horizontal overflow', async ({ page }, testInfo) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    const footerLinks = page.locator('footer nav[aria-label="Footer"]');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
    await expect(footerLinks).toBeVisible();

    const footerBox = await footer.boundingBox();
    const lastContentBox = await page
      .getByText('Ja, die in der Gruppenphase dargestellte Tabelle stellt eine Blitztabelle dar.')
      .boundingBox();
    expect(footerBox).not.toBeNull();
    expect(lastContentBox).not.toBeNull();
    expect(footerBox!.y).toBeGreaterThan(lastContentBox!.y + lastContentBox!.height);

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);

    await keyframe(page, testInfo, 'mobile_footer_long_content');
  });

  test('stays below the final mobile tournament group', async ({ page }, testInfo) => {
    const { tournament } = await seedGroupStageTournament(12, 4, 8);

    await page.goto(`/t/${tournament.id}`);
    await expect(page.locator('.stages').first()).toBeVisible({ timeout: 120000 });

    const footer = page.locator('footer');
    const finalGroupHeading = page.getByRole('heading', { name: 'Gruppe 12', exact: true });
    const finalGroupCard = finalGroupHeading.locator(
      'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " card ")][1]'
    );

    await expect(finalGroupHeading).toBeVisible();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();

    const footerBox = await footer.boundingBox();
    const finalGroupBox = await finalGroupCard.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(finalGroupBox).not.toBeNull();
    expect(footerBox!.y).toBeGreaterThanOrEqual(finalGroupBox!.y + finalGroupBox!.height - 1);
    await expect(page.getByRole('button', { name: 'Nach oben' })).toBeHidden();

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);

    await keyframe(page, testInfo, 'mobile_footer_tournament_bottom');
  });
});

test.describe('Footer page position', () => {
  test('starts at the top of the page on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const navigationBox = await page.locator('nav.navbar').boundingBox();
    expect(navigationBox).not.toBeNull();
    expect(navigationBox!.y).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('starts at the top of the page on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const navigationBox = await page.locator('nav.navbar').boundingBox();
    expect(navigationBox).not.toBeNull();
    expect(navigationBox!.y).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
