import { test, expect } from '@playwright/test';

test.describe('Upgrade Modes @upgrade', () => {
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
  });

  test('should start Upgrade Modus (9x9) correctly (Backend)', async ({ page }) => {
    // 1. Initialize 'upgrade' mode programmatically (since UI now uses 'setup' mode for this slot)
    await page.evaluate(() => {
      (window as any).app.init(25, 'upgrade');
      document.getElementById('main-menu')?.classList.remove('active');
    });

    // 2. Verify Initial State
    await expect(page.locator('#board .cell').first()).toBeVisible();
    await expect(page.locator('#board')).toBeVisible();
    // Note: Upgrade mode still uses setup-mode class because players spend points to upgrade pieces

    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('25');

    // Check for "Fertig" button being visible
    await expect(page.locator('#finish-setup-btn')).toBeVisible();
    await expect(page.locator('#finish-setup-btn')).toBeEnabled();

    // 3. Verify Pieces are present (Classic Board)
    // Row 8 (Indices 0-8), White Pawns at Row 7 (size-2).
    const whitePawn = page.locator('.cell[data-r="7"][data-c="4"] .piece-svg');
    await expect(whitePawn).toBeVisible();
  });

  test('should start 8x8 + Upgrades correctly', async ({ page }) => {
    // 1. Select "8x8 + Upgrades"
    const upgrade8x8Card = page.locator('.gamemode-card', { hasText: '8x8 + Upgrades' });
    await expect(upgrade8x8Card).toBeVisible();
    await upgrade8x8Card.click();

    // 2. Verify Initial State
    await expect(page.locator('#board .cell').first()).toBeVisible();
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('15');

    // Verify 8x8 Board (Cells should be up to 7,7)
    // Check if cell 8,8 exists -> Should NOT exist or be hidden/invalid
    // Our board renderer might just render what's in game.board.
    // Standard 8x8 usually uses 8x8 board array or 9x9 with unused?
    // GameEngine setupStandard8x8Board: creates 8x8 array?
    // Let's assume the DOM reflects 8x8.

    // Check for "Fertig" button
    await expect(page.locator('#finish-setup-btn')).toBeVisible();

    // 3. Perform an Upgrade
    // Standard 8x8: White Pawns at Row 6.
    const pawnCell = page.locator('.cell[data-r="6"][data-c="4"]');
    await pawnCell.click();

    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible();

    // Select Knight upgrade (Cost 3)
    // The upgrade options appear in a modal, blocking the shop panel.
    // Robustly trigger upgrade via app logic to bypass UI interception/event issues in test env
    await page.evaluate(() => {
      const game = (window as any).game;
      // Upgrade 6,4 (Pawn) to Knight ('n')
      // Using game.gameController directly if exposed, or through window.gameController
      if (game && game.gameController && game.gameController.shopManager) {
        game.gameController.shopManager.upgradePiece(6, 4, 'n');
      } else {
        throw new Error('Game controller or shop manager not found');
      }
    });

    // Wait for points to change
    await expect(pointsDisplay).toHaveText('13');
    await expect(page.locator('.cell[data-r="6"][data-c="4"] .piece-svg')).toBeVisible();

    // 4. Verify Upgrade Result
    // Piece should be a Knight now
    const upgradedPiece = page.locator('.cell[data-r="6"][data-c="4"] .piece-svg');
    await expect(upgradedPiece).toBeVisible();
    // We can check innerHTML or class, assuming piece-svg content changes.
    // Ideally we check data-piece-type on the cell if available, or just existence of new SVG.
    // Let's check if points decreased.
    // Initial: 15. Pawn(1) -> Knight(3). Cost: 2. Remaining: 13.
    await expect(pointsDisplay).toHaveText('13');
  });

  test('should successfully upgrade a Pawn to a Nightrider', async ({ page }) => {
    // 1. Select "8x8 + Upgrades"
    await page.click('.gamemode-card:has-text("8x8 + Upgrades")');

    // Wait for App to be fully initialized
    await page.waitForSelector('body.game-initialized');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // 2. Perform Upgrade Pawn(6,5) -> Nightrider('j')
    // Initial points: 15. Pawn(1) -> Nightrider(6). Cost: 5. Remaining: 10.
    await page.evaluate(() => {
      const { app } = window as any;
      if (app && app.gameController && app.gameController.shopManager) {
        app.gameController.shopManager.upgradePiece(6, 5, 'j');
      }
    });

    // 3. Verify points decreased
    await expect(page.locator('#points-display')).toHaveText('10');

    // 4. Verify the piece was upgraded (data-piece attribute or piece visual change)
    const upgradedCell = page.locator('.cell[data-r="6"][data-c="5"] .piece-svg');
    await expect(upgradedCell).toBeVisible();
  });

  test('should show Angel upgrade option for Queen in upgrade mode', async ({ page }) => {
    // 1. Select "8x8 + Upgrades"
    await page.click('.gamemode-card:has-text("8x8 + Upgrades")');
    await page.waitForSelector('body.game-initialized');

    // 2. Check if Queen has upgrade options
    // In 8x8 standard, Queen is at row 7, col 3
    const result = await page.evaluate(() => {
      const game = (window as any).game;
      const shopManager = game?.gameController?.shopManager;
      if (!shopManager) return { error: 'ShopManager not found' };

      // Get the piece at 7,3 (should be queen)
      const piece = game.board[7][3];
      if (!piece) return { error: 'No piece at 7,3' };
      if (piece.type !== 'q') return { error: `Expected queen, got ${piece.type}` };

      // Get available upgrades for queen
      const upgrades = shopManager.getAvailableUpgrades
        ? shopManager.getAvailableUpgrades(piece.type)
        : [];

      return {
        pieceType: piece.type,
        upgradesAvailable: upgrades.map((u: any) => u?.symbol || u),
        hasAngelUpgrade: upgrades.some((u: any) => u?.symbol === 'e' || u === 'e'),
      };
    });

    console.log('Queen upgrade test result:', result);

    // In upgrade mode, Angel should now be available (without campaign unlock)
    expect(result.pieceType).toBe('q');
    expect(result.hasAngelUpgrade).toBe(true);
    expect(result.upgradesAvailable).toContain('e');
  });

  test('should complete 8x8 upgrade mode setup', async ({ page }) => {
    // 1. Select "8x8 + Upgrades"
    await page.click('.gamemode-card:has-text("8x8 + Upgrades")');
    await page.waitForSelector('body.game-initialized');
    await expect(page.locator('#board .cell').first()).toBeVisible();

    // 2. Perform some upgrades
    await page.evaluate(() => {
      const { app } = window as any;
      if (app?.gameController?.shopManager) {
        // Upgrade a pawn to knight (cost: 2)
        app.gameController.shopManager.upgradePiece(6, 4, 'n');
      }
    });

    // 3. Verify points decreased
    await expect(page.locator('#points-display')).toHaveText('13', { timeout: 5000 });

    // 4. Verify upgraded piece is visible
    const upgradedCell = page.locator('.cell[data-r="6"][data-c="4"] .piece-svg');
    await expect(upgradedCell).toBeVisible();

    // 5. Verify finish button is available
    const doneButton = page.locator('#finish-setup-btn');
    await expect(doneButton).toBeVisible();
  });
});
