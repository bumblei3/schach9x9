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

  test('should start the first campaign level "Der Aufstand"', async ({ page }) => {
    // 1. Open Campaign Menu
    await page.click('.gamemode-card:has-text("Kampagne")');

    // 2. Select first level
    const firstLevelBtn = page.locator('.campaign-level-card').first();
    await expect(firstLevelBtn).toBeVisible();
    await firstLevelBtn.click();

    // 3. Verify Game Board loads
    await expect(page.locator('#board')).toBeVisible();

    // 5. Verify Campaign UI elements (Budget/Gold should NOT be visible for fixed setup, but maybe generic UI)
    // Check if opponent name is displayed
    await expect(page.locator('#opponent-name')).toContainText('Bauernführer Hans');
  });

  test('should win a campaign level and receive rewards (XP & Gold)', async ({ page }) => {
    // 1. Go through UI

    // Go through UI
    await page.click('.gamemode-card:has-text("Kampagne")');
    await page.locator('.campaign-level-card').first().click();
    await expect(page.locator('#board')).toBeVisible();

    // 2. Mock a Win State
    await page.waitForFunction(() => (window as any).game !== undefined);

    await page.evaluate(() => {
      const game = (window as any).game;
      if (!game) throw new Error('Game not found');
      const controller = (window as any).gameController;

      // Force conditions for win processing
      game.campaignMode = true;
      game.currentLevelId = 'peasant_revolt';
      game.playerColor = 'white';
      // Mock stats
      game.stats.totalMoves = 10;

      // Trigger win handler directly
      controller.handleGameEnd('win', 'white');
    });

    // 3. Check for Rewards via Toast Notifications (Check immediately as they expire)
    const toast = page.locator('.toast-notification.toast-success');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });

    // 4. Verify Victory Modal (Appears after delay)
    const victoryModal = page.locator('#generic-modal');
    await expect(victoryModal).toBeVisible({ timeout: 15000 }); // Increase timeout for analysis
    await expect(page.locator('#modal-title')).toHaveText('Sieg!');

    // 5. Verify Persistence (Gold increased)
    // We get the stored state
    const gold = await page.evaluate(() => {
      const state = localStorage.getItem('schach_campaign_state');
      if (!state) return 0;
      return JSON.parse(state).gold;
    });

    expect(gold).toBeGreaterThan(0);
  });
});
