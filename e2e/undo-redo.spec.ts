import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Rückgängig / Wiederholen über die Aktionsleiste.
 *
 * Redo war nur über die Tastatur erreichbar: `redoStack`, `moveController.redoMove`
 * und der Kürzel-Eintrag existierten, aber weder ein Button im Markup noch ein
 * Klick-Listener — `updateUndoRedoButtons` lief damit in einen toten Zweig. Der
 * Unit-Test (DOMHandler_wiring) prüft den Listener, dieser Spec den Weg durch die
 * echte App.
 */

test.describe('Rückgängig / Wiederholen', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('Wiederholen stellt den Zurückgenommenen Zug wieder her', async ({ page }) => {
    await helper.startGame('classic');
    await expect(page.locator('[data-testid="board"]')).toBeVisible();
    await page.waitForTimeout(800);

    const state = () =>
      page.evaluate(() => {
        const game = (window as any).app.game;
        return {
          moves: game.moveHistory.length,
          e2: !!game.board[7][4],
          e4: !!game.board[6][4],
          redoDisabled: document.getElementById('redo-btn')!.hasAttribute('disabled'),
        };
      });

    // e2–e4
    await helper.clickCell(7, 4);
    await page.waitForTimeout(250);
    await helper.clickCell(6, 4);
    await page.waitForFunction(() => (window as any).app.game.moveHistory.length >= 1, {
      timeout: 10000,
    });
    expect((await state()).e4).toBe(true);
    expect((await state()).redoDisabled).toBe(true);

    // Zurücknehmen: der Bauer steht wieder auf e2, Redo wird freigegeben.
    await page.locator('#undo-btn').click();
    await page.waitForTimeout(500);
    const undone = await state();
    expect(undone.moves).toBe(0);
    expect(undone.e2).toBe(true);
    expect(undone.e4).toBe(false);
    expect(undone.redoDisabled).toBe(false);

    // Wiederholen über den neuen Button. Der Zug geht danach an die KI — die
    // antwortet asynchron, deshalb die Stellung prüfen, nicht die Zugzahl.
    await page.locator('#redo-btn').click();
    await page.waitForTimeout(500);
    const redone = await state();
    expect(redone.moves).toBeGreaterThanOrEqual(1);
    expect(redone.e4).toBe(true);
    expect(redone.e2).toBe(false);
  });
});
