import { test, expect } from '@playwright/test';

test.describe('Hint Generator Repro', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  test('should show hints in setup mode', async ({ page }) => {
    // 1. Select Hiring Mode
    const hiringCard = page.locator('.gamemode-card', { hasText: 'Truppen anheuern (9x9)' });
    await hiringCard.click();

    // 2. Wait for board and setup phase
    await expect(page.locator('#board')).toBeVisible();
    await page.waitForFunction(() => {
      const g = (window as any).app?.game;
      return g && g.phase && String(g.phase).startsWith('SETUP');
    });
    // Give it a tiny bit of extra time for everything to settle
    await page.waitForTimeout(500);

    // 3. Press 'h' to get hints (setup templates)
    console.log('Pressing h in setup mode...');
    // Direct event dispatch to avoid focus issues
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', bubbles: true }));
    });

    // 4. Verify that setup templates overlay is visible and contains cards
    const tutorOverlay = page.locator('#tutor-overlay');
    await expect(tutorOverlay).toBeVisible({ timeout: 15000 });
    await expect(tutorOverlay.locator('.setup-template-card').first()).toBeVisible();
  });

  test('should show hints in play mode', async ({ page }) => {
    // 1. Select Classic Mode (9x9) to skip setup
    const classicModeCard = page.locator('.gamemode-card', { hasText: 'Klassisch 9x9' });
    await classicModeCard.click();

    // 2. Wait for board and game start
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#status-display')).toContainText(/Weiß am Zug/i);

    // 3. Press 'h'
    await page.waitForTimeout(1000); // Wait bit for AI search
    console.log('Pressing h in play mode...');
    // Direct event dispatch to avoid focus issues
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', bubbles: true }));
    });

    // 4. Verify hints appear
    const tutorOverlay = page.locator('#tutor-overlay');
    await expect(tutorOverlay).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.tutor-hint-item')).toBeVisible();
  });
});
