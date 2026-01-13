import { test, expect } from '@playwright/test';
import { E2EHelper } from './helpers/E2EHelper.js';

test.describe('Setup Phase Tests', () => {
  let helper: E2EHelper;

  test.beforeEach(async ({ page }) => {
    helper = new E2EHelper(page);
    await helper.goto();
  });

  test('should start setup mode and show king placement', async ({ page: _page }) => {
    await helper.startGame('setup');

    // Verify status shows king placement
    await helper.expectStatus(/Wähle einen Platz für deinen König|Wähle einen Korridor/i);

    // Verify points are available
    const points = await helper.getPoints();
    expect(points).toBe(25);

    // Verify board is 9x9
    const cells = _page.locator('.cell');
    await expect(cells).toHaveCount(81);
  });
});
