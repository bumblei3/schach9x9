import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests @visual', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app before each test
        await page.goto('/');
        // Wait for initialize
        await page.waitForSelector('#board');
    });

    test('Main Board - Initial State', async ({ page }) => {
        // Take a screenshot of the initial board state
        await expect(page).toHaveScreenshot('main-board-initial.png', {
            mask: [page.locator('#status-display')], // Mask dynamic status
            animations: 'disabled'
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
        await page.click('#toggle-3d-btn');
        const container = page.locator('#battle-chess-3d-container');
        await expect(container).toBeVisible();
        // Give Three.js time to initialize and render
        await page.waitForTimeout(2000);
        await expect(container).toHaveScreenshot('3d-view-initial.png');
    });
});
