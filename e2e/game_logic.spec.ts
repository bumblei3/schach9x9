import { test, expect } from '@playwright/test';

test.describe('Deep Game Logic @logic', () => {
  // These specs inject pieces into a live game and assert async DOM repaints.
  // Under parallel CI load the init/repaint can lag, so give them more headroom
  // than the default 30s test timeout to avoid false flakes.
  test.slow();
  test.beforeEach(async ({ page }) => {
    // Listen to browser console logs
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

    // Disable AI Mentor
    await page.addInitScript(() => {
      localStorage.setItem('ki_mentor_level', 'OFF');
    });
    await page.goto('/?disable-sw');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'));
  });

  async function setupPieceAndRender(page: any, r: number, c: number, pieceType: string) {
    // Initialize 9x9 Classic. Use force because clicking the card tears down
    // the main menu (which makes Playwright think the target is unstable).
    await page.click('.gamemode-card[data-mode="classic"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();

    // Wait for game instance AND full initialization (board + PLAY phase must
    // exist before we mutate the board; otherwise we race the async init under
    // load). Match the explicit 'PLAY' phase rather than a truthy check so a
    // transient 'SETUP'/'undefined' phase can't let us clobber the board early.
    await page.waitForFunction(
      () => {
        const g = (window as any).game;
        return (
          g &&
          g.board &&
          Array.isArray(g.board) &&
          g.board.length > 0 &&
          g.phase === 'PLAY'
        );
      },
      { timeout: 20000 }
    );

    await page.evaluate(
      ({ r, c, pieceType }: { r: number; c: number; pieceType: string }) => {
        const game = (window as any).game;
        // Clear board
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            game.board[row][col] = null;
          }
        }
        // Put King elsewhere so game doesn't end or error (usually needs a King)
        game.board[0][0] = { type: 'k', color: 'black', hasMoved: true };
        game.board[8][0] = { type: 'k', color: 'white', hasMoved: true };

        // Inject piece
        game.board[r][c] = { type: pieceType, color: 'white', hasMoved: true };

        // Trigger render using exposed UI module
        if ((window as any).UI) {
          (window as any).UI.renderBoard(game);
        }
      },
      { r, c, pieceType }
    );

    // Wait for render to settle (cells + click handlers attached). Under heavy
    // CI load rendering can lag, so the move-validation waits below use toPass.
    await page.waitForTimeout(500);
  }

  // Assert a cell shows a valid-move marker, retrying because the board may
  // paint the markers a beat after the click under load.
  async function expectValidMove(page: any, r: number, c: number) {
    await expect(async () => {
      await expect(page.locator(`.cell[data-r="${r}"][data-c="${c}"].valid-move`)).toBeVisible();
    }).toPass({ timeout: 10000 });
  }

  test('Archbishop (a) movement: Bishop + Knight', async ({ page }) => {
    await setupPieceAndRender(page, 4, 4, 'a');
    await page.click('.cell[data-r="4"][data-c="4"]');

    // Bishop moves
    await expectValidMove(page, 3, 3);
    await expectValidMove(page, 6, 6);

    // Knight moves
    await expectValidMove(page, 2, 5);
    await expectValidMove(page, 6, 3);
  });

  test('Chancellor (c) movement: Rook + Knight', async ({ page }) => {
    await setupPieceAndRender(page, 4, 4, 'c');
    await page.click('.cell[data-r="4"][data-c="4"]');

    // Rook moves
    await expectValidMove(page, 4, 0);
    await expectValidMove(page, 8, 4);

    // Knight moves
    await expectValidMove(page, 2, 5);
    await expectValidMove(page, 6, 3);
  });

  test('Nightrider (j) movement: Sliding Knight', async ({ page }) => {
    await setupPieceAndRender(page, 4, 4, 'j');
    await page.click('.cell[data-r="4"][data-c="4"]');

    // 1st jump
    await expectValidMove(page, 2, 5);
    // 2nd jump (sliding)
    await expectValidMove(page, 0, 6);
  });

  test('Angel (e) movement: Queen + Knight', async ({ page }) => {
    await setupPieceAndRender(page, 4, 4, 'e');
    await page.click('.cell[data-r="4"][data-c="4"]');

    // Queen moves
    await expectValidMove(page, 0, 0);
    await expectValidMove(page, 4, 8);

    // Knight moves
    await expectValidMove(page, 2, 5);
  });

  test('Castling 9x9: King should reach correct square', async ({ page }) => {
    // Initialize 9x9 Classic. Use force: clicking the card tears down the menu.
    await page.click('.gamemode-card[data-mode="classic"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();
    await page.waitForFunction(() => (window as any).game !== undefined);

    await page.evaluate(() => {
      const game = (window as any).game;
      // Clear pieces between K and R (Kingside 4,4 to 4,8)
      game.board[8][5] = null;
      game.board[8][6] = null;
      game.board[8][7] = null;
      // Ensure K and R haven't moved
      game.board[8][4].hasMoved = false;
      game.board[8][8].hasMoved = false;
      if ((window as any).UI) (window as any).UI.renderBoard(game);
    });

    await page.click('.cell[data-r="8"][data-c="4"]');

    // Kingside castling move for 9x9 (usually King moves 2 squares or to g-file)
    // In 9x9, king-side castle target is usually (8, 6) or (8, 7)?
    // Let's check where the valid-move appears.
    const kingsideCastle = page.locator('.cell[data-r="8"][data-c="6"].valid-move');
    await expect(kingsideCastle).toBeVisible();
    await kingsideCastle.click();

    // King should be at (8,6), Rook should be at (8,5)
    await expect(page.locator('.cell[data-r="8"][data-c="6"]')).toHaveAttribute('data-piece', 'k');
    await expect(page.locator('.cell[data-r="8"][data-c="5"]')).toHaveAttribute('data-piece', 'r');
  });

  test('En Passant 9x9', async ({ page }) => {
    test.slow(); // Firefox needs more time

    await page.click('.gamemode-card[data-mode="classic"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();
    await page.waitForFunction(() => (window as any).game !== undefined);
    await page.waitForFunction(() => (window as any).game?.phase === 'PLAY', { timeout: 10000 });

    await page.evaluate(() => {
      const game = (window as any).game;
      // Clear pieces but keep Kings to prevent Game Over
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          game.board[r][c] = null;
        }
      }
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

      // White pawn at 3,4
      game.board[3][4] = { type: 'p', color: 'white', hasMoved: true };
      // Black pawn at 1,5
      game.board[1][5] = { type: 'p', color: 'black', hasMoved: false };
      game.turn = 'black';
      game.isAI = false;
      if ((window as any).UI) (window as any).UI.renderBoard(game);
    });

    // 1. Black moves pawn 1,5 -> 3,5 programmatically
    await page.evaluate(async () => {
      const game = (window as any).game;
      if (game.handlePlayClick) {
        await game.handlePlayClick(1, 5);
        await game.handlePlayClick(3, 5);
      }
    });

    // Wait for turn to switch
    await page.waitForFunction(() => (window as any).game.turn === 'white', { timeout: 5000 });

    // Verify move executed
    await expect(page.locator('.cell[data-r="3"][data-c="5"]')).toHaveAttribute('data-piece', 'p');

    // Inspect lastMove via evaluation
    const lastMoveInfo = await page.evaluate(() => {
      const game = (window as any).game;
      return JSON.stringify(game.lastMove);
    });
    console.log('Last Move Info:', lastMoveInfo);

    // 2. White's turn
    await expect(page.locator('#status-display')).toContainText(/Weiß am Zug/i);

    // 3. Select white pawn at 3,4
    const whiteStartCell = page.locator('.cell[data-r="3"][data-c="4"]');
    // const whiteTargetCell = page.locator('.cell[data-r="2"][data-c="5"]'); // Not used in new logic

    await whiteStartCell.click();
    await expect(whiteStartCell).toHaveClass(/highlight/);

    // Wait for target to be marked as valid
    // Wait for animation to finish
    await page.waitForFunction(() => !(window as any).game.isAnimating, { timeout: 5000 });

    const lastMove = await page.evaluate(() => JSON.stringify((window as any).game.lastMove));
    console.log('Last Move Info:', lastMove);

    // 4. Perform the capture move
    // Need to select white pawn first
    await page.click('.cell[data-r="3"][data-c="4"]');
    await page.waitForSelector('.cell[data-r="2"][data-c="5"].valid-move');

    await page.evaluate(() => {
      (window as any).gameController.handleCellClick(2, 5);
    });

    // 5. Verify capture
    // Wait for animation AND board re-render
    await page.waitForFunction(() => !(window as any).game.isAnimating, { timeout: 5000 });
    await page.waitForTimeout(500); // Extra wait for DOM update

    // White pawn should be at 2,5
    await expect(page.locator('.cell[data-r="2"][data-c="5"]')).toHaveAttribute('data-piece', 'p');

    // Black pawn at 3,5 should be GONE - verify via game state
    const capturedPawnGone = await page.evaluate(() => {
      const game = (window as any).game;
      const cell = game.board[3][5];
      return cell === null || cell?.color !== 'black';
    });
    expect(capturedPawnGone).toBe(true);
  });

  test('Pawn Promotion 8x8', async ({ page }) => {
    // Start 8x8 game
    await page.click('.gamemode-card[data-mode="standard8x8"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();

    // Wait for game to be initialized
    await page.waitForFunction(() => (window as any).game !== undefined, { timeout: 5000 });

    // Inject promotion scenario: White pawn at r=1, c=4.
    await page.evaluate(() => {
      const game = (window as any).game;
      game.board[0][4] = null; // Remove potential obstacle (King)
      game.board[1][4] = { type: 'p', color: 'white', hasMoved: true };
      game.turn = 'white';
      if ((window as any).UI) (window as any).UI.renderBoard(game);
    });

    // 1. Move pawn to rank 0
    await page.click('.cell[data-r="1"][data-c="4"]');
    await page.click('.cell[data-r="0"][data-c="4"]');

    // 2. Expect promotion overlay
    await expect(page.locator('#promotion-overlay')).toBeVisible();

    // 3. Select Queen (q)
    await page.click('#promotion-options .promotion-option[data-piece="q"]');

    // 4. Verify piece is now queen
    await expect(page.locator('.cell[data-r="0"][data-c="4"]')).toHaveAttribute('data-piece', 'q');
    await expect(page.locator('#promotion-overlay')).not.toBeVisible();
  });

  test('Pawn Promotion 9x9 to Angel (e)', async ({ page }) => {
    // Start 9x9 game
    await page.click('.gamemode-card[data-mode="classic"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();

    // Wait for game to be initialized
    await page.waitForFunction(() => (window as any).game !== undefined, { timeout: 5000 });

    // Inject promotion scenario: White pawn at r=1, c=4.
    await page.evaluate(() => {
      const game = (window as any).game;
      game.board[0][4] = null; // Remove potential obstacle
      game.board[1][4] = { type: 'p', color: 'white', hasMoved: true };
      game.turn = 'white';
      if ((window as any).UI) (window as any).UI.renderBoard(game);
    });

    // 1. Move pawn to rank 0
    await page.click('.cell[data-r="1"][data-c="4"]');
    await page.click('.cell[data-r="0"][data-c="4"]');

    // 2. Expect promotion overlay
    await expect(page.locator('#promotion-overlay')).toBeVisible();

    // 3. Select Angel (e)
    // Check if Angel is available in 9x9 promotion
    const angelOption = page.locator('#promotion-options .promotion-option[data-piece="e"]');
    await expect(angelOption).toBeVisible();
    await angelOption.click();

    // 4. Verify piece is now angel
    await expect(page.locator('.cell[data-r="0"][data-c="4"]')).toHaveAttribute('data-piece', 'e');
  });

  test('Game Over: Checkmate', async ({ page }) => {
    await page.click('.gamemode-card[data-mode="standard8x8"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();
    await page.waitForFunction(() => (window as any).game !== undefined);

    await page.evaluate(() => {
      const game = (window as any).game;
      // Clear board
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) game.board[r][c] = null;
      }

      // Setup Mate in 1
      // White King at 2,0
      game.board[2][0] = { type: 'k', color: 'white', hasMoved: true };
      // Black King at 0,0
      game.board[0][0] = { type: 'k', color: 'black', hasMoved: true };
      // White Rook at 1,7
      game.board[1][7] = { type: 'r', color: 'white', hasMoved: true };

      game.turn = 'white';
      if ((window as any).UI) (window as any).UI.renderBoard(game);
    });

    // Move Rook to 0,7 -> Checkmate
    await page.click('.cell[data-r="1"][data-c="7"]');
    await page.click('.cell[data-r="0"][data-c="7"]');

    // Verify Overlay
    await expect(page.locator('#game-over-overlay')).toBeVisible();
    await expect(page.locator('#winner-text')).toContainText('Weiß gewinnt!');
  });

  test('Game Over: Stalemate', async ({ page }) => {
    await page.click('.gamemode-card[data-mode="standard8x8"]', { force: true });
    await expect(page.locator('#board')).toBeVisible();
    await page.waitForFunction(() => (window as any).game !== undefined);

    await page.evaluate(() => {
      const game = (window as any).game;
      // Clear board
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) game.board[r][c] = null;
      }

      // Setup Stalemate
      // Black King at 0,0
      game.board[0][0] = { type: 'k', color: 'black', hasMoved: true };
      // White Queen at 3,2
      game.board[3][2] = { type: 'q', color: 'white', hasMoved: true };

      // Also need White King somewhere to ensure valid board
      game.board[7][7] = { type: 'k', color: 'white', hasMoved: true };

      game.turn = 'white';
      if ((window as any).UI) (window as any).UI.renderBoard(game);
    });

    // Execute Stalemate Move: Queen 3,2 -> 1,2
    await page.click('.cell[data-r="3"][data-c="2"]');
    await page.click('.cell[data-r="1"][data-c="2"]');

    // Verify Overlay
    await expect(page.locator('#game-over-overlay')).toBeVisible();
    await expect(page.locator('#winner-text')).toContainText('Unentschieden');
  });
});
