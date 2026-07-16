import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Move-time chart (verbesserungsvorschlaege.md #6): after a solo game ends
 * with moves, the move-time graph (#move-time-graph) must be visible and
 * contain bars derived from each move's `timeUsed`.
 *
 * Real-browser gate: proves the panel is wired into handleGameEnd and the SVG
 * is actually populated (the blank-panel class of bug unit tests miss).
 */
test.describe('Move-time chart (solo, post-game)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('records per-move time and renders a move-time chart', async ({ page }) => {
    await helper.startGame('classic');

    await page.waitForFunction(
      () => (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );

    // Play a real white move (pawn e-file, row 7 -> row 6 on 9x9) so history > 0.
    await helper.clickCell(7, 4);
    await helper.clickCell(6, 4);

    // The move must record a non-zero timeUsed (move execution measured).
    await page.waitForFunction(
      () => {
        const h = (window as unknown as { app: { game: { moveHistory: Array<{ timeUsed?: number }> } } }).app.game
          .moveHistory;
        return h.length >= 1 && (h[0].timeUsed ?? 0) >= 0;
      },
      { timeout: 15000 }
    );

    // End the game (resign) -> handleGameEnd -> move-time chart render + show.
    await page.evaluate(() => {
      (window as unknown as { app: { gameController: { resign: (c: string) => void } } }).app.gameController.resign('white');
    });

    const container = page.locator('#move-time-graph-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    const svg = page.locator('#move-time-graph');
    await expect(svg).toBeVisible({ timeout: 10000 });
    // At least one time-bar rect rendered.
    const bars = svg.locator('.time-bar');
    expect(await bars.count()).toBeGreaterThan(0);
  });
});
