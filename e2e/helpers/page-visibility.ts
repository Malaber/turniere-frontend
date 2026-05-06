import { type Page } from '@playwright/test';

type PageVisibilityState = 'visible' | 'hidden';

export async function installPageVisibilityControls(
  page: Page,
  initialState: PageVisibilityState = 'visible',
) {
  await page.addInitScript((state: PageVisibilityState) => {
    let visibilityState = state;

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibilityState !== 'visible',
    });

    (window as any).__setPageVisibilityState = (nextState: PageVisibilityState) => {
      visibilityState = nextState;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  }, initialState);
}

export async function setPageVisibility(page: Page, state: PageVisibilityState) {
  await page.evaluate((nextState: PageVisibilityState) => {
    (window as any).__setPageVisibilityState(nextState);
  }, state);
}
