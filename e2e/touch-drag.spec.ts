import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * Touch-Drag ist eine beworbene Faehigkeit der README ("Touch-Drag-Support")
 * und in `BoardRenderer` implementiert (touchstart/-move/-end), aber kein
 * einziger Spec aeufert eine Beruehrungsgeste. Dieser Spec deckt die drei
 * Grundfaenge ab: Ziehen ausloest den Zug, Ziel hilft nur bei legalem Zielfeld,
 * ein Tippen ohne Bewegung tut nichts.
 *
 * Die Gesten ueber CDP (`Input.dispatchTouchEvent`) statt `page.touchscreen`,
 * weil das Touch-Ereignis mit `touches`-Listen erst so die Zelle erreicht, wie
 * es ein Geraet schickt.
 */
test.describe('Touch-Zug per Drag @touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  async function zentrum(page: import('@playwright/test').Page, r: number, c: number) {
    const box = await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).boundingBox();
    if (!box) throw new Error(`Zelle ${r},${c} nicht messbar`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  // Eine Geste = eine CDP-Sitzung. Jede neue Sitzung vergisst denTouch-Zustand
  // ("Must send a TouchStart first"), deshalb wird die Sitzung gehalten.
  async function mitBeruehrung(
    page: import('@playwright/test').Page,
    geste: Array<{ typ: 'touchStart' | 'touchMove' | 'touchEnd'; x: number; y: number }>
  ) {
    const client = await page.context().newCDPSession(page);
    for (const schritt of geste) {
      await client.send('Input.dispatchTouchEvent', {
        type: schritt.typ,
        touchPoints: schritt.typ === 'touchEnd' ? [] : [{ x: schritt.x, y: schritt.y }],
      });
      await page.waitForTimeout(120);
    }
  }

  async function startePartie(page: import('@playwright/test').Page) {
    const helper = new E2EHelper(page);
    await helper.goto();
    await helper.startGame('classic');
  }

  test('Drag von e2 nach e4 setzt den Bauern', async ({ page }) => {
    await startePartie(page);
    const von = await zentrum(page, 7, 4);
    const nach = await zentrum(page, 5, 4);

    await mitBeruehrung(page, [
      { typ: 'touchStart', x: von.x, y: von.y },
      { typ: 'touchMove', x: (von.x + nach.x) / 2, y: (von.y + nach.y) / 2 },
      { typ: 'touchMove', x: nach.x, y: nach.y },
      { typ: 'touchEnd', x: nach.x, y: nach.y },
    ]);
    await page.waitForTimeout(600);

    const stand = await page.evaluate(() => ({
      bauerAufE4: document
        .querySelector('.cell[data-r="5"][data-c="4"]')
        ?.getAttribute('data-piece'),
      moves: (window as unknown as { game?: { moveHistory?: unknown[] } }).game?.moveHistory?.length ?? 0,
    }));
    expect(stand.bauerAufE4).toBe('p');
    expect(stand.moves).toBe(1);
  });

  test('Drag auf ein illegales Feld tut nichts', async ({ page }) => {
    await startePartie(page);
    const von = await zentrum(page, 7, 4);
    const nach = await zentrum(page, 4, 4); // Bauer darf nicht drei Felder

    await mitBeruehrung(page, [
      { typ: 'touchStart', x: von.x, y: von.y },
      { typ: 'touchMove', x: nach.x, y: nach.y },
      { typ: 'touchEnd', x: nach.x, y: nach.y },
    ]);
    await page.waitForTimeout(500);

    const moves = await page.evaluate(
      () => (window as unknown as { game?: { moveHistory?: unknown[] } }).game?.moveHistory?.length ?? 0
    );
    expect(moves).toBe(0);
  });

  test('Tippen ohne Bewegung setzt nichts', async ({ page }) => {
    await startePartie(page);
    const feld = await zentrum(page, 7, 4);

    await mitBeruehrung(page, [
      { typ: 'touchStart', x: feld.x, y: feld.y },
      { typ: 'touchEnd', x: feld.x, y: feld.y },
    ]);
    await page.waitForTimeout(500);

    const moves = await page.evaluate(
      () => (window as unknown as { game?: { moveHistory?: unknown[] } }).game?.moveHistory?.length ?? 0
    );
    expect(moves).toBe(0);
  });
});
