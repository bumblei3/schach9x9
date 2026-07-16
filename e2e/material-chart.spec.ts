import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Material-balance chart (verbesserungsvorschlaege.md #6): after a solo game
 * ends with moves, the material graph (#material-graph) must be visible and
 * contain a plotted line/curve derived from the move history.
 *
 * Real-browser gate: proves the panel is wired into handleGameEnd and the SVG
 * is actually populated (the blank-panel class of bug unit tests miss).
 */
test.describe('Material-balance chart (solo, post-game)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('renders a material chart after a game with moves ends', async ({ page }) => {
    await helper.startGame('classic');

    await page.waitForFunction(
      () => (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );

    // Play a real white move (pawn e-file, row 7 -> row 6 on 9x9) so history > 0.
    await helper.clickCell(7, 4);
    await helper.clickCell(6, 4);

    await page.waitForFunction(
      () =>
        ((window as unknown as { app: { game: { moveHistory: unknown[] } } }).app.game
          .moveHistory?.length ?? 0) >= 1,
      { timeout: 15000 }
    );

    // End the game (resign) -> handleGameEnd -> material chart render + show.
    await page.evaluate(() => {
      const app = (
        window as unknown as { app: { gameController: { resign: (c: string) => void } } }
      ).app;
      app.gameController.resign('white');
    });

    // The material chart container becomes visible (Solo, non-campaign).
    const container = page.locator('#material-graph-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    // It contains a plotted line/path with at least one point.
    const svg = page.locator('#material-graph');
    await expect(svg).toBeVisible({ timeout: 10000 });
    const plotted = svg.locator('.eval-point, .eval-line, .eval-area');
    expect(await plotted.count()).toBeGreaterThan(0);
  });
});
