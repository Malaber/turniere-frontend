import { expect, Locator } from '@playwright/test';

type ExpectedCardFrame = {
  state: string;
  cardBackground: string;
  badgeBackground: string;
};

export async function expectFullscreenMatchCardFrame(
  card: Locator,
  badge: Locator,
  expected: ExpectedCardFrame,
) {
  await expect(card).toHaveAttribute('data-match-state', expected.state);
  await expect(card).toHaveCSS('background-color', expected.cardBackground);
  await expect(badge).toHaveCSS('background-color', expected.badgeBackground);

  const cardBox = await card.boundingBox();
  const badgeBox = await badge.boundingBox();

  expect(cardBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();

  const cardRight = cardBox!.x + cardBox!.width;
  const badgeRight = badgeBox!.x + badgeBox!.width;

  expect(Math.abs(cardRight - badgeRight)).toBeLessThan(1.5);
  expect(Math.abs(cardBox!.height - badgeBox!.height)).toBeLessThan(1.5);
  expect(badgeBox!.width).toBeGreaterThan(40);
}
