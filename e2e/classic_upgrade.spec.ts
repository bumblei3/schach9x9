import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Classic 9x9 Upgrade Mode', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('should start with correct pieces and upgrade points', async ({ page }) => {
    await helper.startGame('upgrade');

    // Verify Archbishop and Chancellor
    await helper.expectPiece(8, 3, 'a', 'white');
    await helper.expectPiece(8, 5, 'c', 'white');

    // Verify points
    const points = await helper.getPoints();
    expect(points).toBe(15);

    // Verify state
    await helper.expectStatus(/Klicke eine Figur für Upgrades/i);
    await expect(page.locator('#selected-piece-display')).toHaveText(
      'Dame zum Engel 3, Läufer zum Erzbischof 4, Bauer zum Engel 11. Klicke eine Figur auf dem Brett.'
    );
  });
});
