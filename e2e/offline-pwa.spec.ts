import { test, expect, type Page } from '@playwright/test';

/**
 * Offline-Runde gegen die ausgelieferte `dist/`.
 *
 * Die README wirbt mit "PWA & Mobile Ready: Installierbar, offline spielbar".
 * `tests/serviceWorker.test.ts` prüft den Worker mit einem Mock-Scope,
 * `tests/serviceWorkerRegistration.test.ts` die Guard-Logik — aber kein
 * einziger Spec hat je einen echten Browser offline geschaltet. Damit war
 * "offline spielbar" eine Behauptung über Dateien, keine über ein Lauf.
 *
 * Warum die Umgehung über `?disable-sw`: Der Registrierungs-Guard in
 * `js/serviceWorkerRegistration.ts` prüft `navigator.webdriver` und
 * `?disable-sw`. Unter Playwright ist `webdriver` true, also würde die App den
 * Worker nie registrieren — genau richtig für die restliche Suite, hier aber
 * der zu testende Pfad. Der Worker wird deshalb per `page.evaluate` selbst
 * registriert (gleiches Muster wie die manuelle Registrierung in den
 * Playtest-Skripten).
 *
 * Reihenfolge ist entscheidend: registrieren → `serviceWorker.ready` → Netz
 * aus → Reload. Der Reload nachträglich wäre zu spät, der Cache müsste erst
 * gefüllt sein.
 */

async function offlineAnschalten(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
}

test.describe('Offline / PWA', () => {
  test('Service Worker precacht die Shell und die Partie läuft offline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/Failed to load resource/i.test(text)) return;
      errors.push(text);
    });
    page.on('pageerror', err => errors.push(err.message));

    // ?disable-sw: die Suite soll nicht selbst den Worker registrieren; wir
    // registrieren unten bewusst von Hand.
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('service-worker.js');
      await navigator.serviceWorker.ready;
      const keys = await caches
        .open('schach9x9-v9')
        .then(cache => cache.keys())
        .catch(() => [] as Response[]);
      return {
        active: !!reg.active,
        entries: keys.length,
        urls: keys.map(k => k.url),
      };
    });

    expect(sw.active, 'Service Worker wurde nicht aktiv').toBe(true);
    expect(sw.entries, 'Precache leer — Offline-Shell fehlt').toBeGreaterThan(0);
    // Das Eröffnungsbuch ist das größte Single-Asset; ohne es spielt die KI
    // offline nur mit leerem Buch.
    expect(
      sw.urls.some(u => u.includes('opening-book.json')),
      'Eröffnungsbuch fehlt im Precache'
    ).toBe(true);

    await offlineAnschalten(page);

    // Reload mit Netz aus: alles muss aus dem Cache kommen.
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('app-ready'), {
      timeout: 20000,
    });
    await expect(page.locator('#main-menu')).toBeVisible();

    // Partie starten (Karte → "Sofort spielen"), dann e2–e4 und abwarten,
    // bis die KI gezogen hat. Das ist die echte Akzeptanz: Brett, Engine,
    // Worker und Buch kommen aus dem Cache, nicht aus dem Netz.
    await page.locator('.gamemode-card[data-mode="classic"]').click({ force: true });
    await page
      .locator('#modal-actions')
      .getByRole('button', { name: 'Sofort spielen', exact: true })
      .click();
    await expect(page.locator('[data-testid="board"]')).toBeVisible({ timeout: 15000 });

    await page.locator('.cell[data-r="7"][data-c="4"]').click();
    await page.waitForTimeout(200);
    await page.locator('.cell[data-r="5"][data-c="4"]').click();

    await page.waitForFunction(() => (window as any).app.game?.moveHistory.length >= 2, {
      timeout: 20000,
    });

    const stand = await page.evaluate(() => {
      const game = (window as any).app.game;
      return { moves: game.moveHistory.length, phase: game.phase };
    });
    expect(stand.moves).toBeGreaterThanOrEqual(2);
    expect(stand.phase).toBe('PLAY');

    expect(errors, `Konsolenfehler offline:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
