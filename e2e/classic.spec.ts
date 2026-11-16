import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Classic 9x9 Mode', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('asks whether to play at once or spend 25 points', async ({ page }) => {
    await page.locator('.gamemode-card[data-mode="classic"]').click({ force: true });
    await expect(
      page.locator('#modal-actions').getByRole('button', { name: 'Sofort spielen', exact: true })
    ).toBeVisible();
    await expect(
      page
        .locator('#modal-actions')
        .getByRole('button', { name: 'Mit 25 Punkten verbessern', exact: true })
    ).toBeVisible();
    await page
      .locator('#modal-actions')
      .getByRole('button', { name: 'Zurück', exact: true })
      .click();
    await expect(page.locator('#main-menu')).toHaveClass(/active/);
    await expect(page.locator('.gamemode-card[data-mode="upgrade"]')).toHaveCount(0);
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
