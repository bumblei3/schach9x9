import { test, expect } from '@playwright/test';

test.describe('Tutorial @tutorial', () => {
  test.beforeEach(async ({ page }) => {
    // Disable AI Mentor
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });

    // Go to home
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
    await page.evaluate(() => {
      // Force the Learn view to be active or click the tab
      // But since we are on main menu, we probably need to switch tab to verify learn view logic?
      // Or is the tutorial button visible on Play view?
      // Index.html shows: view-play is active by default.
      // The Tutorial card is in #view-learn.
      // So we need to switch tabs first!
    });
  });

  test('should complete the interactive tutorial', async ({ page }) => {
    // 1. Switch to "Lernen" tab
    const learnTab = page.locator('.menu-tab-btn[data-tab="learn"]');
    await expect(learnTab).toBeVisible();
    await learnTab.click();

    // 2. Click "Interaktives Tutorial" using ID
    const tutorialBtn = page.locator('#start-tutorial-btn');
    await expect(tutorialBtn).toBeVisible();
    await tutorialBtn.click();

    // 3. Verify Overlay
    const overlay = page.locator('#tutorial-overlay');
    await expect(overlay).toBeVisible();

    // 4. Step through tutorial
    const nextBtn = page.locator('#tutorial-next');
    const totalStepsEl = page.locator('#tutorial-total-steps');
    const totalSteps = await totalStepsEl.textContent();
    const stepsCount = parseInt(totalSteps || '0');

    for (let i = 0; i < stepsCount; i++) {
      console.log(`Step ${i + 1}/${stepsCount}`);
      // Check content visible
      const currentStep = overlay.locator('.tutorial-step.active');
      await expect(currentStep).toBeVisible();

      // Check if button is visible
      await expect(nextBtn).toBeVisible();

      // Determine if this is the last step
      const isLastStep = i === stepsCount - 1;

      if (isLastStep) {
        await expect(nextBtn).toHaveText(/Fertig/i);
        await nextBtn.evaluate((btn: HTMLElement) => btn.click());
      } else {
        await nextBtn.evaluate((btn: HTMLElement) => btn.click());
        // Wait for next step content to appear to avoid clicking too fast
        // The next step should become active
        // We don't know the content of next step easily without index,
        // but we can wait for the previous one to disappear or just short delay
        await page.waitForTimeout(300);
      }
    }

    // 5. Verify Tutorial Closes
    await expect(overlay).toBeHidden();
  });
});
