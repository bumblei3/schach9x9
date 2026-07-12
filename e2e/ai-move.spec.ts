import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('AI Opponent Move', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('AI makes a move after player move in classic mode', async ({ page }) => {
    await helper.startGame('classic');
    await expect(page.locator('[data-testid="board"]')).toBeVisible();
    await page.waitForTimeout(1000);

    // Make a move: white pawn from row 7 to row 6
    await helper.clickCell(7, 4);
    await page.waitForTimeout(300);
    await helper.clickCell(6, 4);

    // Wait for AI to respond (iterative deepening can take up to 8s)
    await page.waitForTimeout(12000);

    const afterState = await page.evaluate(() => {
      const app = (window as any).app;
      return {
        turn: app.game.turn,
        phase: app.game.phase,
        moveCount: app.game.moveHistory.length,
      };
    });

    console.log('After state:', JSON.stringify(afterState));

    // After player move + AI move, turn should be back to white
    expect(afterState.turn).toBe('white');
    expect(afterState.moveCount).toBeGreaterThanOrEqual(2);
  });

  test('AI and player alternate moves correctly', async ({ page }) => {
    await helper.startGame('classic');
    await expect(page.locator('[data-testid="board"]')).toBeVisible();
    await page.waitForTimeout(1000);

    // First move: white pawn
    await helper.clickCell(7, 4);
    await page.waitForTimeout(300);
    await helper.clickCell(6, 4);

    // Wait for AI to respond (iterative deepening can take up to 8s)
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        return app && app.game && app.game.moveHistory.length >= 2;
      },
      { timeout: 15000 }
    );

    // Second move: white pawn again (after AI moved)
    await helper.clickCell(7, 3);
    await page.waitForTimeout(300);
    await helper.clickCell(6, 3);

    // Wait for second AI response
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        return app && app.game && app.game.moveHistory.length >= 4;
      },
      { timeout: 15000 }
    );

    const finalState = await page.evaluate(() => {
      const app = (window as any).app;
      return {
        turn: app.game.turn,
        moveCount: app.game.moveHistory.length,
      };
    });

    console.log('Final state:', JSON.stringify(finalState));

    // 2 player moves + 2 AI moves = 4 total
    expect(finalState.moveCount).toBeGreaterThanOrEqual(4);
    expect(finalState.turn).toBe('white');
  });
});
