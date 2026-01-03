import { test, expect } from '@playwright/test';

test('Shop template selection works at 18 points', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Select 18 points mode
  const pointsBtn = page.locator('.points-btn[data-points="18"]');
  await pointsBtn.click();

  // Wait for shop to appear
  await expect(page.locator('#shop-panel')).not.toHaveClass(/hidden/);

  // Place white king to trigger piece setup phase
  // Area 6,3 is valid for white king
  const kingSpot = page.locator('.cell[data-r="7"][data-c="4"]');
  await kingSpot.click();

  // Now we should be in setup phase and see templates
  const toggleBtn = page.locator('#toggle-tutor-recommendations');
  await expect(toggleBtn).toBeVisible();

  // Toggle recommendations if hidden
  if (await page.locator('#tutor-recommendations-container').isHidden()) {
    await toggleBtn.click();
  }

  const container = page.locator('#tutor-recommendations-container');
  await expect(container).toBeVisible();

  // Find "Der Schwarm" template
  const swarmTemplate = page.locator('.setup-template-card:has-text("Der Schwarm")');
  await expect(swarmTemplate).toBeVisible();

  // Mock confirm to auto-accept
  await page.on('dialog', dialog => dialog.accept());

  // Click the template
  await swarmTemplate.click();

  // Check if pieces are placed (points should be 0)
  const pointsDisplay = page.locator('#points-display');
  await expect(pointsDisplay).toHaveText('0');

  // Verify pieces on board (roughly)
  // Swarm 18 has 8 pieces + King = 9 pieces total with color white
  const whitePieces = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.piece.white')).length;
  });
  expect(whitePieces).toBe(9);
});
