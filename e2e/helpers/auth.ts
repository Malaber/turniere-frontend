import { BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const e2eEmail = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const e2ePassword = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

export interface AuthState {
  username: string;
  accesstoken: string;
  client: string;
  expiry: string;
  uid: string;
}

export async function injectAuthState(context: BrowserContext, state: AuthState): Promise<void> {
  await context.addInitScript((nextState: AuthState) => {
    const existing = localStorage.getItem('reduxState');
    const reduxState = existing ? JSON.parse(existing) : {};
    reduxState.userinfo = {
      ...(reduxState.userinfo || {}),
      isSignedIn: true,
      username: nextState.username,
      accesstoken: nextState.accesstoken,
      client: nextState.client,
      expiry: nextState.expiry,
      uid: nextState.uid,
      error: false,
      errorMessages: [],
    };
    localStorage.setItem('reduxState', JSON.stringify(reduxState));
  }, state);
}

/** Load the auth state written by global-setup. */
export function loadAuthState(): AuthState {
  const file = path.join(__dirname, '..', '.auth-state.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as AuthState;
}

async function freshLoginAttempt(): Promise<AuthState> {
  const res = await fetch(`${backendUrl}/users/sign_in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email: e2eEmail, password: e2ePassword }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Fresh login failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    username: data.data?.username ?? data.username ?? e2eEmail,
    accesstoken: res.headers.get('access-token')!,
    client: res.headers.get('client')!,
    uid: res.headers.get('uid')!,
    expiry: res.headers.get('expiry') ?? '',
  };
}

/** Perform a fresh login to get a valid token. */
async function freshLogin(): Promise<AuthState> {
  const loginDeadline = Date.now() + 60_000;

  while (true) {
    try {
      return await freshLoginAttempt();
    } catch (err) {
      if (Date.now() >= loginDeadline) {
        throw new Error(`Fresh login did not succeed within 60s. Last error: ${err}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

/**
 * Inject auth state into the browser context via localStorage.
 * Performs a fresh login to get a valid token, since the global-setup
 * token may have been rotated by preceding test seeders.
 */
export async function injectAuth(context: BrowserContext, _auth?: AuthState): Promise<void> {
  const auth = await freshLogin();
  await injectAuthState(context, auth);
}
