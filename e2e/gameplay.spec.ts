import { test, expect } from '@playwright/test';

test.describe('Core Gameplay Loop', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    // Disable AI Mentor and animations for testing
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
      localStorage.setItem('disable_animations', 'true');
    });

    // Go to home
    await page.goto('/?disable-sw');

    // Wait for App Initialization
    await page.waitForFunction(
      () => document.body.classList.contains('app-ready') && (window as any).app !== undefined
    );
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  test('should start a game and verify board setup', async ({ page }) => {
    // 1. Select Hiring Mode (25 Points)
    const hiringCard = page.locator('.gamemode-card', { hasText: 'Truppen anheuern (9x9)' });
    await hiringCard.click();

    // 2. Wait for Board & Setup Mode
    await expect(page.locator('#board')).toBeVisible();
    const mainMenu = page.locator('#main-menu');
    await expect(page.locator('body')).toHaveClass(/game-initialized/);
    await expect(mainMenu).not.toHaveClass(/active/);

    // 3. Verify board has cells
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(81); // 9x9 board

    // 4. Verify status display shows setup phase
    const statusDisplay = page.locator('#status-display');
    await expect(statusDisplay).toBeVisible();
    await expect(statusDisplay.textContent()).not.toBe('');

    // 5. Verify finish button is available
    const doneButton = page.locator('#finish-setup-btn');
    await expect(doneButton).toBeVisible();
  });
});
