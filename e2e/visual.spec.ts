import { test, expect } from '@playwright/test';
import { domClick } from './helpers/E2EHelper.js';

test.describe('Visual Regression Tests @visual', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    page.on('pageerror', err => console.error(`PAGE ERROR: ${err.message}`));

    await page.goto('/?disable-sw');

    // Wait for initialize
    await page.waitForSelector('#board');

    // Wait for DOMHandler to attach listeners to avoid race condition
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));

    // Set a fixed viewport size to ensure visual stability and consistent dimensions
    await page.setViewportSize({ width: 1280, height: 720 });

    // Wait for fonts to be ready
    await page.evaluate(() => document.fonts.ready);
  });

  test('Main Board - Initial State', async ({ page }) => {
    // Take a screenshot of the initial board state
    // Note: Main menu might be covering it, but we want to capture the underlying board if possible
    // or capture the main menu itself as the initial state
    await expect(page.locator('#main-menu')).toBeVisible();

    await expect(page).toHaveScreenshot('main-menu-initial.png', {
      mask: [], // No dynamic content on main menu usually
      animations: 'disabled',
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Shop Panel - 25 Points (Hire Mode)', async ({ page }) => {
    // 1. Select Hire Mode
    const hireBtn = page.locator('.gamemode-card[data-mode="setup"]');
    await expect(hireBtn).toBeVisible();
    await hireBtn.click();

    // Wait for main menu to disappear
    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).not.toHaveClass(/active/);

    // --- PHASE: SETUP_WHITE_KING ---
    // Place White King at Row 7, Col 4
    const whiteKingCell = page.locator('.cell[data-r="7"][data-c="4"]');
    await expect(whiteKingCell).toBeVisible();
    await whiteKingCell.click();

    // --- PHASE: SETUP_BLACK_KING (AI) ---
    // Wait for shop to appear (triggered after black king placement)
    const shop = page.locator('#shop-panel');
    await expect(shop).toBeVisible({ timeout: 10000 });
    await expect(shop).not.toHaveClass(/hidden/, { timeout: 10000 });

    // Wait for points to be 25
    const pointsDisplay = page.locator('#points-display');
    await expect(pointsDisplay).toHaveText('25');

    await expect(shop).toHaveScreenshot('shop-panel-25-points.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Menu Overlay from Game', async ({ page }) => {
    // Start game first to enable menu button logic
    await domClick(page, '.gamemode-card[data-mode="setup"]');

    // Click menu button (the burger menu in header). After the setup-mode
    // refactor the #shop-panel overlays the header and intercepts Playwright's
    // locator.click() (actionability/stable check fails). Use the shared
    // domClick primitive — same approach as the 3D toggle fix.
    await domClick(page, '#menu-btn');
    const menu = page.locator('#main-menu'); // It re-opens the main menu
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/active/);

    // Check that "Resume" button is visible since we are in a game (even if setup)
    // Note: Resume button logic depends on game phase. Setup might hide it?
    // Let's check the implementation:
    // "if (this.game && this.game.phase !== 'SETUP') { resumeBtn.classList.remove('hidden'); }"
    // So in setup, resume might be hidden.

    await expect(menu).toHaveScreenshot('main-menu-reopened.png', {
      maxDiffPixelRatio: 0.2,
    });
  });

  test('3D View Static Snapshot', async ({ page }) => {
    test.slow(); // three.js + WebGL brauchen Zeit im Headless-Runner

    await page.click('.gamemode-card[data-mode="classic"]');
    const playNow = page.locator('#modal-actions .btn-primary');
    if (
      await playNow
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await playNow.click();
    }
    await page.waitForFunction(() => document.querySelectorAll('#board .cell').length > 0);

    // Beide Knöpfe sitzen in der Aktionsleiste, die Playwrights
    // Actionability-Prüfung als instabil/außerhalb des Viewports meldet —
    // domClick umgeht die Pixelprüfung, nicht den Handler.
    await domClick(page, '#action-more-btn');
    await domClick(page, '#toggle-3d-btn');

    const container = page.locator('#battle-chess-3d-container');
    await expect(container).toHaveClass(/active/);
    await expect(container.locator('canvas')).toBeVisible({ timeout: 20000 });

    // three.js muss die Szene fertig gezeichnet haben, sonst ist der Baseline
    // ein halb leeres Bild.
    await page.waitForTimeout(2500);

    await expect(container).toHaveScreenshot('3d-view-initial.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
      scale: 'css',
    });
  });
  test('Pawn Promotion Modal', async ({ page }) => {
    test.slow(); // Firefox needs more time

    // Force 2D mode and disable animations for stability
    await page.addInitScript(() => {
      localStorage.setItem('disable_animations', 'true');
      localStorage.setItem('settings_3d_mode', 'false');
      // Der KI-Mentor oeffnet bei einem angeblichen Fehler einen Bestaetigungsdialog
      // und faengt den Zug ab, bevor die Promotions-UI auftauchen kann.
      localStorage.setItem('ki_mentor_level', 'OFF');
    });

    // 1. Partie starten (klassisch 9x9) und dann eine minimal legale Stellung setzen:
    //    weisser Bauer ein Feld vor der Unterpromotion. Der alte Weg ueber Shop/Setup
    //    war instabil (Kaeufe und Phasen wurden vom UI ueberschrieben) und liess den
    //    Baseline-Vergleich stillschweigend ausfall.
    await page.click('.gamemode-card[data-mode="classic"]');
    // Der Modus-Dialog hat die ID #modal-actions (Klasse .modal-buttons).
    const playNow = page.locator('#modal-actions .btn-primary');
    if (
      await playNow
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await playNow.click();
    }
    await expect(page.locator('#board .cell').first()).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      const g = (window as any).app.game;
      g.board = Array.from({ length: 9 }, () => Array(9).fill(null));
      g.board[8][4] = { type: 'k', color: 'white', hasMoved: true };
      g.board[0][8] = { type: 'k', color: 'black', hasMoved: true };
      g.board[1][4] = { type: 'p', color: 'white', hasMoved: true };
      g.turn = 'white';
      g.phase = 'PLAY';
      g.isAI = false;
      g.kiMentorEnabled = false;
      g.selectedSquare = null;
      g.validMoves = null;
    });

    // 2. Bauer auf die Grundreihe ziehen
    await page.locator('.cell[data-r="1"][data-c="4"]').click();
    await page.locator('.cell[data-r="0"][data-c="4"]').click();

    // 3. Das Overlay muss erscheinen. Ein stilles `return` hatte den Vergleich
    //    uebersprungen und den Test gruen gelassen, ohne etwas zu pruefen.
    const modal = page.locator('#promotion-overlay');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).not.toHaveClass(/hidden/);

    // 4. Screenshot
    await page.waitForTimeout(500);
    await expect(modal).toHaveScreenshot('promotion-modal.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
