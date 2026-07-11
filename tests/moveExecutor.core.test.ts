/**
 * Focused unit tests for js/move/MoveExecutor.executeMove.
 *
 * The move executor is the single choke point for applying a move to the
 * board, so this suite asserts the *invariants* of every move category
 * (quiet move, capture, en passant, castling, promotion) rather than just
 * that the call resolves. Each test drives executeMove directly with an
 * explicit promotionType so no UI callback is required.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// MoveExecutor pulls in a lot of side-effecting modules. Mock them all so we
// can assert on the resulting game state in isolation.
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateStatus: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updatePuzzleStatus: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  flashSquare: vi.fn(),
  showPromotionUI: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playError: vi.fn(),
    playSuccess: vi.fn(),
    playGameOver: vi.fn(),
  },
}));

vi.mock('../js/effects.js', () => ({
  confettiSystem: { spawn: vi.fn(), burst: vi.fn() },
}));

vi.mock('../js/campaign/CampaignManager.js', () => ({
  campaignManager: {
    isTalentUnlocked: vi.fn(() => false),
    addGold: vi.fn(),
    addUnitXp: vi.fn(),
    getUnitXp: vi.fn(() => ({ level: 1 } as any)),
  },
}));

vi.mock('../js/ui/NotificationUI.js', () => ({
  notificationUI: { show: vi.fn() },
}));

vi.mock('../js/puzzleManager.js', () => ({
  puzzleManager: { onMove: vi.fn() },
}));

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(() => Promise.resolve(0)),
  findKing: vi.fn(() => ({ r: 0, c: 0 })),
}));

const { Game, BOARD_SIZE } = await import('../js/gameEngine.js');
const MoveExecutor = await import('../js/move/MoveExecutor.js');

describe('MoveExecutor.executeMove core invariants', () => {
  let game: any;
  let moveController: any;

  beforeEach(() => {
    game = new Game(0, 'classic');
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    game.phase = 'PLAY';
    game.isAI = false;
    game.capturedPieces = { white: [], black: [] };
    game.lastMove = null;
    // Minimal moveController stub: executeMove clears redoStack + updates
    // undo/redo buttons, but never calls back into game logic here.
    moveController = {
      redoStack: [] as any[],
      updateUndoRedoButtons: vi.fn(),
    };
  });

  test('quiet move relocates the piece and records history', async () => {
    game.board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 2, c: 5 });

    expect(game.board[2][5]).toEqual({ type: 'n', color: 'white', hasMoved: true });
    expect(game.board[4][4]).toBeNull();
    // Origin square cleared, destination occupied with moved flag set.
    expect(game.lastMove).toMatchObject({ from: { r: 4, c: 4 }, to: { r: 2, c: 5 } });
    // History entry pushed and redo stack cleared.
    expect(game.moveHistory.length).toBe(1);
    expect(game.moveHistory[0].captured).toBeNull();
    expect(moveController.redoStack.length).toBe(0);
    // No capture -> half-move clock advances (from 0 to 1).
    expect(game.halfMoveClock).toBe(1);
  });

  test('capture places the taken piece into the captor colour list and resets clock', async () => {
    game.board[4][4] = { type: 'r', color: 'white', hasMoved: true };
    game.board[4][7] = { type: 'n', color: 'black', hasMoved: true };
    game.halfMoveClock = 10;

    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 4, c: 7 });

    expect(game.board[4][7]).toEqual({ type: 'r', color: 'white', hasMoved: true });
    expect(game.board[4][4]).toBeNull();
    expect(game.capturedPieces.white).toEqual([{ type: 'n', color: 'black', hasMoved: true }]);
    expect(game.stats.captures).toBe(1);
    // Capture resets the 50-move clock regardless of previous value.
    expect(game.halfMoveClock).toBe(0);
    expect(game.moveHistory[0].captured).toEqual({ type: 'n', color: 'black' });
  });

  test('en passant removes the pawn on the originating rank and records it', async () => {
    // White pawn double-pushed 6,4 -> 4,4 (lastMove marks double push).
    game.board[4][4] = { type: 'p', color: 'white', hasMoved: true };
    game.board[4][5] = { type: 'p', color: 'black', hasMoved: true };
    game.lastMove = {
      from: { r: 6, c: 5 },
      to: { r: 4, c: 5 },
      piece: { type: 'p', color: 'black' },
      isDoublePawnPush: true,
    } as any;

    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 5, c: 5 });

    // White pawn landed diagonally, black pawn (same rank as origin) removed.
    expect(game.board[5][5]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(game.board[4][5]).toBeNull();
    expect(game.board[4][4]).toBeNull();
    expect(game.capturedPieces.white).toEqual([{ type: 'p', color: 'black' }]);
    expect(game.moveHistory[0].isEnPassant).toBe(true);
    expect(game.moveHistory[0].specialMove).toMatchObject({ type: 'enPassant' });
  });

  test('kingside castling moves king and rook and marks both moved', async () => {
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };

    await MoveExecutor.executeMove(game, moveController, { r: 8, c: 4 }, { r: 8, c: 6 });

    // King to g-file (col 6), rook to f-file (col 5).
    expect(game.board[8][6]).toEqual({ type: 'k', color: 'white', hasMoved: true });
    expect(game.board[8][5]).toEqual({ type: 'r', color: 'white', hasMoved: true });
    expect(game.board[8][4]).toBeNull();
    expect(game.board[8][8]).toBeNull();
    expect(game.moveHistory[0].isCastling).toBe(true);
    expect(game.moveHistory[0].specialMove).toMatchObject({
      type: 'castling',
      isKingside: true,
    });
  });

  test('promotion applies the explicit promotionType and counts it', async () => {
    game.board[1][4] = { type: 'p', color: 'white', hasMoved: true };

    await MoveExecutor.executeMove(
      game,
      moveController,
      { r: 1, c: 4 },
      { r: 0, c: 4 },
      false,
      'e' // promote to Angel
    );

    expect(game.board[0][4]).toEqual({ type: 'e', color: 'white', hasMoved: true });
    expect(game.stats.promotions).toBe(1);
    expect(game.moveHistory[0].promotion).toBe('e');
    expect(game.moveHistory[0].specialMove).toMatchObject({
      type: 'promotion',
      promotedTo: 'e',
    });
  });

  test('no-op when the source square is empty', async () => {
    // Nothing at 3,3 -> executeMove should return without mutating history.
    await MoveExecutor.executeMove(game, moveController, { r: 3, c: 3 }, { r: 3, c: 4 });
    expect(game.moveHistory.length).toBe(0);
    expect(game.board[3][4]).toBeNull();
  });
});
