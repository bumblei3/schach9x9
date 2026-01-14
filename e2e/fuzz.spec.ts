import { test, expect } from '@playwright/test';

test.describe('Fuzz Testing / Stress Test', () => {
  test('should play a random game for 50 turns without crashing', async ({ page }) => {
    test.setTimeout(120000); // Allow 2 minutes for 50 turns

    // 1. Start a Classic 9x9 Game (simplest setup)
    await page.goto('/');
    await page.click('.gamemode-card:has-text("Klassisch 9x9")');
    await expect(page.locator('#board')).toBeVisible();

    // Wait for game to be ready
    await page.waitForFunction(() => (window as any).game?.phase === 'PLAY');

    // Disable AI to play both sides
    await page.evaluate(() => {
      const app = (window as any).app;
      const game = app.game;
      game.isAI = false;
      // Disable animations for speed
      if (app.boardRenderer) {
        app.boardRenderer.animationsEnabled = false;
      }
    });

    let movesMade = 0;
    const MAX_MOVES = 100; // 50 full turns

    while (movesMade < MAX_MOVES) {
      // Check for Game Over
      const isGameOver = await page.evaluate(() => (window as any).game.phase === 'GAME_OVER');
      if (isGameOver) {
        console.log(`Game Over reached after ${movesMade} moves.`);
        break;
      }

      // Get all legal moves for current turn
      const moveResult = await page.evaluate(() => {
        const game = (window as any).game;
        const moves = game.getAllLegalMoves(game.turn);
        if (moves.length === 0) return null; // Mate or Patt

        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        return {
          from: randomMove.from,
          to: randomMove.to,
          turn: game.turn,
        };
      });

      if (!moveResult) {
        console.log('No legal moves available (Checkmate/Stalemate).');
        break;
      }

      // Execute Move
      await page.evaluate(m => {
        const game = (window as any).game;
        console.log(`[Fuzz] ${m.turn}: (${m.from.r},${m.from.c}) -> (${m.to.r},${m.to.c})`);
        game.executeMove(m.from, m.to);
        if (game.boardRenderer) game.boardRenderer.renderBoard();
      }, moveResult);

      movesMade++;

      // Assert basic state sanity
      const boardVisible = await page.locator('#board').isVisible();
      expect(boardVisible, 'Board should remain visible').toBeTruthy();

      // Check for errors in console (optional, Playwright does this if configured)
      // Check if turn switched (unless extra turn mechanic exists, but usually it switches)
      // For fuzzing, we just trust executeMove updates state.

      // Small delay to let UI update (optional)
      // await page.waitForTimeout(10);
    }

    console.log(`Fuzz test completed: ${movesMade} moves played.`);
    expect(movesMade).toBeGreaterThan(0);
  });
});
