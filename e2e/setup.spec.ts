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
    const hiringCard = page.locator('.gamemode-card', { hasText: 'Truppen anheuern' });
    await expect(hiringCard).toBeVisible();
    await hiringCard.click();

    // Wait for Board & Setup Mode
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // Verify the status indicates king placement phase
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/König|King/i, { timeout: 5000 });
  });

  test('should place white king in valid corridor', async ({ page }) => {
    // Select Hiring Mode
    await page.click('.gamemode-card:has-text("Truppen anheuern")');
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // The valid corridor cells should be highlighted
    const corridorCell = page.locator('.cell.selectable-corridor').first();
    await expect(corridorCell).toBeVisible();

    // Place White King (Row 7, Col 4) - center of bottom middle corridor
    // Note: Coordinates depend on board size, assuming 9x9 standard coordinates
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await expect(whiteKingCell).toBeVisible();
    await whiteKingCell.click();

    // The cell should now contain a king piece
    await expect(whiteKingCell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });

    // Phase should transition - AI places black king, then shop appears
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });
  });

  test('should show shop panel with 25 points after kings are placed', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern")');

    // Place White King
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await whiteKingCell.click();

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
    await page.click('.gamemode-card:has-text("Truppen anheuern")');

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    // Wait for Phase change
    // Wait for Phase change
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible();

    // Click Pawn in shop (Cost 1)
    const pawnItem = page.locator('.shop-item[data-piece="p"]');
    await expect(pawnItem).toBeVisible();
    await pawnItem.click();

    // Selected piece display should update
    const selectedDisplay = page.locator('#selected-piece-display');
    await expect(selectedDisplay).toContainText(/Bauer|Pawn/i);

    // Place pawn at 6,4 (in the white corridor)
    const pawnPlaceCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnPlaceCell.click();

    // Verify pawn is rendered
    await expect(pawnPlaceCell.locator('.piece-svg')).toBeVisible();

    // Points should be deducted: 25 - 1 = 24
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('24');
  });

  test('should prevent placing pieces outside corridor', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern")');

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
    await page.click('.gamemode-card:has-text("Truppen anheuern")');

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

  test('should allow cell clicks in setup mode', async ({ page }) => {
    await page.click('.gamemode-card:has-text("Truppen anheuern")');

    // Click on a valid corridor cell
    const cell = page.locator('.cell[data-r="7"][data-c="4"]');
    await cell.click();

    // At minimum, the king should be placed
    await expect(cell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });
  });
});
