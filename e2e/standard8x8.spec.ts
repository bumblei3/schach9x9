import { test, expect } from '@playwright/test';
import { chooseMenuAction } from './helpers/E2EHelper.js';

test.describe('Standard 8x8 Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).app !== undefined);
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  test('asks whether to play at once or spend 15 points', async ({ page }) => {
    await page.locator('.gamemode-card[data-mode="standard8x8"]').click({ force: true });
    await expect(
      page.locator('#modal-actions').getByRole('button', { name: 'Sofort spielen', exact: true })
    ).toBeVisible();
    await expect(
      page
        .locator('#modal-actions')
        .getByRole('button', { name: 'Mit 15 Punkten verbessern', exact: true })
    ).toBeVisible();
    await chooseMenuAction(page, 'Zurück');
    await expect(page.locator('#main-menu')).toHaveClass(/active/);
    await expect(page.locator('.gamemode-card[data-init-mode="upgrade8x8"]')).toHaveCount(0);
  });

  test('should start standard 8x8 chess', async ({ page }) => {
    const standardCard = page.locator('.gamemode-card[data-mode="standard8x8"]');
    await expect(standardCard).toBeVisible();
    await expect(standardCard.locator('.card-desc')).toContainText('Klassisches Schach');

    await standardCard.click({ force: true });
    await chooseMenuAction(page, 'Sofort spielen');

    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).not.toHaveClass(/active/);
    await expect(mainMenu).toHaveCSS('pointer-events', 'none');

    // Check 8x8 grid
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(64); // 8x8

    // Check board setup
    // White King at 7,4 (standard chess e1 is 7,4 index)
    await expect(page.locator('.cell[data-r="7"][data-c="4"]')).toHaveAttribute('data-piece', 'k');
    // Black king on e8
    await expect(page.locator('.cell[data-r="0"][data-c="4"]')).toHaveAttribute('data-piece', 'k');
  });

  test('should start 8x8 with upgrades if configured', async ({ page }) => {
    // Logic for 8x8 with points might be triggered differently, e.g. a different card
    // or button. If not exposed in UI yet, we can simulate via console.

    await page.evaluate(async () => {
      // @ts-ignore
      await window.app.init(5, 'standard8x8');
    });

    const mainMenu = page.locator('#main-menu');
    await expect(page.locator('body')).toHaveClass(/game-initialized/);
    await expect(mainMenu).not.toHaveClass(/active/);
    await expect(mainMenu).toHaveCSS('pointer-events', 'none');

    // Should be in Setup Phase (Upgrades)
    // Check for Shop Panel
    await expect(page.locator('#shop-panel')).toBeVisible();

    // Points display should show 5
    await expect(page.locator('#points-display')).toContainText('5');
  });
});
