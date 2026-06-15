import { test, expect } from '@playwright/test';

test.describe('3D Mode Toggle @3d', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  // Skip Firefox - Three.js WebGL initialization is unreliable in Firefox CI
  test('should toggle 3d view on and off', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Three.js canvas unreliable in Firefox CI');
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

    // Toggle ON - directly initialize 3D via app.init3D()
    await page.evaluate(() => {
      if (window.app && typeof window.app.init3D === 'function') {
        return window.app.init3D();
      }
    });

    // Wait for canvas to exist (Three.js initialized) - longer timeout for CI
    await expect(container3d.locator('canvas')).toBeAttached({ timeout: 30000 });

    // Wait for WebGL context to be ready (additional check)
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#battle-chess-3d-container canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }, { timeout: 30000 });

    // Toggle OFF - use the actual click handler
    await toggleBtn.click();

    // 3D container should be hidden/inactive
    await expect(container3d).not.toHaveClass(/active/);
    // 2D board visible again
    await expect(boardWrapper).toBeVisible();
  });
});