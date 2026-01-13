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

  test('3D View Static Snapshot', async ({ page, browserName }) => {
    // Skip 3D tests as they are consistently flaky in headless environments due to WebGL context issues
    test.skip(true, 'Skipping 3D visual test due to headless WebGL inconsistencies');

    if (browserName === 'firefox' && process.env.CI) {
      test.skip(true, 'Skip 3D tests in Firefox CI due to WebGL issues');
    }

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
});
