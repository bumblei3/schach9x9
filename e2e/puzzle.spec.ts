import { test, expect } from '@playwright/test';

test.describe('Puzzle Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  test('should open puzzle mode', async ({ page }) => {
    const puzzleCard = page.locator('.gamemode-card').filter({ hasText: 'Puzzle-Modus' });
    await expect(puzzleCard).toBeVisible();
    await puzzleCard.click();

    // Should show Puzzle Menu Overlay
    await expect(page.locator('#puzzle-menu-overlay')).toBeVisible();

    // Should have puzzle cards
    const puzzleCards = page.locator('.puzzle-card');
    await expect(puzzleCards).not.toHaveCount(0);
  });

  test('should load a puzzle', async ({ page }) => {
    // Wait for app to be ready
    await page.waitForFunction(() => (window as any).app !== undefined);

    await page.evaluate(() => {
      // @ts-ignore
      window.app.init(0, 'puzzle');
    });

    // Click first puzzle
    await page.locator('.puzzle-card').first().click();

    // Puzzle overlay should hide, board visible
    await expect(page.locator('#puzzle-menu-overlay')).toBeHidden();

    // Check for "Puzzle Modus" indicator or similar status
    // usually status text updates
    await expect(page.locator('#status-display')).not.toBeEmpty();
  });
});
