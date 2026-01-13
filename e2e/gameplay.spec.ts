import { test, expect } from '@playwright/test';

test.describe('Core Gameplay Loop', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    // Disable AI Mentor to avoid blunder warning modals
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });

    // Go to home
    await page.goto('/?disable-sw');

    // Wait for App Initialization
    await page.waitForFunction(
      () => document.body.classList.contains('app-ready') && (window as any).app !== undefined
    );
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  test('should start a game and execute a move', async ({ page }) => {
    // 1. Select Hiring Mode (25 Points)
    const hiringCard = page.locator('.gamemode-card', { hasText: 'Truppen anheuern (9x9)' });
    await hiringCard.click();

    // 2. Wait for Board & Setup Mode
    await expect(page.locator('#board')).toBeVisible();
    const mainMenu = page.locator('#main-menu');
    await expect(page.locator('body')).toHaveClass(/game-initialized/);
    await expect(mainMenu).not.toHaveClass(/active/);
    await expect(mainMenu).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // 3. Place White King
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await whiteKingCell.click();

    // 4. Wait for Phase Change & Shop
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 });
    const setupStatusDisplay = page.locator('#status-display');
    await expect(setupStatusDisplay).toContainText(/Weiß: Kaufe Truppen/i, { timeout: 10000 });

    // 5. Buy a Pawn
    const pawnItem = page.locator('.shop-item[data-piece="p"]');
    await expect(pawnItem).toBeVisible();
    await pawnItem.click();

    // Place it at 6,4
    const pawnPlaceCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnPlaceCell.click();

    // Verify pawn is rendered
    await expect(pawnPlaceCell.locator('.piece-svg')).toBeVisible();

    // 6. Finish Setup (Pieces Phase)
    const doneButton = page.locator('#finish-setup-btn');
    await expect(doneButton).toBeVisible();
    await doneButton.click();

    // Handle "Unused Points" modal (Pieces Phase)
    const modalConfirm = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // Skip Upgrade Phase
    await doneButton.click();

    // Handle "Unused Points" modal AGAIN (Upgrade Phase)
    if (await modalConfirm.isVisible({ timeout: 2000 })) {
      await modalConfirm.click();
    }

    // 7. Wait for Game Start (White's Turn)
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toContainText(/Weiß am Zug/i, { timeout: 15000 });

    // 8. Make a Move (White Pawn at 6,4)
    const pawnCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnCell.click();

    // Check for valid moves
    const validMove = page.locator('.cell.valid-move').first();
    await expect(validMove).toBeVisible();

    // Execute move
    await validMove.click();

    // 9. Verify Turn Switch
    await expect(statusDisplay).toContainText(/Schwarz am Zug/i);
  });
});
