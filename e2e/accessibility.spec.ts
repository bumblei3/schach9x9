import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Axe-Scans der Hauptzustände.
 *
 * Früher stand hier ein `disableRules`-Block für `landmark-unique`,
 * `page-has-heading-one`, `landmark-no-duplicate-main` und
 * `scrollable-region-focusable` — der überdeckte die Verstöße, statt sie zu
 * beheben. Alle vier sind seitdem im Code gefixt (Menü `visibility:hidden`
 * statt nur `opacity:0`, `.sr-only`-H1 innerhalb der main-Region, h2/h3 statt
 * h1→h3). Die Liste ist bewusst weg: ein Rückfall muss auch hier rot werden,
 * nicht nur in `e2e/a11y.spec.ts`.
 */

test.describe('Accessibility Scans @a11y', () => {
  test('Main Menu should be accessible', async ({ page }) => {
    await page.goto('/');

    // Wait for menu to be visible
    await expect(page.locator('#main-menu')).toBeVisible();

    // Scan
    const accessibilityScanResults = await new AxeBuilder({ page }).include('#main-menu').analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Game Board (Initial State) should be accessible', async ({ page }) => {
    await page.goto('/');

    // Start Game (Standard)
    await page.click('.gamemode-card[data-mode="standard8x8"]', { force: true });
    await page
      .locator('#modal-actions')
      .getByRole('button', { name: 'Sofort spielen', exact: true })
      .click();

    // Wait for board
    await expect(page.locator('#board-container')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('#battle-chess-3d-container') // Exclude WebGL canvas
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Shop Panel should be accessible', async ({ page }) => {
    await page.goto('/');

    // Start Shop Game
    await page.click('.gamemode-card[data-mode="setup"]');

    // Wait for Shop
    await expect(page.locator('#shop-panel')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#shop-panel')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Settings Menu should be accessible', async ({ page }) => {
    await page.goto('/');

    // Open Menu from Game (simulate if needed, or just check main menu settings tab)
    // Actually, Main Menu has a settings tab.
    const settingsTab = page.locator('.menu-tab-btn[data-tab="settings"]');
    await settingsTab.click();

    // Wait for settings content to become visible
    await expect(page.locator('#view-settings')).toBeVisible({ timeout: 5000 });

    const accessibilityScanResults = await new AxeBuilder({ page }).include('#main-menu').analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
