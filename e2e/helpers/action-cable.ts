import { type Page } from '@playwright/test';

type IdentifierExpectation = Record<string, string | number | boolean | null | undefined>;

export async function waitForActionCableSubscription(
  page: Page,
  expectedIdentifier: IdentifierExpectation,
  timeout = 20_000,
) {
  await page.waitForFunction(
    ({ expected }) => {
      const state = (window as any).__turniereActionCable;
      const subscriptions = state?.subscriptions || {};

      return Object.values(subscriptions).some((subscription: any) => {
        if (!subscription?.confirmed) return false;
        const parsed = subscription.parsedIdentifier || {};

        return Object.entries(expected).every(([key, value]) => {
          if (value === null || value === undefined) return true;
          return String(parsed[key]) === String(value);
        });
      });
    },
    { expected: expectedIdentifier },
    { timeout },
  );
}
