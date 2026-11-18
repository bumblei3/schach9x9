import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Tutor-Modus („Rate den Zug!").
 *
 * `MoveAnalyzer` wertet `game.tutorMode === 'guess_the_move'` aus, aber der
 * Einstellungs-Eintrag fehlte im Markup — der Modus war nur über Tests
 * erreichbar. Gleiches Muster wie KI-Mentor/Schwierigkeit: Wahl speichern,
 * anwenden, in `initGame` übernehmen.
 */

test.describe('Tutor-Modus', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('Rate den Zug! ist wählbar und wird beim Start übernommen', async ({ page }) => {
    // Die Wahl steht im Hauptmenü, nicht mitten im Spiel.
    await page.locator('.menu-tab-btn[data-tab="settings"]').click();
    const select = page.locator('#tutor-mode-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('');

    await select.selectOption('guess_the_move');
    await expect(select).toHaveValue('guess_the_move');

    await page.locator('.menu-tab-btn[data-tab="play"]').click();
    await helper.startGame('classic');
    await page.waitForFunction(() => !!(window as any).app?.game, { timeout: 15000 });

    // `initGame` hat den gespeicherten Wert übernommen.
    await expect(
      page.evaluate(() => (window as any).app.game.tutorMode === 'guess_the_move')
    ).resolves.toBe(true);

    // …die Wahl übersteht einen Reload (Select steht aus dem Speicher) …
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('app-ready'), {
      timeout: 20000,
    });
    await page.locator('.menu-tab-btn[data-tab="settings"]').click();
    await expect(page.locator('#tutor-mode-select')).toHaveValue('guess_the_move');
    await expect(page.evaluate(() => localStorage.getItem('chess_tutor_mode'))).resolves.toBe(
      'guess_the_move'
    );

    // … und nach einem erneuten Start greift der Modus wieder.
    await page.locator('.menu-tab-btn[data-tab="play"]').click();
    await helper.startGame('classic');
    await page.waitForFunction(() => !!(window as any).app?.game, { timeout: 15000 });
    await expect(
      page.evaluate(() => (window as any).app.game.tutorMode === 'guess_the_move')
    ).resolves.toBe(true);
  });
});
