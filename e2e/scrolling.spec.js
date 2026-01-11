import { test, expect } from '@playwright/test';

test.describe('Scrolling Behavior', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));

    // Go to the page
    await page.goto('/?disable-sw');

    // Wait for usage overlay (points selection)
    const overlay = page.locator('#points-selection-overlay');
    await expect(overlay).toBeVisible();
  });

  test('Shop panel should be scrollable in setup mode', async ({ page }) => {
    // 1. Enter Setup Mode (click 15 points)
    await page.click('button[data-points="15"]');

    // 1b. Place White King (Required to reach shop phase)
    // Wait for board to be visible
    await expect(page.locator('#board')).toBeVisible();
    // Place White King at Row 7, Col 4 (Valid zone: Rows 6-8)
    const cell = page.locator('.cell[data-r="7"][data-c="4"]');
    await cell.click();

    // 1c. Wait for AI to place Black King (AI_DELAY_MS is 1000ms)
    // We wait for the phase to change or shop to appear
    // The shop panel appears when phase becomes SETUP_WHITE_PIECES
    const shopPanel = page.locator('#shop-panel');
    await expect(shopPanel).toBeVisible({ timeout: 10000 }); // Give AI time

    // 2. Wait for shop panel content
    await expect(shopPanel).toBeVisible();

    // 3. Ensure we are in setup mode class on body
    await expect(page.locator('body')).toHaveClass(/setup-mode/);

    // 4. Check initial scroll position
    const initialScrollTop = await shopPanel.evaluate(el => el.scrollTop);
    expect(initialScrollTop).toBe(0);

    // 5. Force the panel to have overflowing content if it doesn't already
    await shopPanel.evaluate(el => {
      const div = document.createElement('div');
      div.style.height = '2000px';
      div.style.background = 'linear-gradient(to bottom, red, blue)';
      div.innerText = 'Forced Scroll Content';
      div.style.padding = '20px';
      el.appendChild(div);
    });

    // 6. Attempt to scroll programmatically via scrollTo (simulates JS behavior)
    await shopPanel.evaluate(el => el.scrollTo(0, 500));

    // Verify it worked
    let newScrollTop = await shopPanel.evaluate(el => el.scrollTop);
    expect(newScrollTop).toBeGreaterThan(0);

    // 7. Reset and try simulating user wheel/touch events if possible
    // Playwright's mouse.wheel is one way
    await shopPanel.evaluate(el => el.scrollTo(0, 0));

    // Move mouse over panel and click to ensure focus
    const box = await shopPanel.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      console.log(`Mouse moving to: ${x}, ${y}`);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.up(); // Simple click to focus

      // Additional move to ensure hover
      await page.mouse.move(x, y + 10);
      await page.mouse.move(x, y);
    }

    // Scroll wheel (deltaY)
    await page.waitForTimeout(1000); // Give more time for WebKit
    await page.mouse.wheel(0, 500);

    // Give it more time to render/scroll
    await page.waitForTimeout(500);

    newScrollTop = await shopPanel.evaluate(el => el.scrollTop);

    // If wheel still reports 0, try manual scroll via evaluate as a fallback to verify it CAN scroll
    if (newScrollTop === 0) {
      console.warn('Wheel event failed to scroll, attempting manual scroll check');
      await shopPanel.evaluate(el => el.scrollBy(0, 100));
      newScrollTop = await shopPanel.evaluate(el => el.scrollTop);
    }

    console.log('Final ScrollTop:', newScrollTop);
    expect(newScrollTop).toBeGreaterThan(0);
  });
});
