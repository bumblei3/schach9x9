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

    // Wait for usage overlay
    await expect(page.locator('#points-selection-overlay')).toBeVisible();

    // Wait for app-ready (listeners attached)
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  test('should display setup mode after selecting 15 points', async ({ page }) => {
    // Select 15 Points
    await page.click('button[data-points="15"]');

    // Wait for Board & Setup Mode
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // Verify the status indicates king placement phase
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/König|King/i, { timeout: 5000 });
  });

  test('should place white king in valid corridor', async ({ page }) => {
    await page.click('button[data-points="15"]');
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // The valid corridor cells should be highlighted
    const corridorCell = page.locator('.cell.selectable-corridor').first();
    await expect(corridorCell).toBeVisible();

    // Place White King (Row 7, Col 4) - center of bottom middle corridor
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await expect(whiteKingCell).toBeVisible();
    await whiteKingCell.click();

    // The cell should now contain a king piece
    await expect(whiteKingCell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });

    // Phase should transition - AI places black king, then shop appears
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });
  });

  test('should show shop panel after kings are placed', async ({ page }) => {
    await page.click('button[data-points="15"]');

    // Place White King
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await whiteKingCell.click();

    // Wait for Shop Panel (means both Kings are placed)
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });
    await expect(shopPanel).not.toHaveClass(/hidden/);

    // Verify points display
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('15');
  });

  test('should allow purchasing and placing pieces', async ({ page }) => {
    await page.click('button[data-points="15"]');

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });

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

    // Points should be deducted
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('14');
  });

  test('should prevent placing pieces outside corridor', async ({ page }) => {
    await page.click('button[data-points="15"]');

    // Place White King (center corridor)
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    await expect(page.locator('#shop-panel')).toBeVisible({ timeout: 10000 });

    // Select pawn
    await page.click('.shop-item[data-piece="p"]');

    // Try to place outside the white corridor (e.g., row 4, which is in the middle and invalid)
    const invalidCell = page.locator('.cell[data-r="4"][data-c="4"]');
    await invalidCell.click();

    // Cell should NOT contain a piece (placement should fail)
    await expect(invalidCell.locator('.piece-svg')).not.toBeVisible();

    // Points should still be 15 (no deduction)
    await expect(page.locator('#points-display')).toHaveText('15');
  });

  test('should complete setup and start game', async ({ page }) => {
    await page.click('button[data-points="15"]');

    // Place White King
    await page.click('.cell[data-r="7"][data-c="4"]');

    // Wait for shop
    await expect(page.locator('#shop-panel')).toBeVisible({ timeout: 10000 });

    // Buy and place some pieces
    await page.click('.shop-item[data-piece="p"]');
    await page.click('.cell[data-r="6"][data-c="4"]');

    await page.click('.shop-item[data-piece="n"]');
    await page.click('.cell[data-r="6"][data-c="3"]');

    // Click "Fertig" to finish white's setup
    const doneButton = page.locator('#finish-setup-btn');
    await expect(doneButton).toBeVisible();
    await doneButton.click();

    // Handle "Unused Points" modal if present
    const modalConfirm = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    if (await modalConfirm.isVisible()) {
      await modalConfirm.click();
    }

    // Wait for AI to finish setup and game to start
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß am Zug/i, { timeout: 20000 });

    // Setup mode class should be removed
    await expect(page.locator('body')).not.toHaveClass(/setup-mode/);
  });

  test('should allow cell clicks in setup mode', async ({ page }) => {
    await page.click('button[data-points="15"]');

    // Click on a valid corridor cell
    const cell = page.locator('.cell[data-r="7"][data-c="4"]');
    await cell.click();

    // At minimum, the king should be placed
    await expect(cell.locator('.piece-svg')).toBeVisible({ timeout: 5000 });
  });
});
