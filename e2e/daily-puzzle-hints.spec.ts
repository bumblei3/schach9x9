import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

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
    await helper.goto();
  });

  test('hint control surfaces engine move suggestions during a daily puzzle', async ({ page }) => {
    await helper.startGame('daily-puzzle');

    // Daily puzzle first shows the puzzle menu; pick the first puzzle to enter PLAY.
    const puzzleMenu = page.locator('#puzzle-menu-overlay');
    await expect(puzzleMenu).toBeVisible({ timeout: 10000 });
    await page.locator('.puzzle-card').first().click();

    // Board must render a real position (not blank) and be in a puzzle play state.
    await expect(page.locator('.cell[data-piece]').first()).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(
      () =>
        (window as unknown as { game?: { mode?: string } }).game &&
        ((window as unknown as { game: { mode: string } }).game.mode === 'puzzle' ||
          (window as unknown as { game: { mode: string } }).game.mode === 'daily-puzzle')
    );

    // Trigger a hint. Prefer the visible button; fall back to the 'h' shortcut.
    const hintBtn = page.locator('#hint-btn');
    if (await hintBtn.isVisible().catch(() => false)) {
      await hintBtn.click();
    } else {
      await page.evaluate(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', bubbles: true })
        );
      });
    }

    // The KI-Tipps overlay must appear and list at least one move suggestion.
    const tutorOverlay = page.locator('#tutor-overlay');
    await expect(tutorOverlay).toBeVisible({ timeout: 20000 });
    await expect(tutorOverlay).not.toHaveClass(/hidden/);

    const hintsBody = page.locator('#tutor-hints-body');
    await expect(hintsBody).toBeVisible();
    // At least one suggestion child rendered (move rows).
    await expect
      .poll(async () => await hintsBody.locator('> *').count(), { timeout: 20000 })
      .toBeGreaterThan(0);
  });
});
