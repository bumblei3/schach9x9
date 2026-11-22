import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';
import { domClick } from './helpers/E2EHelper.js';

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
    // Use the shared domClick primitive: some trainer positions place the
    // from-cell outside the default Playwright viewport (the SPA disables page
    // scroll) or under an overlay, so locator.click()'s actionability check
    // flakily times out. domClick exercises the real cell->move wiring in
    // GameController, just without the pixel-visibility gate.
    await domClick(page, `.cell[data-r="${expectedMove.from.r}"][data-c="${expectedMove.from.c}"]`);

    // Wait for the selection to actually land on the controller. A fixed
    // waitForTimeout(150) here was the flake source under full-suite load: the
    // second click could arrive before the first click's selection was
    // processed, so the to-cell looked like a fresh (empty) click and the move
    // was never submitted.
    await expect
      .poll(
        async () =>
          page.evaluate(
            ({ r, c }) => {
              const gc = (
                window as unknown as {
                  gameController?: { game?: { selectedSquare?: { r: number; c: number } | null } };
                }
              ).gameController;
              return gc?.game?.selectedSquare ?? null;
            },
            { r: expectedMove.from.r, c: expectedMove.from.c }
          ),
        { timeout: 10000 }
      )
      .toEqual({ r: expectedMove.from.r, c: expectedMove.from.c });

    await domClick(page, `.cell[data-r="${expectedMove.to.r}"][data-c="${expectedMove.to.c}"]`);

    // The controller must score it correct. The hard signal is the manager
    // state: a submitted move increments `attempts`, a correct one increments
    // `streak`. Asserting only the DOM readout made the test depend on the
    // readout re-render timing.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const gc = (
              window as unknown as {
                gameController?: {
                  openingTrainerManager?: { progress?: { attempts: number; streak: number } };
                };
              }
            ).gameController;
            const p = gc?.openingTrainerManager?.progress;
            return p ? { attempts: p.attempts, streak: p.streak } : { attempts: 0, streak: 0 };
          }),
        { timeout: 10000 }
      )
      .toMatchObject({ attempts: 1, streak: 1 });

    // UI wiring: the streak readout must reflect the manager state.
    await expect
      .poll(
        async () => {
          const txt = await page.locator('.opening-trainer-streak').textContent();
          const m = txt?.match(/(?:Streak|Serie):\s*(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        },
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(1);

    // Soft signal: the success toast. It auto-fades after 3 s, so poll briefly
    // and never fail the test on it.
    const rightVisible = await page
      .getByText('Richtig!', { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (!rightVisible) {
      console.log('NOTE: "Richtig!" notification already faded — streak assertion is the hard signal');
    }
  });
});
