import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests @visual', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    page.on('pageerror', err => console.error(`PAGE ERROR: ${err.message}`));

    await page.goto('/?disable-sw');

    // Wait for initialize
    await page.waitForSelector('#board');

    // Wait for DOMHandler to attach listeners to avoid race condition
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    // Set a fixed viewport size to ensure visual stability and consistent dimensions
    await page.setViewportSize({ width: 1280, height: 720 });

    // Wait for fonts to be ready
    await page.evaluate(() => document.fonts.ready);
  });

  test('Main Board - Initial State', async ({ page }) => {
    // Take a screenshot of the initial board state
    // Note: Main menu might be covering it, but we want to capture the underlying board if possible
    // or capture the main menu itself as the initial state
    await expect(page.locator('#main-menu')).toBeVisible();

    await expect(page).toHaveScreenshot('main-menu-initial.png', {
      mask: [], // No dynamic content on main menu usually
      animations: 'disabled',
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Shop Panel - 25 Points (Hire Mode)', async ({ page }) => {
    // 1. Select Hire Mode
    const hireBtn = page.locator('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    await expect(hireBtn).toBeVisible();
    await hireBtn.click();

    // Wait for main menu to disappear
    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).not.toHaveClass(/active/);

    // --- PHASE: SETUP_WHITE_KING ---
    // Place White King at Row 7, Col 4
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await expect(whiteKingCell).toBeVisible();
    await whiteKingCell.click();

    // --- PHASE: SETUP_BLACK_KING (AI) ---
    // Wait for shop to appear (triggered after black king placement)
    const shop = page.locator('#shop-panel');
    await expect(shop).toBeVisible({ timeout: 10000 });
    await expect(shop).not.toHaveClass(/hidden/, { timeout: 10000 });

    // Wait for points to be 25
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('25');

    await expect(shop).toHaveScreenshot('shop-panel-25-points.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Menu Overlay from Game', async ({ page }) => {
    // Start game first to enable menu button logic
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');

    // Click menu button (the burger menu in header)
    await page.click('#menu-btn');
    const menu = page.locator('#main-menu'); // It re-opens the main menu
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/active/);

    // Check that "Resume" button is visible since we are in a game (even if setup)
    // Note: Resume button logic depends on game phase. Setup might hide it?
    // Let's check the implementation:
    // "if (this.game && this.game.phase !== 'SETUP') { resumeBtn.classList.remove('hidden'); }"
    // So in setup, resume might be hidden.

    await expect(menu).toHaveScreenshot('main-menu-reopened.png', {
      maxDiffPixelRatio: 0.2,
    });
  });

  test('3D View Static Snapshot', async ({ page }) => {
    // Skip 3D tests as they are consistently flaky in headless environments due to WebGL context issues
    test.skip(true, 'Skipping 3D visual test due to headless WebGL inconsistencies');

    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');

    // Wait for full game initialization before toggling 3D (wait for setup mode)
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    await page.click('#toggle-3d-btn');
    const container = page.locator('#battle-chess-3d-container');

    // Wait for the active class to be applied and the container to be visible
    await expect(container).toHaveClass(/active/);
    await expect(container).toBeVisible();

    // Ensure Three.js has initialized (check for canvas)
    await expect(container.locator('canvas')).toBeVisible({ timeout: 20000 });

    // Give Three.js time to render the scene
    await page.waitForTimeout(2000);

    // Use threshold and pixel ratio to handle minor WebGL rendering differences
    await expect(container).toHaveScreenshot('3d-view-initial.png', {
      maxDiffPixelRatio: 0.1, // Allow for some variation in WebGL rendering
      animations: 'disabled',
      scale: 'css', // Ensures dimensions match the baseline
    });
  });
  test('Pawn Promotion Modal', async ({ page }) => {
    test.slow(); // Firefox needs more time

    // Force 2D mode and disable animations for stability
    await page.addInitScript(() => {
      localStorage.setItem('disable_animations', 'true');
      localStorage.setItem('settings_3d_mode', 'false');
    });

    // 1. Enter Hire Mode (Standard 9x9)
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');
    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).not.toHaveClass(/active/);

    // 2. Setup Board for Promotion
    // Place White King (required)
    await page.locator('.cell[data-r="8"][data-c="4"]').click(); // e1 (Row 8)

    // Force Opponent to Human to allow manual placement of Black King
    await page.evaluate(() => {
      // @ts-ignore
      if (window.app && window.app.game) {
        // @ts-ignore
        window.app.game.isAI = false;
        // @ts-ignore
        // Ensure 3D is disabled in runtime if possible
        if (window.app.boardRenderer && window.app.boardRenderer.battleChess3D) {
          // @ts-ignore
          window.app.boardRenderer.battleChess3D.enabled = false;
        }
      }
    });

    // Place Black King (required)
    // Wait for auto-transition to Black King setup?
    // Usually happens immediately after White King.
    // Let's click e9 (Row 0)
    await page.locator('.cell[data-r="0"][data-c="4"]').click();

    // Ensure state is correct and Shop is shown (robustness)
    await page.evaluate(() => {
      // @ts-ignore
      if (window.app.game.phase !== 'SETUP_WHITE_PIECES') {
        console.warn('Phase mismatch, forcing SETUP_WHITE_PIECES');
        // @ts-ignore
        window.app.game.phase = 'SETUP_WHITE_PIECES';
      }
      // @ts-ignore
      window.app.gameController.showShop(true);
    });

    // Wait for Shop (White Pieces setup)
    const shop = page.locator('#shop-panel');
    await expect(shop).toBeVisible();

    // Place White Pawn on Row 1, Col 0 (Close to promotion at Row 0)
    // Buy a Pawn first
    const pawnCard = shop.locator('.shop-item[data-piece="p"]');
    await pawnCard.click();

    // Place it on Row 1, Col 0 (a8?)
    // Note: White promotes at Row 0.
    await page.locator('.cell[data-r="1"][data-c="0"]').click();

    // Force points to 0 AND advance phase to skip remaining setup steps
    await page.evaluate(() => {
      console.log('%c[Test] Forcing game state skip...', 'color:magenta');
      // @ts-ignore
      if (window.app && window.app.game) {
        // @ts-ignore
        window.app.game.points = 0;
        // @ts-ignore
        window.app.game.phase = 'SETUP_BLACK_UPGRADES';
        // @ts-ignore
        window.app.game.isAI = false;
        // @ts-ignore
        window.app.game.turn = 'white'; // Force Turn White (String, not int)

        // Manually place White Pawn at (1,0) for promotion test
        // (1,0) is outside valid setup zone, so we must inject it
        // game.board is 2D array of objects in the main App
        // @ts-ignore
        if (!window.app.game.board[1]) window.app.game.board[1] = [];
        // @ts-ignore
        window.app.game.board[1][0] = { type: 'p', color: 'white', hasMoved: true };

        // @ts-ignore
        window.app.gameController.updateShopUI();
      }
    });

    // Finish Setup
    await page.click('#finish-setup-btn');

    // Fallback: If modal appears despite point hack, click "Fortfahren"
    const modalBtn = page.locator('.modal-content .btn-primary:has-text("Fortfahren")');
    try {
      if (await modalBtn.isVisible({ timeout: 2000 })) {
        console.log('Modal appeared, clicking confirm...');
        await modalBtn.click();
      }
    } catch (e) {
      // Ignore
    }

    // Force clear setup mode if still present
    const isSetup = await page.evaluate(() => document.body.classList.contains('setup-mode'));
    if (isSetup) {
      console.log('Still in setup mode, forcing finish via app...');
      await page.evaluate(() => (window as any).game?.finishSetupPhase());
    }

    // Wait for game start (Play Phase is indicated by removal of setup-mode)
    await expect(page.locator('body')).not.toHaveClass(/setup-mode/);

    // 3. Move Pawn to Promotion programmatically
    await page.evaluate(async () => {
      const game = (window as any).game;
      if (game.handlePlayClick) {
        await game.handlePlayClick(1, 0);
        await game.handlePlayClick(0, 0);
      }
    });

    // 4. Wait for Promotion Modal
    const modal = page.locator('#promotion-overlay');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal).not.toHaveClass(/hidden/);

    // 5. Screenshot
    // Wait for any CSS transitions (even if animations disabled, opacity/display might have delays)
    await page.waitForTimeout(500);
    await expect(modal).toHaveScreenshot('promotion-modal.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
