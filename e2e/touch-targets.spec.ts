import { test, expect, devices } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * README wirbt mit "Touch-Targets >= 44x44px". `css/base.css` erzwingt das unter
 * `@media (pointer: coarse)` fuer interaktive Elemente — geprueft wurde es nie.
 *
 * Der Spec emuliert ein Geraet mit `pointer: coarse` (iPhone 13-Deskriptor statt
 * nur `hasTouch`: ohne `isMobile`/User-Agent-Emulation meldet Chrome
 * `pointer: fine`, und die Media-Regel greift nicht). Brettfelder sind bewusst
 * ausgenommen: Sie sind keine Steuerelemente im Sinne von WCAG 2.5.5, und ihre
 * Groesse folgt der Brettgeometrie (36,7 px bei 9x9 auf 390 px), nicht einem
 * Minimum.
 */
// Top-Level, ohne `defaultBrowserType`: der Deskriptor wäre WebKit, die Suite
// laeuft hier auf Chromium (`/usr/bin/chromium-browser`). Ohne `isMobile`/UA
// meldet Chrome `pointer: fine`, dann ginge die Media-Regel gar nicht erst in
// Kraft — deshalb die einzelnen Felder statt der gesamten Kopie.
const iPhone = devices['iPhone 13'];
test.use({
  viewport: iPhone.viewport,
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: iPhone.deviceScaleFactor,
  userAgent: iPhone.userAgent,
});

test.describe('Touch-Zielgroessen @touch', () => {

  const sammle = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      if (!matchMedia('(pointer: coarse)').matches) {
        throw new Error('Emulation meldet nicht pointer: coarse — Regel greift sonst nicht');
      }
      const sel = 'button, a[href], select, input, summary, [role="button"], .gamemode-card, .tab-btn, .menu-item';
      return [...document.querySelectorAll(sel)]
        .filter(el => el.checkVisibility())
        .map(el => {
          const r = el.getBoundingClientRect();
          return {
            id: el.id || el.getAttribute('data-mode') || String(el.className).slice(0, 28),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter(x => x.w > 1 && x.h > 1)
        .filter(x => x.w < 44 || x.h < 44);
    });

  test('Menue: jedes sichtbare Steuerelement >= 44px', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();
    expect(await sammle(page)).toEqual([]);
  });

  test('Partie: Aktionsleiste und Kopf >= 44px', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();
    await helper.startGame('classic');
    expect(await sammle(page)).toEqual([]);
  });
});
