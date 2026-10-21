import { test, expect } from '@playwright/test';
import { E2EHelper, domClick } from './helpers/E2EHelper.js';

/**
 * Post-game and settings features that had no E2E coverage at all:
 *
 *   1. PGN export (#export-pgn-btn, in-game action bar)
 *   2. Sound settings persistence (#sound-toggle / #volume-slider)
 *   3. Post-game replay overlay (#replay-overlay, accessed via analysis modal)
 *
 * Each button is reachable from the live UI (not the dead in-game menu that was
 * removed). The specs exercise the exact user path and lock that in.
 */

type PWPage = import('@playwright/test').Page;

/** Wait until the engine has produced a playable position. */
async function waitGame(page: PWPage) {
  await page.waitForFunction(
    () => (window as unknown as { game?: { phase?: string } }).game?.phase === 'PLAY',
    { timeout: 20000 }
  );
}

/** End the game (resign), then wait for the game-over overlay. */
async function endGame(page: PWPage) {
  await page.waitForFunction(
    () =>
      (window as unknown as { app?: { gameController?: unknown } }).app?.gameController != null,
    { timeout: 10000 }
  );
  await page.evaluate(() => {
    const app = (
      window as unknown as { app: { gameController: { resign: (c: string) => void } } }
    ).app;
    app.gameController.resign('white');
  });
  await expect(page.locator('#game-over-overlay')).toBeVisible({ timeout: 10000 });
}

async function playOneMove(helper: E2EHelper, page: PWPage) {
  await helper.clickCell(7, 4);
  await helper.clickCell(5, 4);
  await page.waitForFunction(
    () => ((window as unknown as { game?: { moveHistory?: unknown[] } }).game?.moveHistory?.length ?? 0) >= 2,
    { timeout: 30000 }
  );
}

test.describe('PGN export', () => {
  test('copies a well-formed PGN of the played game to the clipboard', async ({ page }) => {
    const helper = new E2EHelper(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __pgn?: string };
      const orig = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      if (orig) {
        navigator.clipboard.writeText = (t: string) => {
          w.__pgn = t;
          return orig(t);
        };
      }
    });

    await helper.goto();
    await helper.startGame('classic');
    await waitGame(page);
    await playOneMove(helper, page);
    // The button lives in the in-game action bar. Open the overflow menu first.
    await domClick(page, '#action-more-btn');
    await expect(page.locator('#export-pgn-btn')).toBeVisible();
    await domClick(page, '#export-pgn-btn');
    await page.waitForTimeout(500);

    const pgn = await page.evaluate(
      () => (window as unknown as { __pgn?: string }).__pgn ?? ''
    );
    expect(pgn).not.toBe('');
    expect(pgn).toContain('[Event "Schach 9x9 Game"]');
    expect(pgn).toMatch(/\[Result/);
    expect(pgn).toContain('1. e4');
    await expect(page.locator('#toast-container')).toContainText('Zwischenablage');
  });

  test('refuses to export when there are no moves', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();
    await helper.startGame('classic');
    await waitGame(page);
    await domClick(page, '#action-more-btn');
    await expect(page.locator('#export-pgn-btn')).toBeVisible();
    await domClick(page, '#export-pgn-btn');
    await page.waitForTimeout(300);
    await expect(page.locator('#toast-container')).toContainText('Keine Züge');
  });
});

test.describe('Sound settings persistence', () => {
  test('mute + volume survive a reload', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();

    const read = () =>
      page.evaluate(() => {
        const t = document.getElementById('sound-toggle') as HTMLInputElement | null;
        const v = document.getElementById('volume-slider') as HTMLInputElement | null;
        return {
          checked: t?.checked ?? null,
          disabled: v?.disabled ?? null,
          vol: v?.value ?? null,
          raw: localStorage.getItem('chess9x9-sound-settings'),
        };
      });

    await page.locator('#main-menu .menu-tab-btn[data-tab="settings"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#view-settings')).toBeVisible();

    expect(await read()).toEqual({ checked: true, disabled: false, vol: '30', raw: null });

    // Volume 75 while sound is still enabled. The slider is 0 x 0 (CSS-hidden);
    // Playwright's visibility-gated `fill()` cannot act on it, so set the value
    // directly and dispatch the real `input` event the handler listens to.
    await page.evaluate(() => {
      const v = document.getElementById('volume-slider') as HTMLInputElement | null;
      if (v) {
        v.value = '75';
        v.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Diagnostic removed: see the real assertion below (after the debounce).
      const vv = document.getElementById('volume-value');
      const saved = localStorage.getItem('chess9x9-sound-settings');
    });
    await page.waitForTimeout(500); // let the debounced save run
    const afterVolume = await read();
    expect(afterVolume.raw).toContain('0.75');

    // Mute: the real toggle is the label switch (the checkbox is 0 x 0).
    await page.locator('#view-settings label.toggle-switch').first().click();
    await page.waitForTimeout(250);
    const afterMute = await read();
    expect(afterMute.checked).toBe(false);
    expect(afterMute.disabled).toBe(true); // slider disabled while muted
    expect(afterMute.raw).toContain('0.75');

    // Survives a reload.
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
    await page.locator('#main-menu .menu-tab-btn[data-tab="settings"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#view-settings')).toBeVisible();
    const reloaded = await read();
    expect(reloaded.checked).toBe(false);
    expect(reloaded.vol).toBe('75');
  });
});

test('resign button ends the game', async ({ page }) => {
  const helper = new E2EHelper(page);
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.accept(); // accept "Wirklich aufgeben?" so the resign proceeds
  });

  await helper.goto();
  await helper.startGame('classic');
  await waitGame(page);

  // The in-game action bar (with the overflow menu) only renders after the
  // player has made a move.
  await playOneMove(helper, page);
  await page.locator('#action-more-btn').click();
  await expect(page.locator('#resign-btn')).toBeVisible();
  await page.locator('#resign-btn').click();
  await expect(page.locator('#game-over-overlay')).toBeVisible({ timeout: 10000 });
  expect(dialogs.some((m) => /Wirklich aufgeben/.test(m))).toBe(true);
});

test('draw offer keeps the game running without crashing', async ({ page }) => {
  const helper = new E2EHelper(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await helper.goto();
  await helper.startGame('classic');
  await waitGame(page);
  await playOneMove(helper, page);

  await page.locator('#action-more-btn').click();
  await expect(page.locator('#draw-offer-btn')).toBeVisible();
  await page.locator('#draw-offer-btn').click();

  // vs AI the offer is registered and the engine evaluates; the board must stay
  // alive and no game-over overlay may appear (that would mean the engine died).
  await expect(page.locator('#game-over-overlay')).not.toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#game-over-overlay')).not.toBeVisible({ timeout: 5000 });
  expect(errors).toEqual([]);
});

test.describe('Post-game replay overlay', () => {
  test('opens from the analysis modal and steps through the game', async ({ page }) => {
    const helper = new E2EHelper(page);
    await helper.goto();
    await helper.startGame('classic');
    await waitGame(page);
    await playOneMove(helper, page);
    await endGame(page);

    await page.locator('#postgame-analysis-btn').click();
    await expect(page.locator('#modal-actions button', { hasText: 'Partie durchsehen' })).toBeVisible();
    await page.locator('#modal-actions button', { hasText: 'Partie durchsehen' }).click();

    const overlay = page.locator('#replay-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).not.toHaveClass(/hidden/);

    const step = page.locator('#replay-step-number');
    await expect(step).toContainText('1 / 2');
    await domClick(page, '#replay-next-btn');
    await expect(step).toContainText('2 / 2');
    await domClick(page, '#replay-prev-btn');
    await expect(step).toContainText('1 / 2');
    await domClick(page, '#replay-close-btn');
    await expect(overlay).toBeHidden();
  });
});
