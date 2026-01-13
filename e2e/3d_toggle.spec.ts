import { test, expect } from '@playwright/test';

test.describe('3D Mode Toggle @3d', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  test('should toggle 3d view on and off', async ({ page }) => {
    // 3D toggle is available in the action bar.
    // Start a game first (Standard 8x8) to ensure action bar is active
    await page.click('.gamemode-card:has-text("Standard 8x8")');

    // Wait for board to be ready
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/game-initialized/);

    const toggleBtn = page.locator('#toggle-3d-btn');

    const container3d = page.locator('#battle-chess-3d-container');
    const boardWrapper = page.locator('#board-wrapper');

    // Initial state: 3D hidden, 2D visible
    await expect(container3d).not.toHaveClass(/active/);
    await expect(boardWrapper).toBeVisible();

    // Toggle ON
    await toggleBtn.click();

    // 3D container should become active/visible
    await expect(container3d).toHaveClass(/active/);

    // 2D board usually gets hidden or z-indexed.
    // In style.css: .game-area.3d-active #board-wrapper { opacity: 0; pointer-events: none; }
    // Let's check for class on game-area or container visibility.
    // Actually, checking if container3d is visible is good.
    await expect(container3d).toBeVisible();

    // Wait for canvas to exist (Three.js initialized)
    await expect(container3d.locator('canvas')).toBeAttached({ timeout: 10000 });

    // Toggle OFF
    await toggleBtn.click();

    // 3D container should be hidden/inactive
    await expect(container3d).not.toHaveClass(/active/);
    // 2D board visible again
    await expect(boardWrapper).toBeVisible();
  });
});
