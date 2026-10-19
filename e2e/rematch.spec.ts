import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Game-over rematch', () => {
  test('Neues Spiel starts the same mode again', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();
    await helper.startGame('classic');

    // The mode card hides the menu immediately, then App.init() assigns
    // window.game only after its dynamic imports. Wait for that object.
    await page.waitForFunction(() => {
      const game = (window as unknown as { game?: { mode?: string; phase?: string } }).game;
      return game?.mode === 'classic' && game.phase === 'PLAY';
    });

    await page.evaluate(() => {
      const game = (window as unknown as { game: { phase: string; isAI: boolean; moveHistory: unknown[] } })
        .game;
      game.isAI = false;
      game.phase = 'GAME_OVER';
      game.moveHistory = [{ from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }];
      document.getElementById('game-over-overlay')?.classList.remove('hidden');
    });

    await page.locator('#restart-btn-overlay').click();

    await expect(page.locator('#game-over-overlay')).toBeHidden();
    // The menu stays in the DOM and hides by dropping `.active` (opacity: 0).
    await expect(page.locator('#main-menu')).not.toHaveClass(/active/);
    await page.waitForFunction(() => {
      const game = (window as unknown as { game?: { mode?: string; phase?: string; moveHistory?: unknown[] } })
        .game;
      return game?.mode === 'classic' && game.phase === 'PLAY' && (game.moveHistory?.length ?? 1) === 0;
    });
    await expect(page.locator('.cell[data-r="8"][data-c="4"]')).toHaveAttribute('data-piece', 'k');
    await expect(page.locator('#status-display')).toHaveText(/Spiel läuft/);
  });
});
