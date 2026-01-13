import { test, expect } from '@playwright/test';

test.describe('Campaign Mode @campaign', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    // Disable AI Mentor to avoid modals
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });

    // Go to home
    await page.goto('/?disable-sw');

    // Wait for App Initialization
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  test('should open campaign menu and start first level', async ({ page }) => {
    // 1. Open Campaign Menu
    const campaignBtn = page.locator('#campaign-start-btn');
    await expect(campaignBtn).toBeVisible();
    await campaignBtn.click();

    // 2. Verify Overlay
    const overlay = page.locator('#campaign-overlay');
    await expect(overlay).toBeVisible();

    // 3. Verify Levels are listed
    const levelCards = page.locator('.campaign-level-card');
    await expect(levelCards).not.toHaveCount(0);

    // 4. Click first unlocked level
    const firstLevel = levelCards.first();
    await expect(firstLevel).toHaveClass(/unlocked/);
    await firstLevel.click();

    // 5. Verify Game Starts
    await expect(overlay).toBeHidden();
    await expect(page.locator('#board')).toBeVisible();

    // Verify UI indicates Campaign/Level info if available
    // GameController starts campaign level -> CampaignModeStrategy.
    // CampaignModeStrategy usually prints to log or updates status?
    // Let's check for log message "Level ... gestartet" or similar if possible.
    // Or just check that we are not in setup mode (body class) and board is interactable.

    await expect(page.locator('body')).not.toHaveClass(/setup-mode/);
  });

  test('should complete level 1 and unlock level 2', async ({ page }) => {
    // 1. Start Campaign
    await page.locator('#campaign-start-btn').click();
    await page.locator('.campaign-level-card').first().click();

    // 2. Wait for Game Load
    await page.waitForFunction(
      () => (window as any).game && (window as any).game.mode === 'campaign'
    );

    // 3. Cheat: Win the game
    await page.evaluate(() => {
      // Force win logic
      (window as any).game.gameController.handleGameEnd('win', 'white');
    });

    // 4. Verify Win Overlay
    // Victory modal appears after 1.5s delay
    // const modal = page.locator('.modal-content');
    await expect(page.locator('text="Nächste Mission"')).toBeVisible({ timeout: 5000 });
    // await expect(modal).toContainText('Mission erfolgreich'); // Text varies based on 'showCampaignVictoryModal' implementation?
    // GameController says: UI.showCampaignVictoryModal(levelBefore.title, ...)
    // which likely reuses standard modal or specific one. Key is buttons.

    // 5. Verify Unlocked Next Level in Campaign Menu
    // Close overlay (or return to menu?)
    // Usually "Next Level" button or "Back to Menu"?
    // Let's assume we go back to menu to see unlock status.
    // Or check manager state directly.
    await page.evaluate(() => {
      // Check global campaignManager or storage directly
      // Imports are modules, so hard to access in console directly unless exposed.
      // But logic saves to localStorage.
      return localStorage.getItem('schach_campaign_state');
    });

    // Check localStorage in subsequent step or assume UI updates.
    // Let's reload page and check campaign menu for unlock.
    await page.reload();
    await page.locator('#campaign-start-btn').click();

    // Check second card (skirmish_1)
    const secondLevel = page.locator('.campaign-level-card').nth(1);
    await expect(secondLevel).toHaveClass(/unlocked/);
  });
});
