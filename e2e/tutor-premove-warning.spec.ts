/**
 * Regression guard for the pre-move warning threshold.
 *
 * `analyzePlayerMovePreExecution` used to add the full material value of every
 * attacked piece, so a plain developing move tripped the mentor threshold and
 * the "⚠️ Warnung: Grober Fehler?" dialog swallowed the move — the AI opponent
 * never got to answer. See `js/tutor/MoveAnalyzer.ts` (`staticExchangePenalty`).
 */

import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Pre-move blunder warning', () => {
  test('a normal opening move is not intercepted by the warning dialog', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();
    await helper.startGame('classic');
    await expect(page.locator('[data-testid="board"]')).toBeVisible();
    await page.waitForTimeout(1000);

    // Plain developing move: nothing is lost, so no confirmation may appear.
    await helper.clickCell(7, 4);
    await page.waitForTimeout(300);
    await helper.clickCell(6, 4);
    await page.waitForTimeout(1500);

    const state = await page.evaluate(() => {
      const app = (window as any).app;
      const modal = document.getElementById('generic-modal');
      const title = document.getElementById('modal-title');
      return {
        moveCount: app.game.moveHistory.length,
        modalVisible: !!modal && getComputedStyle(modal).display !== 'none',
        title: title?.textContent ?? '',
      };
    });

    // The move must have been executed instead of parked behind a dialog.
    expect(state.moveCount).toBeGreaterThanOrEqual(1);
    expect(state.modalVisible).toBe(false);
    expect(state.title).not.toContain('Grober Fehler');
  });
});
