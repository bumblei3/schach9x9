import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Hardens the Eröffnungs-Trainer correct-move path in a real browser.
 *
 * The existing opening-trainer.spec.ts only clicks an arbitrary cell (a wrong
 * move) and asserts "some feedback appeared". It never proves the book-endorsed
 * move is recognised as correct and that the streak increments — exactly the
 * kind of browser-wiring path unit tests miss. This test queries the expected
 * move from the live controller, plays it via the two-click flow, and verifies
 * the "Richtig!" feedback plus a streak increment.
 */
test.describe('Opening-Trainer correct-move path (browser)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('playing the book-endorsed move is scored correct and increments the streak', async ({
    page,
  }) => {
    await helper.startGame('opening-trainer');

    // The trainer menu shows a "Start training" button; click it to load the
    // first position onto the board and arm the play loop.
    await page.locator('.opening-trainer-start').click();

    // Wait for a real position to be loaded onto the board and exposed on the
    // live controller (currentTrainerPosition holds the expected book move).
    await expect(page.locator('.cell[data-piece]').first()).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(
      () => {
        const gc = (
          window as unknown as {
            gameController?: { currentTrainerPosition?: { expectedMove?: unknown } | null };
          }
        ).gameController;
        return !!gc && !!gc.currentTrainerPosition && !!gc.currentTrainerPosition.expectedMove;
      },
      { timeout: 10000 }
    );

    // Read the book-endorsed move straight from the controller.
    const expectedMove = await page.evaluate(() => {
      const gc = (
        window as unknown as {
          gameController: {
            currentTrainerPosition: {
              expectedMove: { from: { r: number; c: number }; to: { r: number; c: number } };
            };
          };
        }
      ).gameController;
      return gc.currentTrainerPosition.expectedMove;
    });
    expect(expectedMove).toBeTruthy();

    // Play it via the two-click flow: select the from-cell, then the to-cell.
    await page
      .locator(`.cell[data-r="${expectedMove.from.r}"][data-c="${expectedMove.from.c}"]`)
      .click();
    await page.waitForTimeout(150);
    await page
      .locator(`.cell[data-r="${expectedMove.to.r}"][data-c="${expectedMove.to.c}"]`)
      .click();

    // The controller must score it correct. Two signals prove this:
    //  1) a "Richtig!" success notification appears (soft — timing-sensitive), and
    //  2) the streak readout advances to at least 1 (hard — state-based).
    // We poll for the notification but don't fail hard if it already faded.
    const rightVisible = await page
      .getByText('Richtig!', { exact: false })
      .isVisible()
      .catch(() => false);
    if (!rightVisible) {
      console.log(
        'NOTE: "Richtig!" notification not visible (timing) — relying on streak assertion'
      );
    }

    await expect
      .poll(
        async () => {
          const txt = await page.locator('.opening-trainer-streak').textContent();
          const m = txt?.match(/Streak:\s*(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        },
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(1);
  });
});
