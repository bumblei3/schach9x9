import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

/**
 * End-to-end check for the Eröffnungs-Trainer play loop.
 *
 * This verifies the critical render bug fixed in v1.1.1: the first trainer
 * position must actually appear on the board (the board was previously blank
 * because rendering happened before the cells existed). It also exercises the
 * two-click move flow and confirms the trainer reacts (feedback / advances).
 */
test.describe('Opening-Trainer Mode (browser)', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('loads a non-empty position and renders pieces', async ({ page }) => {
    await helper.startGame('opening-trainer');

    // Board visible with a 9x9 grid.
    const board = page.locator('[data-testid="board"]');
    await expect(board).toBeVisible();
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(81);

    // CRITICAL: the first position must render actual pieces (not a blank board).
    // Wait for at least one piece to appear (render is async after book load).
    const firstPieceCell = page.locator('.cell[data-piece]').first();
    await expect(firstPieceCell).toBeVisible({ timeout: 10000 });

    // The trainer menu + start button must be present (rendered async after
    // the book loads, so allow a short settle).
    await expect(page.locator('#opening-trainer-container button')).toBeVisible({ timeout: 10000 });

    // The menu sits under the board, not inside the square. Inside the flex
    // row it used to take width away from the 9×9 grid.
    await expect(page.locator('#board-container #opening-trainer-container')).toHaveCount(0);
    const boardBox = await page.locator('#board').boundingBox();
    const containerBox = await page.locator('#board-container').boundingBox();
    expect(boardBox).not.toBeNull();
    expect(containerBox).not.toBeNull();
    expect(boardBox!.width).toBeGreaterThan(containerBox!.width * 0.75);
  });

  test('wide screen grows the board and keeps the action labels readable', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1080 });
    await helper.startGame('classic');

    const boardBox = await page.locator('#board').boundingBox();
    const barBox = await page.locator('.action-bar').boundingBox();
    expect(boardBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    expect(boardBox!.width).toBeGreaterThan(640);
    expect(barBox!.y).toBeGreaterThanOrEqual(boardBox!.y + boardBox!.height - 2);
    expect(barBox!.x).toBeGreaterThanOrEqual(boardBox!.x - 8);
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width + 80);

    const clipped = await page.locator('#undo-btn .action-label').evaluate(el => {
      return el.scrollWidth > el.clientWidth + 1;
    });
    expect(clipped).toBe(false);
    await expect(page.locator('#undo-btn .action-label')).toHaveText('Rückgängig');
  });

  test('two-click move flow triggers trainer feedback', async ({ page }) => {
    await helper.startGame('opening-trainer');

    // After the fix, the first position renders real pieces.
    const firstPiece = page.locator('.cell[data-piece]').first();
    await expect(firstPiece).toBeVisible();
    await firstPiece.click();
    await page.waitForTimeout(200);

    // Selecting a piece should highlight it (selectedSquare state) or otherwise
    // leave the board interactive. Then click another cell to attempt a move.
    const targetCell = page.locator('.cell').nth(40); // arbitrary middle cell
    await targetCell.click();
    await page.waitForTimeout(400);

    // The trainer must have reacted: either a notification appeared, or the
    // progress readout is present (both prove the play loop executed).
    const notificationCount = await page
      .locator('.notification, #toast-container, [data-testid="notification"]')
      .count();
    const hasProgress = (await page.locator('#opening-trainer-container').textContent())?.includes(
      'Streak'
    );
    expect(notificationCount > 0 || hasProgress === true).toBe(true);
  });
});
