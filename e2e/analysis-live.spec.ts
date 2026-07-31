import { test, expect } from '@playwright/test';
import { domClick } from './helpers/E2EHelper.js';

/**
 * Live engine analysis mode (the in-game "Analyse-Modus" overlay).
 *
 * Verified end to end against the built app:
 *   - start a classic game (app.init), reaching PHASES.PLAY
 *   - click #analysis-mode-btn (enterAnalysisMode) -> panel visible, analysisMode=true
 *   - click #continuous-analysis-btn (requestPositionAnalysis) -> worker returns
 *     topMoves -> #top-moves-content filled + a board arrow (.tutor-arrow) drawn
 *
 * The pipeline was broken by several bugs (stale game ref in
 * AnalysisController, IntBoard instead of UiBoard sent to the worker,
 * worker returning SearchResult instead of topMoves[], an unbounded
 * analysis search that never posted back, the live AnalysisUI never
 * wired to AIController so render was skipped, and the best-move
 * arrow guarded behind a flag that was never set). All fixed; see the
 * PR for the full list.
 */
test.describe('Live engine analysis mode', () => {
  test('entering analysis mode shows engine top moves + arrows on the board', async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));

    await page.addInitScript(() => {
      localStorage.setItem('disable_animations', 'true');
      localStorage.setItem('schach9x9_tutorial_seen', '1');
    });
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    // Start a real game the way the classic-mode button does.
    await page.evaluate(async () => {
      const w = window as unknown as { app: { init: (p: number, m: string) => Promise<void> } };
      await w.app.init(0, 'classic');
    });
    await expect(page.locator('#main-menu')).not.toHaveClass(/active/, { timeout: 10000 });
    await expect(page.locator('[data-testid="board"]')).toBeVisible({ timeout: 10000 });

    // Enter analysis mode.
    await domClick(page, '#analysis-mode-btn');
    const panel = page.locator('#analysis-panel');
    await expect(panel).not.toHaveClass(/hidden/, { timeout: 10000 });

    // Request continuous analysis (triggers the worker).
    await domClick(page, '#continuous-analysis-btn');

    // Engine top moves must render in the panel.
    const topMoves = page.locator('#top-moves-content');
    await expect(async () => {
      const html = (await topMoves.innerHTML()) || '';
      expect(html).toContain('top-move-item');
    }).toPass({ timeout: 30000 });

    // The engine's best move is drawn as a board arrow (.tutor-arrow SVG
    // path). Continuous analysis re-draws it each tick, so retry. We assert
    // on the arrow's geometry (a non-degenerate <path d="...">) instead of
    // toBeVisible(): a vertical/horizontal best-move arrow has a zero-width
    // bounding box, which Playwright's visibility heuristic can flag as
    // "hidden" even though it renders for the user — a flaky false negative
    // seen on CI. Checking for an actual drawn line is the robust signal.
    const arrow = page.locator('.tutor-arrow').first();
    await expect(async () => {
      const d = await arrow.getAttribute('d');
      expect(d).toBeTruthy();
      // Require a line with two distinct endpoints (M x y L x y).
      const m = /^M\s+([\d.]+)\s+([\d.]+)\s+L\s+([\d.]+)\s+([\d.]+)$/.exec(d ?? '');
      expect(m).not.toBeNull();
      if (m) {
        const [, x1, y1, x2, y2] = m;
        const dx = Math.abs(parseFloat(x2) - parseFloat(x1));
        const dy = Math.abs(parseFloat(y2) - parseFloat(y1));
        // Non-degenerate: at least one axis spans more than a pixel.
        expect(dx + dy).toBeGreaterThan(1);
      }
    }).toPass({ timeout: 30000 });

    logs
      .filter((l) => /error/i.test(l) && !/404|Failed to load resource/.test(l))
      .slice(-10)
      .forEach((l) => console.log('PAGE_ERR> ' + l));
  });
});
