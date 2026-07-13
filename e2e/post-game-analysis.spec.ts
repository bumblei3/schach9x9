import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Post-Game Analysis (Blunder/Accuracy)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('shows accuracy + analysis button after game ends', async ({ page }) => {
    await helper.startGame('classic');

    // Force a game end via resign — this triggers showPostGameStats in the
    // game-over overlay (same path a real finished game takes). Wait for the
    // controller to be ready (App.init is async).
    await page.waitForFunction(
      () =>
        (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );
    await page.evaluate(() => {
      const app = (
        window as unknown as { app: { gameController: { resign: (c: string) => void } } }
      ).app;
      app.gameController.resign('white');
    });

    // Game-over overlay should appear.
    await expect(page.locator('#game-over-overlay')).toBeVisible({ timeout: 10000 });

    // Post-game stats show accuracy (the core of the analysis feature).
    const stats = page.locator('#game-over-stats');
    await expect(stats).toBeVisible({ timeout: 10000 });
    await expect(stats).toContainText('%');

    // The "Nachspiel-Analyse" button is wired and visible.
    const btn = page.locator('#postgame-analysis-btn');
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test('analysis button opens the summary modal', async ({ page }) => {
    await helper.startGame('classic');

    await page.waitForFunction(
      () =>
        (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );
    await page.evaluate(() => {
      const app = (
        window as unknown as { app: { gameController: { resign: (c: string) => void } } }
      ).app;
      app.gameController.resign('white');
    });
    await expect(page.locator('#postgame-analysis-btn')).toBeVisible({ timeout: 10000 });

    // Click the analysis button -> opens the summary modal with move qualities.
    await page.locator('#postgame-analysis-btn').click();
    await page.waitForTimeout(500);

    // The analysis summary modal surfaces accuracy + move-quality breakdown.
    await expect(page.locator('.analysis-summary, #modal-overlay')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('body')).toContainText(
      /%|Blunder|Genauigkeit|Accuracy|Analyse abgeschlossen/i
    );
  });
});
