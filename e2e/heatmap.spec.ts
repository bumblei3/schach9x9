import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Heatmap feature (verbesserungsvorschlaege.md #6): after a solo game ends
 * with at least one move played, the move-activity heatmap panel must be
 * visible and render a 9x9 grid of cells tinted by usage.
 *
 * This is the real-browser gate — the unit test for computeHeatmap() only
 * proves the math; it does NOT prove the panel is wired into handleGameEnd
 * or that the DOM grid is actually populated (the blank-board-bug class of
 * failure that unit tests miss).
 */
test.describe('Move-activity heatmap (solo, post-game)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('renders a 9x9 heatmap panel after a game with moves ends', async ({ page }) => {
    await helper.startGame('classic');

    // Wait for the controller.
    await page.waitForFunction(
      () =>
        (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );

    // Play a real white move (pawn e2 -> e4 on the 9x9 board: row 7 -> row 6,
    // e-file = col 4) so moveHistory is non-empty.
    await helper.clickCell(7, 4);
    await helper.clickCell(6, 4);

    // Wait until the white move is recorded in the history (>= 1 entry).
    await page.waitForFunction(
      () =>
        ((window as unknown as { app: { game: { moveHistory: unknown[] } } }).app.game
          .moveHistory?.length ?? 0) >= 1,
      { timeout: 15000 }
    );

    // End the game (resign) -> handleGameEnd -> heatmap render + show.
    await page.evaluate(() => {
      const app = (
        window as unknown as { app: { gameController: { resign: (c: string) => void } } }
      ).app;
      app.gameController.resign('white');
    });

    // The heatmap panel becomes visible (Solo, non-campaign path).
    const panel = page.locator('#move-heatmap-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // It renders exactly 81 cells (9x9).
    await expect(page.locator('#heatmap-grid .heatmap-cell')).toHaveCount(81, {
      timeout: 10000,
    });

    // The hottest-field label is populated (game had moves).
    await expect(page.locator('#heatmap-hottest')).not.toContainText('Noch keine Zuege');

    // At least one cell shows non-minimal intensity (a square was used).
    const usedCount = await page.evaluate(() => {
      const cells = Array.from(
        document.querySelectorAll<HTMLElement>('#heatmap-grid .heatmap-cell')
      );
      return cells.filter((c) => {
        const i = parseFloat(c.style.getPropertyValue('--intensity') || '0');
        return i > 0.01;
      }).length;
    });
    expect(usedCount).toBeGreaterThan(0);
  });
});
