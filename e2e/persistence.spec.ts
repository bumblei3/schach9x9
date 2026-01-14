import { test, expect } from '@playwright/test';

test.describe('Persistence & Recovery @persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Disable AI Mentor
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  test('should restore board state after page reload', async ({ page }) => {
    test.slow(); // Firefox needs more time

    // 1. Start a Classic 9x9 game
    await page.click('.gamemode-card:has-text("Klassisch 9x9")');
    await expect(page.locator('#board')).toBeVisible();

    // Wait for game to be ready
    await page.waitForFunction(() => (window as any).game?.phase === 'PLAY', { timeout: 10000 });

    // 2. Make a move programmatically
    await page.evaluate(async () => {
      const game = (window as any).game;
      if (game.handlePlayClick) {
        await game.handlePlayClick(7, 4);
        await game.handlePlayClick(5, 4);
      }
    });

    // Wait for move to be recorded in engine
    await page.waitForFunction(() => (window as any).game.moveHistory.length > 0, {
      timeout: 10000,
    });

    await expect(page.locator('.cell[data-r="5"][data-c="4"]')).toHaveAttribute('data-piece', 'p');

    await page.evaluate(() => {
      (window as any).gameController.saveGame();
    });

    // Allow time for debounce and async save
    await page.waitForTimeout(1000);

    // 3. Reload the page
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    // 4. Click Continue button in main menu
    const continueBtn = page.locator('#main-menu-continue-btn');
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // 5. Verify the game is restored
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('.cell[data-r="5"][data-c="4"]')).toHaveAttribute('data-piece', 'p');

    // Wait for status to change from initialization
    await expect(page.locator('#status-display')).not.toHaveText(/Initialisiere/i, {
      timeout: 5000,
    });
    const statusText = await page.locator('#status-display').textContent();
    console.log('Restored Status Text:', statusText);
    await expect(page.locator('#status-display')).toContainText('Schwarz', { ignoreCase: true });
  });

  test('should restore move history after page reload', async ({ page }) => {
    test.slow(); // Firefox needs more time

    await page.click('.gamemode-card:has-text("Klassisch 9x9")');
    await expect(page.locator('#board')).toBeVisible();

    // Wait for game to be ready
    await page.waitForFunction(() => (window as any).game?.phase === 'PLAY', { timeout: 10000 });

    // Move 1: (7,4) -> (5,4) programmatically
    await page.evaluate(async () => {
      const game = (window as any).game;
      if (game.handlePlayClick) {
        await game.handlePlayClick(7, 4);
        await game.handlePlayClick(5, 4);
      }
    });

    // Wait for move recording
    await page.waitForFunction(() => (window as any).game.moveHistory.length > 0, {
      timeout: 10000,
    });

    const saveResult = await page.evaluate(() => {
      const success = (window as any).gameController.saveGame();
      return {
        success,
        historyLength: (window as any).game.moveHistory.length,
        localStorage: localStorage.getItem('schach9x9_save_autosave')?.length,
      };
    });
    console.log('Save Result:', JSON.stringify(saveResult));

    // Allow time for persistence
    await page.waitForTimeout(1000);

    // 2. Reload
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    // 3. Click Continue
    const continueBtn = page.locator('#main-menu-continue-btn');
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // 4. Wait for restoration to complete (including potential UI updates)
    await page.waitForTimeout(1000);

    const loadInfo = await page.evaluate(() => {
      const history = (window as any).game.moveHistory;
      const historyEl = document.getElementById('move-history');
      return {
        historyLength: history ? history.length : 'null',
        innerHtmlLength: historyEl ? historyEl.innerHTML.length : 'null',
      };
    });
    console.log('Load Info (after 1s):', JSON.stringify(loadInfo));

    // 5. Check history panel
    const historyEntries = page.locator('.move-entry');
    await expect(historyEntries.first()).toBeAttached({ timeout: 5000 });
    const count = await historyEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
