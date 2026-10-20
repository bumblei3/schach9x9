import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

type PWPage = import('@playwright/test').Page;

async function waitGame(page: PWPage) {
  await page.waitForFunction(
    () => (window as unknown as { game?: { phase?: string } }).game?.phase === 'PLAY',
    { timeout: 20000 }
  );
}

test.describe('Draw offer vs human (hotseat)', () => {
  test('offering a draw shows the overlay and accepting ends the game as a draw', async ({ page }) => {
    const helper = new E2EHelper(page);
    page.on('dialog', async (d) => { await d.accept(); });
    await helper.goto();
    await helper.startGame('classic');
    await waitGame(page);

    // Switch to hotseat (human vs human)
    await page.evaluate(() => {
      const game = (window as unknown as { game: { isAI: boolean } }).game;
      if (game) game.isAI = false;
    });

    // White offers a draw
    await page.locator('#action-more-btn').click();
    await expect(page.locator('#draw-offer-btn')).toBeVisible();
    await page.locator('#draw-offer-btn').click();

    // The opponent (black) sees the draw-offer overlay
    await expect(page.locator('#draw-offer-overlay')).toBeVisible({ timeout: 5000 });

    // Accept the draw
    await page.locator('#accept-draw-btn').click();

    // Game ends as a draw
    await expect(page.locator('#game-over-overlay')).toBeVisible({ timeout: 10000 });
  });

  test('declining a draw keeps the game running', async ({ page }) => {
    const helper = new E2EHelper(page);
    page.on('dialog', async (d) => { await d.accept(); });
    await helper.goto();
    await helper.startGame('classic');
    await waitGame(page);

    await page.evaluate(() => {
      const game = (window as unknown as { game: { isAI: boolean } }).game;
      if (game) game.isAI = false;
    });

    await page.locator('#action-more-btn').click();
    await expect(page.locator('#draw-offer-btn')).toBeVisible();
    await page.locator('#draw-offer-btn').click();

    await expect(page.locator('#draw-offer-overlay')).toBeVisible({ timeout: 5000 });
    await page.locator('#decline-draw-btn').click();

    await expect(page.locator('#draw-offer-overlay')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#game-over-overlay')).not.toBeVisible();
  });
});
