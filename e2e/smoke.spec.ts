import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Smoke tests — the fast "does the app catch fire?" layer.
 *
 * Unlike the detailed feature specs, these do the minimum per game mode:
 *   1. app boots (app-ready)
 *   2. the mode starts and the board renders with cells
 *   3. no uncaught JS errors / no console errors fire during boot+start
 *   4. for play modes: at least one piece is actually on the board
 *      (a direct regression guard for the "blank board" wiring bug, where
 *       green unit tests passed but the board rendered empty in the browser)
 *
 * Kept deliberately shallow and broad so a single run tells us whether the
 * whole app is wired together, before the deeper specs dig into behaviour.
 */

// Every selectable game mode from the main menu (index.html data-mode="...").
const ALL_MODES = [
  'classic',
  'setup',
  'upgrade',
  'cross',
  'standard8x8',
  'puzzle',
  'opening-trainer',
  'daily-puzzle',
] as const;

// Modes that drop you straight into a populated board (pieces present).
// setup/cross start in the placement phase with an intentionally empty board,
// so they are excluded from the piece-presence check.
const PLAY_MODES = new Set(['classic', 'upgrade', 'standard8x8']);

/**
 * Attach console/error collectors and boot the app to the main menu with a
 * clean, deterministic environment (AI mocked, animations/3D off), mirroring
 * the setup the feature specs rely on.
 */
async function bootToMenu(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Ignore network resource-load failures (missing favicon/optional assets,
    // service-worker fetches); we only care about real JS/app errors here.
    if (/Failed to load resource/i.test(text)) return;
    errors.push(`CONSOLE ERROR: ${text}`);
  });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  await page.addInitScript(() => {
    localStorage.setItem('ki_mentor_level', 'OFF');
    localStorage.setItem('disable_animations', 'true');
    localStorage.setItem('enable_3d', 'false');
    window.addEventListener('unhandledrejection', event => {
      // Suppressed intentionally; we only assert on console/page errors.
      event.preventDefault();
    });
  });

  // Keep the 3D container from intercepting clicks.
  await page.addStyleTag({ content: '#battle-chess-3d-container { display: none !important; }' });

  await page.goto('/?disable-sw');

  await page.waitForFunction(
    () => document.body.classList.contains('app-ready') && (window as any).app !== undefined
  );

  // Neutralise the AI engine so smoke runs stay fast and deterministic.
  await page.evaluate(() => {
    const app = (window as any).app;
    if (!app.aiEngine) app.aiEngine = {};
    app.aiEngine.getBestMoveDetailed = async () => ({ bestMove: { from: 0, to: 0 }, score: 0 });
    app.aiEngine.evaluatePosition = async () => 0;
    app.aiEngine.getBestMove = async () => ({ from: 0, to: 0 });
    if (app.tutorController) {
      app.tutorController.getTutorHints = async () => {};
      app.tutorController.updateHints = async () => {};
    }
  });

  await expect(page.locator('#main-menu')).toBeVisible();
  return errors;
}

test.describe('Smoke: app boots to menu', () => {
  test('main menu renders with all game-mode cards', async ({ page }) => {
    const errors = await bootToMenu(page);

    for (const mode of ALL_MODES) {
      await expect(page.locator(`.gamemode-card[data-mode="${mode}"]`)).toBeVisible();
    }

    expect(errors, `Console/page errors during boot:\n${errors.join('\n')}`).toHaveLength(0);
  });
});

test.describe('Smoke: each mode starts with a rendered board', () => {
  for (const mode of ALL_MODES) {
    test(`mode "${mode}" opens a board without errors`, async ({ page }) => {
      const errors = await bootToMenu(page);

      await page.click(`.gamemode-card[data-mode="${mode}"]`);

      // Board container becomes visible and is populated with cells.
      await expect(page.locator('#board')).toBeVisible();
      await expect(page.locator('.cell').first()).toBeVisible({ timeout: 15000 });
      const cellCount = await page.locator('.cell').count();
      expect(cellCount, `mode "${mode}" rendered no board cells`).toBeGreaterThan(0);

      // Play modes must show pieces — the blank-board regression guard.
      if (PLAY_MODES.has(mode)) {
        await expect(
          page.locator('.piece-svg').first(),
          `mode "${mode}" rendered a blank board (no pieces)`
        ).toBeVisible({ timeout: 15000 });
      }

      expect(
        errors,
        `Console/page errors while starting "${mode}":\n${errors.join('\n')}`
      ).toHaveLength(0);
    });
  }
});
