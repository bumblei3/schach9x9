import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Campaign Mode', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('should open campaign menu and display levels', async ({ page }) => {
    // Click campaign card
    const card = page.locator('.gamemode-card').filter({ hasText: 'Kampagne' });
    await expect(card).toBeVisible();
    await card.click();

    // Verify Campaign Overlay
    const overlay = page.locator('#campaign-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Verify Levels are listed
    const levelCards = page.locator('.campaign-level-card');
    await expect(levelCards).not.toHaveCount(0);
  });
});
