import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Real-browser gate for the variant-tree panel (Task 2 of the solo-UX plan).
 *
 * After a SOLO game ends (resign), handleGameEnd must render the variant-tree
 * panel: #variant-tree-container is shown and #variant-tree contains at least
 * one `.variant-root` line (top candidate move + score, plus best replies).
 *
 * renderVariantTree is async (it awaits buildVariantTree's KI search), so the
 * `.variant-root` nodes appear only after the search resolves. We therefore
 * wait for them with a generous timeout rather than asserting immediately.
 */
test.describe('variant-tree panel after solo game end', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('SOLO: resign renders non-empty variant-tree panel', async ({ page }) => {
    await helper.startGame('classic');

    await page.waitForFunction(
      () =>
        (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );

    // Play one real white pawn move (9x9: pawns start on row 7).
    await helper.clickCell(7, 4);
    await helper.clickCell(6, 4);

    await page.waitForFunction(
      () =>
        ((window as unknown as { app: { game: { moveHistory: unknown[] } } }).app.game
          .moveHistory?.length ?? 0) >= 1,
      { timeout: 15000 }
    );

    await page.evaluate(() => {
      const app = window as unknown as { app: { gameController: { resign: (c: string) => void } } };
      app.app.gameController.resign('white');
    });

    // Container must be revealed.
    await expect(page.locator('#variant-tree-container')).toBeVisible({ timeout: 10000 });

    // Async KI search populates the nodes — wait for at least one.
    await expect
      .poll(async () => page.locator('#variant-tree .variant-root').count(), { timeout: 30000 })
      .toBeGreaterThan(0);

    const n = await page.locator('#variant-tree .variant-root').count();
    expect(n).toBeGreaterThan(0);
  });
});
