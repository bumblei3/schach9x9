import { test, expect } from '@playwright/test';

test.describe('Classic 9x9 Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).app !== undefined);
    // Wait for main menu
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  test('should start classic mode with correct board setup', async ({ page }) => {
    // Click "Klassisch (9x9)" card
    // Assuming there is a card for it or we might need to select it via console if UI isn't ready
    // Based on index.html analysis earlier, there is a "Klassisch" card.

    // Find card expecting to trigger classic start
    // The "Klassisch (9x9)" card usually has text "Klassisch (9x9)"
    const classicCard = page.locator('.gamemode-card').filter({ hasText: 'Klassisch 9x9' });
    await expect(classicCard).toBeVisible();
    await classicCard.click();

    // Should transition to game board (Main Menu hidden)
    const mainMenu = page.locator('#main-menu');
    await expect(page.locator('body')).toHaveClass(/game-initialized/);
    await expect(mainMenu).not.toHaveClass(/active/);
    await expect(mainMenu).toHaveCSS('pointer-events', 'none');

    // Check if board is visible
    await expect(page.locator('#board')).toBeVisible();

    // Check 9x9 grid
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(81); // 9x9

    // Check specific pieces for 9x9 variant
    // Row 0 (Black pieces): R N B Q K Q B N R
    // 0,0 should be 'r' (black rook)
    await expect(page.locator('.cell[data-r="0"][data-c="0"]')).toHaveAttribute('data-piece', 'r');
    await expect(page.locator('.cell[data-r="0"][data-c="4"]')).toHaveAttribute('data-piece', 'k');

    // Row 1 (Black pawns)
    await expect(page.locator('.cell[data-r="1"][data-c="0"]')).toHaveAttribute('data-piece', 'p');

    // Row 8 (White pieces)
    await expect(page.locator('.cell[data-r="8"][data-c="4"]')).toHaveAttribute('data-piece', 'k');
  });
});
