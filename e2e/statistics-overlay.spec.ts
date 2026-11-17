import { test, expect } from '@playwright/test';
import { E2EHelper, domClick } from './helpers/E2EHelper.js';

/**
 * Statistik-Overlay.
 *
 * `showStatisticsOverlay()` und `updateStatistics()` waren fertig, aber nie
 * eingebunden: kein Einstieg, `stats-close-btn` ohne Listener, und die beiden
 * Karten `#stat-moves`/`#stat-captures` fehlten im Markup, obwohl der Code sie
 * befüllt.
 */

test.describe('Statistik-Overlay', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('Statistiken anzeigen, sechs Karten gefüllt, schließen', async ({ page }) => {
    await helper.startGame('classic');
    await expect(page.locator('[data-testid="board"]')).toBeVisible();
    await page.waitForTimeout(800);

    // Zwei Züge, damit Züge/Schläge/Material/Differenz sichtbar werden.
    await helper.clickCell(7, 4);
    await page.waitForTimeout(250);
    await helper.clickCell(6, 4);
    await page.waitForFunction(() => (window as any).app.game.moveHistory.length >= 1, {
      timeout: 10000,
    });

    await expect(page.locator('#stats-overlay')).toHaveClass(/hidden/);

    await domClick(page, '#action-more-btn');
    await expect(page.locator('#stats-btn')).toBeVisible();
    await domClick(page, '#stats-btn');

    await expect(page.locator('#stats-overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#stats-btn')).toHaveClass(/active/);

    // Die zwei nachgerüsteten Karten sind da und gefüllt.
    await expect(page.locator('#stat-moves')).toHaveText('1');
    await expect(page.locator('#stat-captures')).toBeVisible();
    await expect(page.locator('#stat-accuracy')).toBeVisible();
    await expect(page.locator('#stat-best-moves')).toBeVisible();
    await expect(page.locator('#stat-material')).toBeVisible();
    await expect(page.locator('#stat-elo')).toBeVisible();

    await page.locator('#stats-close-btn').click();
    await expect(page.locator('#stats-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#stats-btn')).not.toHaveClass(/active/);
  });
});
