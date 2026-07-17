import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Real-browser gate for gameController.handleGameEnd branching (the 70%-branch
 * hotspot). Unit tests prove the chart math, but NOT that handleGameEnd wires
 * the solo-only charts vs the campaign victory path correctly. This is exactly
 * the blank-board / wrong-wiring class of bug unit tests miss.
 *
 * Invariants verified:
 *  - SOLO (classic, not campaign): resign => heatmap panel + material graph +
 *    move-time graph all become visible (the `if (!campaignMode)` block).
 *  - CAMPAIGN: handleGameEnd('win') => NO heatmap panel (campaign path skips
 *    it), instead the campaign victory modal ("Sieg!") appears.
 */
test.describe('handleGameEnd wiring: solo charts vs campaign victory', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('SOLO: resign shows heatmap + material + move-time charts', async ({ page }) => {
    await helper.startGame('classic');

    await page.waitForFunction(
      () =>
        (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );

    // Play one real white move so moveHistory is non-empty (charts need >=1 move).
    await helper.clickCell(7, 4);
    await helper.clickCell(6, 4);

    await page.waitForFunction(
      () =>
        ((window as unknown as { app: { game: { moveHistory: unknown[] } } }).app.game
          .moveHistory?.length ?? 0) >= 1,
      { timeout: 15000 }
    );

    await page.evaluate(() => {
      const app = window as unknown as { app: { gameController: { resign: (c: string) => void } } };
      app.app.gameController.resign('white');
    });

    // Solo-only panels must appear.
    await expect(page.locator('#move-heatmap-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#material-graph')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#move-time-graph')).toBeVisible({ timeout: 10000 });

    // And the campaign victory modal must NOT appear on a solo loss.
    await expect(page.locator('#generic-modal')).not.toBeVisible({ timeout: 5000 });
  });

  test('CAMPAIGN: win triggers victory modal, NOT the solo charts', async ({ page }) => {
    await page.click('#campaign-start-btn');
    await page.locator('.campaign-level-card').first().click();
    await expect(page.locator('#board')).toBeVisible();

    await page.waitForFunction(() => (window as unknown as { gameController?: unknown }).gameController != null, {
      timeout: 10000,
    });

    // Drive the campaign victory path directly (same as campaign.spec.ts).
    await page.evaluate(() => {
      const game = (window as unknown as { game: any; gameController: any }).game;
      const controller = (window as unknown as { gameController: any }).gameController;
      game.campaignMode = true;
      game.currentLevelId = 'peasant_revolt';
      game.playerColor = 'white';
      game.stats.totalMoves = 10;
      controller.handleGameEnd('win', 'white');
    });

    // Campaign path: victory modal, NOT the solo heatmap panel.
    const victoryModal = page.locator('#generic-modal');
    await expect(victoryModal).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#modal-title')).toHaveText('Sieg!');

    await expect(page.locator('#move-heatmap-panel')).not.toBeVisible({ timeout: 5000 });
  });
});
