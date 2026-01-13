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
});
