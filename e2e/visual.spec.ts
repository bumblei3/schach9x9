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
    // Standard Desktop Chrome viewport is 1280x720
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Main Board - Initial State', async ({ page }) => {
    // Take a screenshot of the initial board state
    await expect(page).toHaveScreenshot('main-board-initial.png', {
      mask: [page.locator('#status-display')], // Mask dynamic status
      animations: 'disabled',
    });
  });

  test('Shop Panel - 15 Points', async ({ page }) => {
    // Points selection overlay is shown initially.
    const pointsBtn = page.locator('button.points-btn[data-points="15"]');
    await expect(pointsBtn).toBeVisible();
    await pointsBtn.click();

    // Wait for overlay to disappear
    const overlay = page.locator('#points-selection-overlay');
    await expect(overlay).toBeHidden({ timeout: 10000 });

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

    // Wait for points to be 15
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('15');

    await expect(shop).toHaveScreenshot('shop-panel-15-points.png');
  });

  test('Menu Overlay', async ({ page }) => {
    // First get past the points overlay
    await page.click('button.points-btn[data-points="15"]');
    await page.click('#menu-btn');
    const menu = page.locator('#menu-overlay');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveScreenshot('menu-overlay.png');
  });

  test('3D View Static Snapshot', async ({ page }) => {
    await page.click('button.points-btn[data-points="15"]');

    // Wait for full game initialization before toggling 3D
    await page.waitForFunction(() => document.body.classList.contains('game-initialized'));

    await page.click('#toggle-3d-btn');
    const container = page.locator('#battle-chess-3d-container');

    // Wait for the active class to be applied and the container to be visible
    await expect(container).toHaveClass(/active/);
    await expect(container).toBeVisible();

    // Ensure Three.js has initialized (check for canvas)
    await expect(container.locator('canvas')).toBeVisible({ timeout: 10000 });

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
