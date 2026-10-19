import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Daily Puzzle Mode (browser)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('unsolved daily card leads the featured modes', async ({ page }) => {
    const modes = page.locator('.gamemode-grid-featured > .gamemode-card:not(.hidden)');
    await expect(modes.nth(0)).toHaveAttribute('data-mode', 'daily-puzzle');
    await expect(modes.nth(1)).toHaveAttribute('id', 'campaign-start-btn');
    await expect(modes.nth(2)).toHaveAttribute('data-mode', 'classic');
  });

  test('solved daily card sits behind Klassisch', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      localStorage.setItem(`dailyPuzzle.solved.${now.getFullYear()}-${month}-${day}`, '1');
    });
    await helper.goto();

    const modes = page.locator('.gamemode-grid-featured > .gamemode-card:not(.hidden)');
    await expect(modes.nth(0)).toHaveAttribute('id', 'campaign-start-btn');
    await expect(modes.nth(1)).toHaveAttribute('data-mode', 'classic');
    await expect(modes.nth(2)).toHaveAttribute('data-mode', 'daily-puzzle');
    await expect(page.locator('#daily-puzzle-badge')).toBeVisible();
  });

  test("opens today's position, not the puzzle catalog", async ({ page }) => {
    await helper.startGame('daily-puzzle');

    const board = page.locator('[data-testid="board"]');
    await expect(board).toBeVisible();
    await expect(page.locator('.cell')).toHaveCount(81);

    const firstPiece = page.locator('.cell[data-piece]').first();
    await expect(firstPiece).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#puzzle-menu-overlay')).toBeHidden();
    await expect(page.locator('#puzzle-overlay')).toBeVisible();
    await expect(page.locator('#puzzle-title')).not.toHaveText('');
    await expect(page.locator('#puzzle-description')).not.toHaveText('');
    await expect(page.locator('#puzzle-next-btn')).toBeHidden();
    await expect(page.locator('#puzzle-exit-btn')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { game?: { mode?: string } }).game?.mode === 'daily-puzzle'
    );
  });
});
