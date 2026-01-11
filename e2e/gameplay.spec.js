import { test, expect } from '@playwright/test';

test.describe('Core Gameplay Loop', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    // Go to home
    await page.goto('/');

    // Wait for usage overlay
    await expect(page.locator('#points-selection-overlay')).toBeVisible();
  });

  test('should start a game and execute a move', async ({ page }) => {
    // 1. Select 15 Points (Standard Mode)
    await page.click('button[data-points="15"]');

    // 2. Wait for Board & Setup Mode
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // 3. Place White King (Row 7, Col 4)
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await whiteKingCell.click();

    // 4. Wait for AI to place Black King & Phase Change
    // Phase changes from SETUP_INGS -> SETUP_WHITE_PIECES -> GAME (after "Fertig")
    // For this test, let's just place the king and sufficient pieces to start,
    // OR simpler: check that we can place pieces in the shop phase.

    // Wait for Shop Panel (means Kings are placed)
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });

    // 5. Finish Setup / Start Game
    // We need to place at least one piece or just click "Fertig" (Done) if allowed?
    // Usually need to spend points. Let's buy a Pawn.

    // Click Pawn in shop (Cost 1) - data-piece="p"
    const pawnItem = page.locator('.shop-item[data-piece="p"]');
    await expect(pawnItem).toBeVisible();
    await pawnItem.click();

    // Place it at 6,4
    const pawnPlaceCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnPlaceCell.click();

    // Verify pawn is rendered (contains svg)
    await expect(pawnPlaceCell.locator('.piece-svg')).toBeVisible();

    // Click "Fertig" to start game (White finishes setup)
    const doneButton = page.locator('#finish-setup-btn');
    await expect(doneButton).toBeVisible();
    await doneButton.click();

    // Handle "Unused Points" modal if present
    const modalConfirm = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    if (await modalConfirm.isVisible()) {
      await modalConfirm.click();
    }

    // NOW: Phase switches to SETUP_BLACK_PIECES (AI's turn)
    // We must wait for AI to finish placing pieces and game to start.
    // The game status will eventually show "Spiel läuft"

    const statusDisplay = page.locator('#status-display');

    // Expect "Weiß am Zug" part of "Spiel läuft - Weiß am Zug"
    await expect(statusDisplay).toContainText(/Weiß am Zug/i, { timeout: 15000 });

    // 7. Make a Move (White King or Pawn)
    // Select King at 7,4
    await whiteKingCell.click();

    // Checking for valid moves might be tricky if pieces are blocking?
    // King is at 7,4. Valid moves should exist unless surrounded.
    // White Pawn is at 6,4.

    // Let's select the Pawn at 6,4 instead, it definitely has forward moves
    const pawnCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnCell.click();

    // Check for valid moves
    const validMove = page.locator('.cell.valid-move').first();
    await expect(validMove).toBeVisible();

    // Execute move
    await validMove.click();

    // 8. Verify Turn Switch
    // Should now be Black's turn
    await expect(statusDisplay).toContainText(/Schwarz am Zug/i);
  });
});
