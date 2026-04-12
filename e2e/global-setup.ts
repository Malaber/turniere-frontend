import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const backendUrl = process.env.TURNIERE_BACKEND_URL ?? 'http://localhost:3000';
const frontendUrl = process.env.TURNIERE_FRONTEND_URL ?? 'http://localhost:80';
const email = process.env.TURNIERE_E2E_EMAIL ?? 'e2e@example.com';
const password = process.env.TURNIERE_E2E_PASSWORD ?? 'password123';

async function waitForUrl(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.status < 500) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = String(err);
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  throw new Error(`${url} did not become ready within ${timeoutMs}ms. Last error: ${lastError}`);
}

async function tryLogin(): Promise<{
  username: string;
  accesstoken: string;
  client: string;
  expiry: string;
  uid: string;
}> {
  const res = await fetch(`${backendUrl}/users/sign_in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Login failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => { headers[key] = value; });

  const accesstoken = headers['access-token'];
  const client = headers['client'];
  const uid = headers['uid'];
  const expiry = headers['expiry'] ?? '';

  if (!accesstoken || !client || !uid) {
    throw new Error('Login response missing auth headers');
  }

  return {
    username: data.data?.username ?? data.username ?? email,
    accesstoken,
    client,
    expiry,
    uid,
  };
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('[global-setup] Waiting for backend health…');
  await waitForUrl(`${backendUrl}/healthz`);
  console.log('[global-setup] Backend is ready.');

  console.log('[global-setup] Waiting for frontend…');
  await waitForUrl(frontendUrl);
  console.log('[global-setup] Frontend is ready.');

  // Retry login for up to 60s — gives the bootstrap service time to create the user.
  console.log('[global-setup] Logging in…');
  const loginDeadline = Date.now() + 60_000;
  let authState: Awaited<ReturnType<typeof tryLogin>> | undefined;

  while (true) {
    try {
      authState = await tryLogin();
      break;
    } catch (err) {
      if (Date.now() >= loginDeadline) {
        throw new Error(`Login did not succeed within 60s. Last error: ${err}`);
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  const authFile = path.join(__dirname, '.auth-state.json');
  fs.writeFileSync(authFile, JSON.stringify(authState, null, 2));
  console.log(`[global-setup] Auth state saved to ${authFile}.`);
}
