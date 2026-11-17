import { test, expect } from '@playwright/test';
import { E2EHelper, domClick } from './helpers/E2EHelper.js';

/**
 * Info-/Zugprotokoll-Panel.
 *
 * Der Button im Aktionsmenü, das Panel mit Tabs und die Inhalte (`#move-history`,
 * `#log-panel` werden per JS befüllt) existierten alle — aber weder Einstieg,
 * noch Schließen, noch der Tab-Wechsel waren verdrahtet. Der Button war
 * wirkungslos, das Panel unsichtbar.
 */

test.describe('Info-/Zugprotokoll-Panel', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('Info-Button öffnet das Panel, Tabs wechseln, Schließen funktioniert', async ({ page }) => {
    await helper.startGame('classic');
    await expect(page.locator('[data-testid="board"]')).toBeVisible();
    await page.waitForTimeout(800);

    // Ein Zug, damit die Historie einen Eintrag hat.
    await helper.clickCell(7, 4);
    await page.waitForTimeout(250);
    await helper.clickCell(6, 4);
    await page.waitForFunction(() => (window as any).app.game.moveHistory.length >= 1, {
      timeout: 10000,
    });

    await expect(page.locator('#info-overlay')).toHaveClass(/hidden/);

    await domClick(page, '#action-more-btn');
    await expect(page.locator('#info-toggle-btn')).toBeVisible();
    await domClick(page, '#info-toggle-btn');

    await expect(page.locator('#info-overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#info-toggle-btn')).toHaveClass(/active/);
    await expect(page.locator('#tab-history')).toHaveClass(/active/);
    await expect(page.locator('#move-history')).not.toBeEmpty();

    // Tab-Wechsel auf das Log.
    await page.locator('.info-tabs .tab-btn[data-tab="log"]').click();
    await expect(page.locator('#tab-log')).toHaveClass(/active/);
    await expect(page.locator('#tab-history')).not.toHaveClass(/active/);

    // Schließen über den Panel-Kopf.
    await page.locator('#info-close-btn').click();
    await expect(page.locator('#info-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#info-toggle-btn')).not.toHaveClass(/active/);
  });
});
