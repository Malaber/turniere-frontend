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

/** Load the auth state written by global-setup. */
export function loadAuthState(): AuthState {
  const file = path.join(__dirname, '..', '.auth-state.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as AuthState;
}

/** Perform a fresh login to get a valid token. */
async function freshLogin(): Promise<AuthState> {
  const res = await fetch(`${backendUrl}/users/sign_in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email: e2eEmail, password: e2ePassword }),
    signal: AbortSignal.timeout(10_000),
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

/**
 * Inject auth state into the browser context via localStorage.
 * Performs a fresh login to get a valid token, since the global-setup
 * token may have been rotated by preceding test seeders.
 */
export async function injectAuth(context: BrowserContext, _auth?: AuthState): Promise<void> {
  const auth = await freshLogin();

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
