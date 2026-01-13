import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Classic 9x9 Mode', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('should start with correct board setup', async ({ page: _page }) => {
    await helper.startGame('classic');

    // Check if board is visible
    const board = _page.locator('[data-testid="board"]');
    await expect(board).toBeVisible();

    // Check 9x9 grid
    const cells = _page.locator('.cell');
    await expect(cells).toHaveCount(81);

    // Verify key pieces from config: ['r', 'n', 'b', 'a', 'k', 'c', 'b', 'n', 'r']
    await helper.expectPiece(8, 4, 'k', 'white');
    await helper.expectPiece(8, 3, 'a', 'white');
    await helper.expectPiece(8, 5, 'c', 'white');
    await helper.expectPiece(8, 0, 'r', 'white');
    await helper.expectPiece(0, 4, 'k', 'black');
  });
});
