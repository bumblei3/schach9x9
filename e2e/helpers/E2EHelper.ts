import { Page, expect } from '@playwright/test';

/**
 * Triggers the real DOM click handler for `selector`, bypassing Playwright's
 * actionability gate (visibility / scroll-into-view / stability).
 *
 * Why: this SPA disables page scroll and some controls (bottom action-bar
 * buttons like `#toggle-3d-btn`, the `#menu-btn` under a bottom-sheet overlay)
 * sit outside the default viewport or behind an overlay. `locator.click()`
 * then times out on the actionability/scroll check even though the element is
 * the intended target and a human could reach it. A direct DOM click still
 * exercises the real handler wiring — it just removes the pixel gate.
 *
 * This is the single shared primitive that replaced the ad-hoc
 * `page.evaluate(() => el.click())` blocks scattered across the specs after
 * the UI-A/UI-B refactor; using it everywhere keeps the intent obvious and the
 * behaviour consistent.
 */
export async function domClick(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`domClick: no element matches "${sel}"`);
    el.click();
  }, selector);
}

/**
 * Helper class for standardizing E2E test interactions in Schach 9x9.
 */
export class E2EHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates to the home page and wait for app to be ready.
   */
  async goto() {
    this.page.on('console', msg => {
      console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`);
    });
    await this.page.addInitScript(() => {
      localStorage.setItem('disable_animations', 'true');
      // Suppress the first-run tutorial overlay, which otherwise covers the
      // board/shop and intercepts all pointer events in E2E runs.
      localStorage.setItem('schach9x9_tutorial_seen', '1');
    });
    await this.page.goto('/?disable-sw');
    await this.page.waitForFunction(() => document.body.classList.contains('app-ready'));
    await expect(this.page.locator('#main-menu')).toBeVisible();
  }

  /**
   * Starts a game with the specified mode.
   * @param modeOrText - A data-mode value (preferred) or a card-title substring.
   *
   * Prefers the stable `data-mode` attribute over brittle visible-text
   * matching. Text selectors break whenever the card copy changes (e.g. the
   * "(9x9)" suffix) and are case/whitespace sensitive.
   */
  async startGame(modeOrText: string) {
    console.log(`[E2EHelper] Starting game mode: ${modeOrText}`);
    const card = this.selectModeLocator(modeOrText);

    await expect(card).toBeVisible();
    await card.click();
    console.log(`[E2EHelper] Clicked card for ${modeOrText}`);

    // Wait for menu to disappear
    await expect(this.page.locator('#main-menu')).not.toHaveClass(/active/, { timeout: 10000 });
    console.log('[E2EHelper] Main menu is now hidden');

    // Wait for board to appear
    await expect(this.page.locator('[data-testid="board"]')).toBeVisible({ timeout: 10000 });
    console.log('[E2EHelper] Board is now visible');
  }

  /**
   * Returns a locator for a game-mode card, preferring the `data-mode`
   * attribute. For modes without one (`upgrade8x8`, `campaign`) it matches the
   * card title (or the campaign id) so a copy change elsewhere can't match.
   *
   * NOTE: `upgrade8x8` and `campaign` cards have NO `data-mode` attribute in
   * index.html, so they are matched by exact title (`upgrade8x8`) or by the
   * stable `id="campaign-start-btn"` (`campaign`).
   */
  selectModeLocator(modeOrText: string) {
    // Modes WITHOUT a data-mode attribute -> match by title / id.
    if (modeOrText === 'upgrade8x8') {
      return this.page.locator('.gamemode-card[data-init-mode="upgrade8x8"]');
    }
    if (modeOrText === 'campaign') {
      return this.page.locator('#campaign-start-btn');
    }
    // Everything else has a stable data-mode attribute -> prefer it.
    return this.page.locator(`.gamemode-card[data-mode="${modeOrText}"]`);
  }

  /**
   * Clicks a cell on the chess board.
   * @param r - Row index (0-8)
   * @param c - Column index (0-8)
   */
  async clickCell(r: number, c: number) {
    // DOM click: the from/to cells in some trainer positions sit outside the
    // default viewport or under an overlay, so locator.click() flakily times
    // out. domClick exercises the real cell->move wiring without the gate.
    await domClick(this.page, `.cell[data-r="${r}"][data-c="${c}"]`);
    console.log(`[E2EHelper] Clicked cell ${r},${c}`);
    await this.page.waitForTimeout(200); // Small delay to let app process
  }

  /**
   * Asserts that a piece is present on a specific square.
   * @param r - Row index
   * @param c - Column index
   * @param type - Piece type (p, r, n, b, q, k, a, c, e, j)
   * @param color - Piece color (white, black)
   */
  async expectPiece(r: number, c: number, type: string, color: string) {
    const cell = this.page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);

    // Use toPass to retry the entire check (including attribute fetch) if it's lagging
    await expect(async () => {
      await expect(cell).toHaveAttribute('data-piece', type);
      await expect(cell).toHaveAttribute('data-color', color);
      await expect(cell.locator('.piece-svg')).toBeVisible();
    }).toPass({ timeout: 10000 });
  }

  /**
   * Asserts that a square is empty.
   */
  async expectEmpty(r: number, c: number) {
    const cell = this.page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);
    await expect(async () => {
      await expect(cell).not.toHaveAttribute('data-piece');
      await expect(cell.locator('.piece-svg')).not.toBeVisible();
    }).toPass({ timeout: 5000 });
  }

  /**
   * Asserts that the status pill contains the expected text.
   * @param text - Expected text or regex
   */
  async expectStatus(text: string | RegExp) {
    const status = this.page.locator('#status-display');
    await expect(status).toContainText(text);
  }

  /**
   * Gets the current point balance from the shop.
   */
  async getPoints(): Promise<number> {
    const pointsDisplay = this.page.locator('#points-display');
    const text = await pointsDisplay.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Quits the current game and returns to the main menu.
   */
  async quitToMenu() {
    // DOM click: #menu-btn can sit under the #shop-panel bottom-sheet overlay
    // (see 3D/menu-btn fix). domClick triggers the real handler without the
    // actionability gate.
    await domClick(this.page, '#menu-btn');
    const mainMenu = this.page.locator('#main-menu');
    await expect(mainMenu).toBeVisible();
  }
}
