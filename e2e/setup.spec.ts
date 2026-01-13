import { test, expect } from '@playwright/test';

test.describe('Setup Phase Tests @setup', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    page.on('pageerror', err => console.error(`PAGE ERROR: ${err.message}`));

    // Disable AI Mentor to avoid blunder warning modals
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });

    // Go to home
    await page.goto('/?disable-sw');

    // Wait for App Initialization
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    // Wait for Main Menu
    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).toBeVisible();
  });

  test('should display setup mode after selecting "Truppen anheuern" (25 points)', async ({
    page,
  }) => {
    // Click "Truppen anheuern" logic
    // We target the card with specific text or class
    const hiringCard = page.locator('.gamemode-card', { hasText: 'Truppen anheuern (9x9)' });
    await expect(hiringCard).toBeVisible();
    await hiringCard.click();
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // Wait for Board & Setup Mode
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // Verify the status indicates king placement OR upgrade phase (if mode skips king placement)
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toHaveText(/König|King|Upgrades|Truppen/i, { timeout: 5000 });
  });

  test('should place white king in valid corridor', async ({ page }) => {
    // If in Upgrade mode, this test might be irrelevant or needs adaptation.
    // Check if we are in upgrade mode (status text)
    const statusText = await page.locator('#status-display').textContent();
    if (statusText && statusText.includes('Upgrades')) {
      test.skip(true, 'Skipping King placement test for Upgrade Mode (Kings are pre-placed)');
      return;
    }
    // Select Hiring Mode
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // The valid corridor cells should be highlighted
    const corridorCell = page.locator('.cell.selectable-corridor').first();
    await expect(corridorCell).toBeVisible();

    // Place White King (Row 7, Col 4) - center of bottom middle corridor
    // Note: Coordinates depend on board size, assuming 9x9 standard coordinates
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await page.evaluate(() => {
      const cell = document.querySelector('.cell[data-r="7"][data-c="4"]');
      if (cell) (cell as HTMLElement).click();
    });

    // The cell should now contain a king piece
    await expect(whiteKingCell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });

    // Phase should transition - AI places black king, then shop appears
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });
  });

  test('should show shop panel with 25 points after kings are placed', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for Shop Panel (means both Kings are placed)
    // Wait for Phase change (means both Kings are placed)
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible();

    // Verify points display - Should be 25 now
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('25');
  });

  test('should allow purchasing and placing pieces', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    // Click Pawn in shop (Cost 1)
    const pawnItem = page.locator('.shop-item[data-piece="p"]');
    await expect(pawnItem).toBeVisible();
    await pawnItem.click();

    // Place pawn at 6,4 (in the white corridor)
    const pawnPlaceCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnPlaceCell.click();

    // Verify pawn is rendered
    await expect(pawnPlaceCell.locator('.piece-svg')).toBeVisible();

    // Points should be deducted: 25 - 1 = 24
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('24');
  });

  test('should allow purchasing and placing Nightrider (🦄)', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    await expect(page.locator('#status-display')).toContainText(/Weiß: Kaufe Truppen/i, {
      timeout: 10000,
    });

    // Verify Nightrider ('j') button is present and clickable
    const nightriderItem = page.locator('.shop-item[data-piece="j"]');
    await expect(nightriderItem).toBeVisible();
    await nightriderItem.click();

    // Selected piece display should update
    const selectedDisplay = page.locator('#selected-piece-display');
    await expect(selectedDisplay).toContainText(/Nachtreiter/i);

    // Place Nightrider at 6,3 (in the white corridor)
    const nrPlaceCell = page.locator('.cell[data-r="6"][data-c="3"]');
    await nrPlaceCell.click();

    // Verify Nightrider is rendered
    await expect(nrPlaceCell.locator('.piece-svg')).toBeVisible();

    // Points should be deducted: 25 - 6 = 19
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('19');
  });

  test('should prevent placing pieces outside corridor', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');

    // Place White King (center corridor)
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    // Wait for Phase change
    // Wait for Phase change
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    // Select pawn
    await page.click('.shop-item[data-piece="p"]');

    // Try to place outside the white corridor (e.g., row 4, which is in the middle and invalid)
    const invalidCell = page.locator('.cell[data-r="4"][data-c="4"]');
    await invalidCell.click();

    // Cell should NOT contain a piece (placement should fail)
    await expect(invalidCell.locator('.piece-svg')).not.toBeVisible();

    // Points should still be 25 (no deduction)
    await expect(page.locator('#points-display')).toHaveText('25');
  });

  test('should complete setup and start game', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    // Wait for Phase change
    // Wait for Phase change
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    // Buy and place some pieces
    await page.click('.shop-item[data-piece="p"]');
    await page.click('.cell[data-r="6"][data-c="4"]');

    await page.click('.shop-item[data-piece="n"]');
    await page.click('.cell[data-r="6"][data-c="3"]');

    // Click "Fertig" (Pieces Phase)
    const doneButton = page.locator('#finish-setup-btn');
    await expect(doneButton).toBeVisible();
    await doneButton.click();

    // Handle "Unused Points" modal (Pieces Phase)
    const modalConfirm = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // Now enters Upgrade Phase (implicitly)

    // Click "Fertig" (Upgrade Phase)
    await doneButton.click();

    // Handle "Unused Points" modal AGAIN (Upgrade Phase)
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // Wait for AI to finish setup and game to start
    const finalStatusDisplay = page.locator('#status-display');
    await expect(finalStatusDisplay).toContainText(/Weiß am Zug/i, { timeout: 20000 });

    // Setup mode class should be removed
    await expect(page.locator('body')).not.toHaveClass(/setup-mode/);
  });

  test('should allow player to make moves after setup completes', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // Place White King in center corridor
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop to appear
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    // Buy and place a pawn
    await page.click('.shop-item[data-piece="p"]');
    await page.click('.cell[data-r="6"][data-c="4"]');

    // Finish pieces phase
    const doneButton = page.locator('#finish-setup-btn');
    await doneButton.click();

    // Handle modal
    const modalConfirm = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // Finish upgrades phase
    await doneButton.click();
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // Wait for game to start
    await expect(statusDisplay).toContainText(/Weiß am Zug/i, { timeout: 20000 });

    // CRITICAL TEST: Click on a white pawn to select it
    const pawnCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnCell.click();

    // Verify valid moves are highlighted (pawn can move forward)
    const targetCell = page.locator('.cell[data-r="5"][data-c="4"]');
    await expect(targetCell).toHaveClass(/valid-move/, { timeout: 5000 });

    // Execute the move
    await targetCell.click();

    // Verify the move was executed - pawn should now be at the new position
    await expect(targetCell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });

    // Verify the original cell is now empty (no piece)
    await expect(pawnCell.locator('.piece-svg')).not.toBeVisible();

    // After white's move, it's black's turn (AI).
    // The AI might already have made its move, so we just verify the game continues.
    // Wait for the AI to potentially make a move (it takes ~1-2 seconds)
    await page.waitForTimeout(2000);

    // The game should still be running (not frozen)
    await expect(page.locator('#board')).toBeVisible();
  });

  test('should allow cell clicks in setup mode', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');

    // Click on a valid corridor cell
    const cell = page.locator('.cell[data-r="7"][data-c="4"]');
    await cell.click();

    // At minimum, the king should be placed
    await expect(cell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });
  });

  test('AI should place pieces after white finishes setup (full flow)', async ({ page }) => {
    // This test verifies the complete setup flow including AI piece placement
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // 1. Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // 2. Wait for AI to place Black King (should happen automatically)
    // The black king should appear in the top area (row 0-2, center column)
    const blackKingCell = page.locator('.cell[data-r="1"] .piece-svg').first();
    await expect(blackKingCell).toBeVisible({ timeout: 10000 });

    // 3. Shop should appear for white to buy pieces
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    // 4. Buy and place some white pieces
    await page.click('.shop-item[data-piece="p"]');
    await page.click('.cell[data-r="6"][data-c="4"]');
    await page.click('.shop-item[data-piece="p"]');
    await page.click('.cell[data-r="6"][data-c="3"]');

    // 5. Finish white pieces phase
    const doneButton = page.locator('#finish-setup-btn');
    await doneButton.click();

    // Handle modal if it appears
    const modalConfirm = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // Finish upgrades phase
    await doneButton.click();
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // 6. Wait for AI to finish its setup (buying + placing black pieces)
    // This should result in "Weiß am Zug" status and black pieces on the board
    await expect(statusDisplay).toContainText(/Weiß am Zug/i, { timeout: 30000 });

    // 7. CRITICAL: Verify black has pieces on the board (not just the king)
    // Count black pieces - should be more than just the king
    // Note: BoardRenderer uses data-color attribute for piece color
    const blackPieceCells = page.locator('.cell[data-color="black"]');
    const blackPieceCount = await blackPieceCells.count();

    // Black should have at least 2 pieces (king + at least one purchased piece)
    expect(blackPieceCount).toBeGreaterThanOrEqual(2);
  });
});
