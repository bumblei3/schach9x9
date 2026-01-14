import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Scans @a11y', () => {
  test('Main Menu should be accessible', async ({ page }) => {
    await page.goto('/');

    // Wait for menu to be visible
    await expect(page.locator('#main-menu')).toBeVisible();

    // Scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#main-menu')
      .disableRules([
        'landmark-unique',
        'page-has-heading-one',
        'scrollable-region-focusable',
        'landmark-no-duplicate-main',
      ])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Game Board (Initial State) should be accessible', async ({ page }) => {
    await page.goto('/');

    // Start Game (Standard)
    await page.click('.gamemode-card:has-text("Standard 8x8")');

    // Wait for board
    await expect(page.locator('#board-container')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('#battle-chess-3d-container') // Exclude WebGL canvas
      .disableRules([
        'landmark-unique',
        'page-has-heading-one',
        'scrollable-region-focusable',
        'landmark-no-duplicate-main',
      ])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Shop Panel should be accessible', async ({ page }) => {
    await page.goto('/');

    // Start Shop Game
    await page.click('.gamemode-card:has-text("Truppen anheuern (9x9)")');

    // Wait for Shop
    await expect(page.locator('#shop-panel')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#shop-panel')
      .disableRules([
        'landmark-unique',
        'page-has-heading-one',
        'scrollable-region-focusable',
        'landmark-no-duplicate-main',
      ])
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

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#main-menu')
      .disableRules([
        'landmark-unique',
        'page-has-heading-one',
        'scrollable-region-focusable',
        'landmark-no-duplicate-main',
        'color-contrast',
        'label',
        'select-name',
        'nested-interactive',
      ])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
