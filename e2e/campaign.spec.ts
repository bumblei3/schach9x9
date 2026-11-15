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

    await expect(page.locator('#campaign-gold-display')).toBeVisible();
    await page.click('#campaign-army-toggle');
    await expect(page.locator('#campaign-army-view')).toBeVisible();
    await expect(page.locator('#campaign-army-view')).toContainText('Deine Armee');
    await page.click('#campaign-army-back');
    await expect(levelCards.first()).toBeVisible();

    await page.click('#campaign-shop-toggle');
    await expect(page.locator('#campaign-shop-view')).toBeVisible();
    await expect(page.locator('#campaign-shop-view')).toContainText('Söldner-Shop');
    await expect(page.locator('#campaign-shop-view')).toContainText(
      'Zeigt zu Beginn der Mission einmal den besten Zug.'
    );
    await expect(page.locator('#campaign-shop-view')).toContainText(
      'Auf den Anwerbe-Kapiteln 4, 6, 12 und 18 startest du mit +10 Budget.'
    );
    await page.click('#campaign-shop-back');
    await expect(levelCards.first()).toBeVisible();
  });

  test('should start the first campaign level "Der Aufstand"', async ({ page }) => {
    // 1. Open Campaign Menu
    await page.click('#campaign-start-btn');

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
    await page.click('#campaign-start-btn');
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

test.describe('Taktik-Genie', () => {
  test('opens one tip when the mission starts', async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      localStorage.setItem(
        'schach_campaign_state',
        JSON.stringify({
          currentLevelId: 'peasant_revolt',
          unlockedLevels: ['peasant_revolt'],
          completedLevels: [],
          unlockedRewards: [],
          gold: 500,
          unlockedPerks: ['taktik_genie'],
          levelStars: {},
          unlockedTalentIds: [],
          championType: null,
        })
      );
    });

    const helper = new E2EHelper(page);
    await helper.goto('e2e');
    await page.click('#campaign-start-btn');
    await page.locator('.campaign-level-card').first().click();

    const start = page.getByRole('button', { name: 'Mission starten' });
    await expect(start).toBeVisible();
    await expect(page.locator('.taktik-genie-note')).toBeVisible();
    await start.click();

    const tutorOverlay = page.locator('#tutor-overlay');
    await expect(tutorOverlay).toBeVisible({ timeout: 30000 });
    await expect(tutorOverlay).not.toHaveClass(/hidden/);
  });
});
