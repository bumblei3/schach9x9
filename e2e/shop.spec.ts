import { test, expect } from '@playwright/test';

test.describe('Shop System @shop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Enter Setup Mode
    await page.click('.gamemode-card:has-text("Truppen anheuern")');

    // Wait for Game Init and Phase
    await page.waitForFunction(
      () => (window as any).game && (window as any).game.phase === 'SETUP_WHITE_KING'
    );

    // Place White King at 8,4
    await page.click('.cell[data-r="8"][data-c="4"]');

    // Wait for AI to place Black King and phase to become 'SETUP_WHITE_PIECES'
    // This confirms Shop is active and points are reset
    await page.waitForFunction(() => (window as any).game.phase === 'SETUP_WHITE_PIECES', {
      timeout: 10000,
    });

    await expect(page.locator('#shop-panel')).toBeVisible();
  });

  test('should deduct points when buying a piece', async ({ page }) => {
    // Initial points should be 25
    await expect(page.locator('#points-display')).toHaveText('25');

    // 2. Select a Knight (Springer) - Cost 3
    const knightBtn = page.locator('.shop-item[data-piece="n"]');
    await expect(knightBtn).toBeVisible();
    await knightBtn.click();

    // Verify selection visual feedback
    await expect(knightBtn).toHaveClass(/selected/);
    await expect(page.locator('#selected-piece-display')).toContainText('Springer');

    // 3. Place on board (Row 6, Col 4 - White Corridor)
    // Check valid corridor from GameController (rows 6-8 for White)
    const targetCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await targetCell.click();

    // 4. Verify points deducted (25 - 3 = 22)
    await expect(page.locator('#points-display')).toHaveText('22');

    // 5. Verify piece is on board
    await expect(targetCell).toHaveAttribute('data-piece', 'n');
  });

  test('should refund points when selling a piece', async ({ page }) => {
    await expect(page.locator('#points-display')).toHaveText('25');

    // 2. Buy and Place a Rook (Turm) - Cost 5
    const rookBtn = page.locator('.shop-item[data-piece="r"]');
    await rookBtn.click();
    await expect(rookBtn).toHaveClass(/selected/);

    // Place at 6,5 (Empty, valid for white)
    await page.click('.cell[data-r="6"][data-c="5"]');

    await expect(page.locator('.cell[data-r="6"][data-c="5"]')).toHaveAttribute('data-piece', 'r');
    await expect(page.locator('#points-display')).toHaveText('20');

    // 3. Click the Rook again to sell it
    await page.click('.cell[data-r="6"][data-c="5"]');

    // 5. Verify refund (20 + 5 = 25)
    await expect(page.locator('#points-display')).toHaveText('25');
    await expect(page.locator('.cell[data-r="6"][data-c="5"]')).not.toHaveAttribute('data-piece');
  });

  test('should prevent buying if not enough points', async ({ page }) => {
    // 1. Cheat: Set points to 1 (After reset happened in transition)
    await page.evaluate(() => {
      const game = (window as any).game;
      game.points = 1;
      (window as any).UI.updateShopUI(game);
    });
    await expect(page.locator('#points-display')).toHaveText('1');

    // 2. Try to buy Queen (Cost 9)
    const queenBtn = page.locator('.shop-item[data-piece="q"]');
    // UI adds .disabled class
    await expect(queenBtn).toHaveClass(/disabled/);

    // Even if we force click
    await queenBtn.click({ force: true });

    // 3. Try to place
    const targetCell = page.locator('.cell[data-r="8"][data-c="5"]');
    await targetCell.click();

    // 4. Verify no change
    await expect(page.locator('#points-display')).toHaveText('1');
    await expect(targetCell).not.toHaveAttribute('data-piece');
  });
});
