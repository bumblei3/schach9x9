import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Daily Puzzle Mode (browser)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('loads a daily puzzle with pieces and shows the puzzle menu', async ({ page }) => {
    await helper.startGame('daily-puzzle');

    // The daily puzzle loads through the puzzleManager pipeline: the board
    // must render a real position (not blank) and the puzzle menu shows.
    const board = page.locator('[data-testid="board"]');
    await expect(board).toBeVisible();
    await expect(page.locator('.cell')).toHaveCount(81);

    const firstPiece = page.locator('.cell[data-piece]').first();
    await expect(firstPiece).toBeVisible({ timeout: 10000 });

    // Puzzle menu / overlay should be visible for the daily puzzle.
    await expect(page.locator('#puzzle-menu-overlay')).toBeVisible({ timeout: 10000 });

    // Main-menu daily-puzzle card must exist with its badge element.
    await expect(page.locator('.gamemode-card[data-mode="daily-puzzle"]')).toBeVisible();
    await expect(page.locator('#daily-puzzle-badge')).toBeAttached();
  });
});
