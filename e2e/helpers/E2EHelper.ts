import { Page, expect } from '@playwright/test';

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
    });
    await this.page.goto('/?disable-sw');
    await this.page.waitForFunction(() => document.body.classList.contains('app-ready'));
    await expect(this.page.locator('#main-menu')).toBeVisible();
  }

  /**
   * Starts a game with the specified mode.
   * @param modeOrText - Either the data-mode value or the visible text.
   */
  async startGame(modeOrText: string) {
    console.log(`[E2EHelper] Starting game mode: ${modeOrText}`);
    const cardByMode = this.page.locator(`.gamemode-card[data-mode="${modeOrText}"]`);
    const cardByText = this.page.locator('.gamemode-card').filter({ hasText: modeOrText });

    // Check which one exists
    let card;
    if ((await cardByMode.count()) > 0) {
      card = cardByMode;
    } else if ((await cardByText.count()) > 0) {
      card = cardByText;
    } else {
      throw new Error(`[E2EHelper] Could not find gamemode card for: ${modeOrText}`);
    }

    await expect(card).toBeVisible();
    await card.click();
    console.log(`[E2EHelper] Clicked card for ${modeOrText}`);

    // Wait for menu to disappear
    await expect(this.page.locator('#main-menu')).not.toHaveClass(/active/, { timeout: 10000 });
    console.log(`[E2EHelper] Main menu is now hidden`);

    // Wait for board to appear
    await expect(this.page.locator('[data-testid="board"]')).toBeVisible({ timeout: 10000 });
    console.log(`[E2EHelper] Board is now visible`);
  }

  /**
   * Clicks a cell on the chess board.
   * @param r - Row index (0-8)
   * @param c - Column index (0-8)
   */
  async clickCell(r: number, c: number) {
    const cell = this.page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);
    await expect(cell).toBeVisible();
    await cell.click();
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
    const menuBtn = this.page.locator('#menu-btn');
    await menuBtn.click();
    const mainMenu = this.page.locator('#main-menu');
    await expect(mainMenu).toBeVisible();
  }
}
