import { test, expect } from '@playwright/test';
import { E2EHelper, domClick } from './helpers/E2EHelper.js';

/**
 * Verifies the roadmap feature "Daily Puzzle: Engine-Zugvorschläge + Varianten".
 *
 * The tutor/hint system (getTutorHints -> top-3 engine moves with explanations
 * and PV/variations) is wired via requestHint(), which is allowed in PHASES.PLAY.
 * The daily-puzzle mode IS a PLAY phase, so hints must be reachable there. This
 * test proves — in a real browser — that pressing the hint control while solving
 * a daily puzzle surfaces the KI-Tipps overlay populated with move suggestions.
 */
test.describe('Daily Puzzle: engine hints / move suggestions (browser)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`));
    helper = new E2EHelper(page);
    // `e2e` forces the shallow tutor budget. Without it a full-depth hint
    // search can outlive this test on a busy CI runner.
    await helper.goto('e2e');
  });

  test('hint control surfaces engine move suggestions during a daily puzzle', async ({ page }) => {
    test.setTimeout(60000);
    await helper.startGame('daily-puzzle');

    // Today's position is already on the board. The catalog stays closed.
    await expect(page.locator('#puzzle-menu-overlay')).toBeHidden();
    await expect(page.locator('#puzzle-overlay')).toBeVisible();

    // Board must render a real position (not blank) and be in a puzzle play state.
    await expect(page.locator('.cell[data-piece]').first()).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(
      () =>
        (window as unknown as { game?: { mode?: string } }).game &&
        ((window as unknown as { game: { mode: string } }).game.mode === 'puzzle' ||
          (window as unknown as { game: { mode: string } }).game.mode === 'daily-puzzle')
    );

    // DOM click: the puzzle panel can cover the action bar, and a window-level
    // keydown never reaches the document listener that presses #hint-btn.
    await domClick(page, '#hint-btn');

    // The KI-Tipps overlay must appear and list at least one move suggestion.
    const tutorOverlay = page.locator('#tutor-overlay');
    await expect(tutorOverlay).toBeVisible({ timeout: 30000 });
    await expect(tutorOverlay).not.toHaveClass(/hidden/);

    const hintsBody = page.locator('#tutor-hints-body');
    await expect(hintsBody).toBeVisible();
    // At least one suggestion child rendered (move rows).
    await expect
      .poll(async () => await hintsBody.locator('> *').count(), { timeout: 20000 })
      .toBeGreaterThan(0);
  });
});
