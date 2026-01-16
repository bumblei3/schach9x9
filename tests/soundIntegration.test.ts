import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../js/gameEngine';
import { executeMove } from '../js/move/MoveExecutor';
import { soundManager } from '../js/sounds';

// Mock soundManager
vi.mock('../js/sounds', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playGameOver: vi.fn(),
    playGameStart: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  },
}));

// Mock other dependencies that MoveExecutor might need
vi.mock('../js/ui.js', () => ({
  // Note: ui.js is still JS, so keep extensions or let resolver handle it.
  default: {
    renderBoard: vi.fn(),
    updateStatus: vi.fn(),
    updateStatistics: vi.fn(),
    updateClockDisplay: vi.fn(),
    updateClockUI: vi.fn(),
    animateCheckmate: vi.fn(),
    animateCheck: vi.fn(),
    flashSquare: vi.fn(),
    animateMove: vi.fn().mockResolvedValue(undefined),
    updateCapturedUI: vi.fn(),
    updateMoveHistoryUI: vi.fn(),
    renderEvalGraph: vi.fn(),
    showToast: vi.fn(),
    showPromotionUI: vi.fn(),
  },
  // Also export individual functions if they are imported as named imports
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  animateCheckmate: vi.fn(),
  animateCheck: vi.fn(),
  flashSquare: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderEvalGraph: vi.fn(),
  showToast: vi.fn(),
  showPromotionUI: vi.fn(),
}));

describe('Sound Integration Tests', () => {
  let game: Game;
  let mockMoveController: any; // Using any for mock controller to simplify

  beforeEach(() => {
    game = new Game(15, 'setup');
    game.boardSize = 9;

    // Setup necessary game state for MoveExecutor
    game.capturedPieces = { white: [], black: [] };
    game.stats = {
      captures: 0,
      promotions: 0,
      totalMoves: 0,
      playerMoves: 0,
      playerBestMoves: 0,
      accuracies: [],
    };
    game.positionHistory = [];
    game.moveHistory = [];
    game.timeControl = { increment: 0, base: 300 };
    game.whiteTime = 300;
    game.blackTime = 300;

    vi.clearAllMocks();

    // Create a mock MoveController
    mockMoveController = {
      redoStack: [],
      updateUndoRedoButtons: vi.fn(),
      undoMove: vi.fn(),
      executeMove: vi.fn(),
    };

    // Mock document elements needed by MoveExecutor
    document.body.innerHTML = `
            <div id="game-over-overlay" class="hidden"></div>
            <div id="winner-text"></div>
        `;
  });

  it('should play move sound on normal move', async () => {
    const from = { r: 6, c: 4 };
    const to = { r: 4, c: 4 };
    const piece = { type: 'p', color: 'white', hasMoved: false };
    // @ts-ignore
    game.board[from.r][from.c] = piece;
    // Ensure destination is empty
    game.board[to.r][to.c] = null;

    await executeMove(game, mockMoveController, from, to);

    expect(soundManager.playMove).toHaveBeenCalled();
  });

  it('should play capture sound on capture', async () => {
    const from = { r: 6, c: 4 };
    const to = { r: 5, c: 5 };
    const piece = { type: 'p', color: 'white', hasMoved: false };
    const target = { type: 'p', color: 'black', hasMoved: false };
    // @ts-ignore
    game.board[from.r][from.c] = piece;
    // @ts-ignore
    game.board[to.r][to.c] = target;

    await executeMove(game, mockMoveController, from, to);

    expect(soundManager.playCapture).toHaveBeenCalled();
  });

  it('should play check sound when opponent is in check', async () => {
    // Clear board
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

    // Setup check scenario
    // White King (required to avoid instant game over)
    // @ts-ignore
    game.board[8][8] = { type: 'k', color: 'white', hasMoved: false };

    // White Rook at (7,1). Black King at (0,1).
    // Move Rook to (1,1) -> Attacks King at (0,1).
    // @ts-ignore
    game.board[7][1] = { type: 'r', color: 'white', hasMoved: true };
    // @ts-ignore
    game.board[0][1] = { type: 'k', color: 'black', hasMoved: false };

    // Execute move: Rook (7,1) -> (1,1)
    await executeMove(game, mockMoveController, { r: 7, c: 1 }, { r: 1, c: 1 });

    expect(soundManager.playCheck).toHaveBeenCalled();
  });

  it('should play game over sound on checkmate', async () => {
    // Clear board
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

    // White King (required)
    // @ts-ignore
    game.board[8][8] = { type: 'k', color: 'white', hasMoved: false };

    // Back Rank Checkmate:
    // Black King at (0,4)
    // Black Pawns at (1,3), (1,4), (1,5) blocking escape.
    // White Rook moves to (0,4) or scans rank 0 from (0,0).

    // @ts-ignore
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    // @ts-ignore
    game.board[1][3] = { type: 'p', color: 'black' };
    // @ts-ignore
    game.board[1][4] = { type: 'p', color: 'black' };
    // @ts-ignore
    game.board[1][5] = { type: 'p', color: 'black' };

    // White Rook setup at (8,0), moving to (0,0) to checkmate.
    // @ts-ignore
    game.board[8][0] = { type: 'r', color: 'white' };
    // Clear path for Rook from 8,0 to 0,0 requires column 0 to be clear.

    await executeMove(game, mockMoveController, { r: 8, c: 0 }, { r: 0, c: 0 });

    expect(soundManager.playGameOver).toHaveBeenCalled();
  });
});
