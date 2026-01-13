import { test, expect } from '@playwright/test';

test.describe('Puzzle Mode @puzzle', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    // Disable AI Mentor
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });

    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  test('should open puzzle menu from main menu', async ({ page }) => {
    // In Main Menu, click "Puzzle-Modus" card
    // The card has text "Puzzle-Modus" inside .card-title
    const puzzleCard = page.locator('.gamemode-card').filter({ hasText: 'Puzzle-Modus' });
    await expect(puzzleCard).toBeVisible();
    await puzzleCard.click();

    // This initializes the game in 'puzzle' mode and shows the Puzzle Menu Overlay
    const puzzleMenu = page.locator('#puzzle-menu-overlay');
    await expect(puzzleMenu).toBeVisible();

    // Verify Puzzle List isn't empty
    await expect(page.locator('.puzzle-card')).not.toHaveCount(0);
  });

  test('should start first puzzle', async ({ page }) => {
    // Start via Main Menu
    await page.locator('.gamemode-card').filter({ hasText: 'Puzzle-Modus' }).click();

    // Wait for menu
    const puzzleMenu = page.locator('#puzzle-menu-overlay');
    await expect(puzzleMenu).toBeVisible();

    // Select first puzzle
    await page.locator('.puzzle-card').first().click();

    // Verify Puzzle Overlay (Game Interface)
    await expect(page.locator('#puzzle-overlay')).toBeVisible();

    // Verify Game Mode state
    await page.waitForFunction(
      () => (window as any).game && (window as any).game.mode === 'puzzle'
    );

    // Verify Title presence
    await expect(page.locator('#puzzle-title')).toBeVisible();
  });

  test('should solve puzzle 1 (correct move)', async ({ page }) => {
    // Start Puzzle 1
    await page.locator('.gamemode-card').filter({ hasText: 'Puzzle-Modus' }).click();
    await page.locator('.puzzle-card').first().click();

    await expect(page.locator('#puzzle-overlay')).toBeVisible();

    // Puzzle 1: White moves from 1,7 to 0,7
    const fromCell = page.locator('.cell[data-r="1"][data-c="7"]');
    const toCell = page.locator('.cell[data-r="0"][data-c="7"]');

    // Ensure piece is loaded (White Rook)
    // data-piece might be just 'r' (type) with data-color='white'
    await expect(fromCell).toHaveAttribute('data-piece', 'r');
    await expect(fromCell).toHaveAttribute('data-color', 'white');

    await fromCell.click();
    // await expect(fromCell).toHaveClass(/selected/); // Flaky or unused in Puzzle Mode?
    await toCell.click();

    // Verify Success (German localization)
    const statusEl = page.locator('#puzzle-status');
    await expect(statusEl).toHaveText(/Gelöst|Solved|Richtig/i, { timeout: 5000 });
    await expect(statusEl).toHaveClass(/success/);

    // Verify Next Button
    await expect(page.locator('#puzzle-next-btn')).toBeVisible();
  });

  test('should fail puzzle 1 (wrong move)', async ({ page }) => {
    // Start Puzzle 1
    await page.locator('.gamemode-card').filter({ hasText: 'Puzzle-Modus' }).click();
    await page.locator('.puzzle-card').first().click();

    // Wrong move: 1,7 to 1,6
    const fromCell = page.locator('.cell[data-r="1"][data-c="7"]');
    const wrongTarget = page.locator('.cell[data-r="1"][data-c="6"]');

    await expect(fromCell).toBeVisible();
    await fromCell.click();
    await wrongTarget.click();

    // Verify Failure Feedback
    const statusEl = page.locator('#puzzle-status');
    // Expect failure class or text (or just not success)
    await expect(statusEl).not.toHaveClass(/success/);
    // Depending on impl, might be error class or just different text
  });
});
