import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Cross Mode', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('should start cross-shaped board in setup phase', async ({ page }) => {
    await helper.startGame('cross');

    const board = page.locator('[data-testid="board"]');
    await expect(board).toBeVisible();

    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(81);

    // Cross mode starts in the setup phase (pieces are placed by the player),
    // so the board is initially empty — assert the setup prompt instead of pieces.
    await helper.expectStatus(/König|Korridor|Platz|Setup/i);
  });
});
