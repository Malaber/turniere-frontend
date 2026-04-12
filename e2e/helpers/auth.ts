import { BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthState {
  username: string;
  accesstoken: string;
  client: string;
  expiry: string;
  uid: string;
}

/** Load the auth state written by global-setup. */
export function loadAuthState(): AuthState {
  const file = path.join(__dirname, '..', '.auth-state.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as AuthState;
}

/**
 * Inject auth state into the browser context via localStorage.
 * Call before any navigation — the app reads reduxState from localStorage on mount.
 */
export async function injectAuth(context: BrowserContext, auth: AuthState): Promise<void> {
  await context.addInitScript((state: AuthState) => {
    const reduxState = {
      userinfo: {
        isSignedIn: true,
        username: state.username,
        accesstoken: state.accesstoken,
        client: state.client,
        expiry: state.expiry,
        uid: state.uid,
        error: false,
        errorMessages: [],
      },
    };
    localStorage.setItem('reduxState', JSON.stringify(reduxState));
  }, auth);
}
