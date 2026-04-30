import { test, expect } from '@playwright/test';
import * as fs from 'fs/promises';
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

  const csvPath = testInfo.outputPath('teams.csv');
  await fs.writeFile(csvPath, [
    '"Bestellnummer","Name Teilnehmer*in","Teilnehmer*innenname: Vorname","Teilnehmer*innenname: Nachname","Produkt","Preis","Eingecheckt","Ausgetreten","Automatisch eingecheckt","E-Mail","Telefonnummer","Team Name","Firma","Gutscheincode","Bestelldatum","Bestelluhrzeit","Benötigt besondere Behandlung","Kommentar","Check-in-Hinweis","Sitzplatz-ID","Sitzbezeichnung","Sitzbereich","Sitzreihe","Sitzplatz","Gesperrt","Gültig ab","Gültig bis","Adresse","Postleitzahl","Stadt","Land","Bundesstaat"',
    '"39WQH","Simon Maier","Simon","Maier","Team Ticket 11. Beerpongturnier (2 Pers)","50,00","","","Nein","simonmaier@toast.com","","Simsalabier","","","2026-03-01","12:03:00","Nein","","","","","","","","","","","Hauptstraße 435983475","55555","Anderswo","DE",""',
    '"40WQH","Ada Hopfen","Ada","Hopfen","Team Ticket 11. Beerpongturnier (2 Pers)","50,00","","","Nein","ada@example.com","","Hopfenhelden","","","2026-03-01","12:04:00","Nein","","","","","","","","","","","Bierstraße 12","55555","Anderswo","DE",""',
    '"41WQH","Ben Becher","Ben","Becher","Team Ticket 11. Beerpongturnier (2 Pers)","50,00","","","Nein","ben@example.com","","Becherwerfer","","","2026-03-01","12:05:00","Nein","","","","","","","","","","","Pingweg 3","55555","Anderswo","DE",""',
    '"42WQH","Paula Pong","Paula","Pong","Team Ticket 11. Beerpongturnier (2 Pers)","50,00","","","Nein","paula@example.com","","Pongstars","","","2026-03-01","12:06:00","Nein","","","","","","","","","","","Pongallee 4","55555","Anderswo","DE",""',
  ].join('\n'));

  const csvInput = page.locator('input[type="file"]');
  await expect(csvInput).toBeVisible();
  await csvInput.setInputFiles(csvPath);
  await expect(page.locator('#team-csv-column')).toBeVisible();
  await expect(page.locator('#team-csv-column')).toHaveValue('11');

  await page.getByRole('button', { name: 'Teamnamen aus CSV hinzufügen' }).click();
  for (const teamName of ['Simsalabier', 'Hopfenhelden', 'Becherwerfer', 'Pongstars']) {
    await expect(page.getByText(teamName)).toBeVisible();
  }

  await keyframe(page, testInfo, 'create_teams_added');

  // Submit the form
  await page.getByRole('button', { name: 'Turnier erstellen' }).last().click();

  // After creation, the app redirects to the tournament page.
  await page.waitForURL(/\/t\/[^/]+$/, { timeout: 15_000 });

  await keyframe(page, testInfo, 'create_tournament_result');

  // The tournament page shows the name we entered
  await expect(page.getByText(tournamentName)).toBeVisible();
});
