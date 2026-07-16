import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Smoke gate for the ui.ts dead-dynamic-import removal (tech debt).
 * ui.ts is now a static import in App.ts / TutorUI / KeyboardManager.
 * This proves the app still boots, the central UI module initializes,
 * and a basic game interaction (move + keyboard) works end to end.
 *
 * Regression guard: a broken circular dependency from switching ui.ts to
 * a static import would crash app boot — unit tests would NOT catch that.
 */
test.describe('App boot + UI module (tech-debt static ui import)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('app boots and the central UI module is initialized', async ({ page }) => {
    await helper.startGame('classic');

    // window.app and window.UI must both exist (App.ts statically imports ui.ts
    // and assigns window.UI = UI_MODULE).
    await page.waitForFunction(
      () =>
        (window as unknown as { app?: unknown }).app != null &&
        (window as unknown as { UI?: unknown }).UI != null,
      { timeout: 10000 }
    );

    const bootOk = await page.evaluate(() => {
      const app = (window as unknown as { app: { gameController: unknown } }).app;
      const ui = (window as unknown as { UI: Record<string, unknown> }).UI;
      return {
        hasGameController: !!app.gameController,
        uiHasRenderBoard: typeof ui.renderBoard === 'function',
        uiHasUpdateStatus: typeof ui.updateStatus === 'function',
        uiHasShowToast: typeof ui.showToast === 'function',
      };
    });
    expect(bootOk.hasGameController).toBe(true);
    expect(bootOk.uiHasRenderBoard).toBe(true);
    expect(bootOk.uiHasUpdateStatus).toBe(true);
    expect(bootOk.uiHasShowToast).toBe(true);
  });

  test('a move + keyboard input works without crashing', async ({ page }) => {
    await helper.startGame('classic');
    await page.waitForFunction(
      () => (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
      { timeout: 10000 }
    );

    // Real white move (pawn e-file, row 7 -> row 6 on 9x9).
    await helper.clickCell(7, 4);
    await helper.clickCell(6, 4);

    await page.waitForFunction(
      () => ((window as unknown as { app: { game: { moveHistory: unknown[] } } }).app.game.moveHistory?.length ?? 0) >= 1,
      { timeout: 15000 }
    );

    // Keyboard: press Escape (harmless) — proves KeyboardManager still wires up
    // (it uses updateStatus from the now-statically-imported ui module).
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Resign via the (already-proven) gameController API to end the game.
    await page.evaluate(() => {
      (window as unknown as { app: { gameController: { resign: (c: string) => void } } }).app.gameController.resign('white');
    });
    await page.waitForFunction(
      () => (window as unknown as { app: { game: { phase: string } } }).app.game.phase === 'GAME_OVER',
      { timeout: 10000 }
    );
    const phase = await page.evaluate(
      () => (window as unknown as { app: { game: { phase: string } } }).app.game.phase
    );
    expect(phase).toBe('GAME_OVER');
  });
});
