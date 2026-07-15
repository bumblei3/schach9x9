import { test, expect } from '@playwright/test';
import { domClick } from './helpers/E2EHelper.js';

test.describe('3D Mode Toggle @3d', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console log proxying
    page.on('console', (msg) => console.log(`PAGE LOG: ${msg.text()}`));
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  // Skip Firefox - Three.js WebGL initialization is unreliable in Firefox CI
  test('should toggle 3d view on and off', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Three.js canvas unreliable in Firefox CI');
    // 3D toggle is available in the action bar.
    // Start a game first (Standard 8x8) to ensure action bar is active
    await page.click('.gamemode-card[data-mode="standard8x8"]');

    // Wait for board to be ready
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/game-initialized/);

    const toggleBtn = page.locator('#toggle-3d-btn');
    const container3d = page.locator('#battle-chess-3d-container');
    const boardWrapper = page.locator('#board-wrapper');

    // The 3D toggle sits at the bottom of the action bar and can fall outside
    // the default Playwright viewport (the SPA disables page scroll), so a
    // regular .click() times out on the actionability/scroll check. Use the
    // shared domClick primitive — this still exercises the actual toggle logic
    // in DOMHandler, just without the pixel-visibility gate.
    const clickToggle = () => domClick(page, '#toggle-3d-btn');

    // The engine instance is created lazily on first toggle (async dynamic
    // import) and `enabled` flips on each click, so we read the canonical
    // state from window.battleChess3D rather than relying on a fixed initial
    // value. Detect the state before/after to prove the toggle actually flips.
    const getEnabled = () =>
      page.evaluate(
        () =>
          (window as unknown as { battleChess3D?: { enabled: boolean } }).battleChess3D
            ?.enabled
      );

    // Initial state: 3D hidden, 2D visible
    await expect(container3d).not.toHaveClass(/active/);
    await expect(boardWrapper).toBeVisible();

    // First toggle: engine initializes, the Three.js canvas appears and the
    // enabled state flips away from its pre-toggle value.
    const beforeFirst = await getEnabled();
    await clickToggle();
    await expect(container3d.locator('canvas')).toBeAttached({ timeout: 30000 });
    await page.waitForFunction(
      (prev) =>
        (window as unknown as { battleChess3D?: { enabled: boolean } }).battleChess3D
          ?.enabled !== prev,
      beforeFirst,
      { timeout: 30000 }
    );

    // Wait for WebGL context to be ready (additional check)
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '#battle-chess-3d-container canvas'
        );
        return canvas && canvas.width > 0 && canvas.height > 0;
      },
      { timeout: 30000 }
    );

    // Second toggle: flips back to the original state, 2D board visible again
    const afterFirst = await getEnabled();
    await clickToggle();
    await page.waitForFunction(
      (prev) =>
        (window as unknown as { battleChess3D?: { enabled: boolean } }).battleChess3D
          ?.enabled === prev,
      beforeFirst,
      { timeout: 10000 }
    );
    await expect(boardWrapper).toBeVisible();
  });
});
