/**
 * Focused suite for the *endgame / game-over* and *auto-save* branches of
 * js/move/MoveExecutor.js that the core suite (moveExecutor.core.test.ts)
 * never reaches.
 *
 * The core suite only asserts the happy path of `executeMove` (quiet / capture
 * / en passant / castling / promotion). It never drives `finishMove` into a
 * terminal state, so the riskiest wiring — game.phase -> GAME_OVER, the
 * gameController.handleGameEnd callback, the insufficient-material draw, and
 * the auto-save try/catch — sat at ~0% coverage. A bug in any of those leaves
 * a finished game hanging instead of ending. These tests drive `executeMove`
 * into those branches and assert the invariants they must uphold.
 *
 * NOTE on board setup: `MoveValidator.isInsufficientMaterial` runs first in
 * `finishMove`, so every scenario below seeds *sufficient* material (pawns on
 * both sides) to avoid the draw shortcut and reach the branch under test.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

// Reuse the same side-effecting-module mocks as the core suite, extended with
// the render/eval/toast calls that only fire in the terminal branches.
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
  showToast: vi.fn(),
  renderEvalGraph: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
  animateCheck: vi.fn(),
  animateCheckmate: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playError: vi.fn(),
    playSuccess: vi.fn(),
    playCheck: vi.fn(),
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
    getUnitXp: vi.fn(() => ({ level: 1 }) as any),
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

function emptyBoard(): any[][] {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}

function baseGame(): any {
  const game = new Game(0, 'classic');
  game.board = emptyBoard();
  game.phase = 'PLAY';
  game.isAI = false;
  game.capturedPieces = { white: [], black: [] };
  game.lastMove = null;
  // Sufficient material so isInsufficientMaterial stays false.
  game.board[6][0] = { type: 'p', color: 'white', hasMoved: false };
  game.board[2][8] = { type: 'p', color: 'black', hasMoved: false };
  return game;
}

describe('MoveExecutor — terminal state wiring (finishMove)', () => {
  let game: any;
  let moveController: any;
  let handleGameEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    game = baseGame();
    handleGameEnd = vi.fn();
    game.gameController = { handleGameEnd };
    moveController = { redoStack: [] as any[], updateUndoRedoButtons: vi.fn() };
  });

  test('capturing the opponent king ends the game and reports the winner', async () => {
    // White king at 0,4; a black rook captures it. White keeps a pawn so the
    // position is not "insufficient material" — the king-capture branch wins.
    game.board[0][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[0][3] = { type: 'r', color: 'black', hasMoved: true };
    game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };
    game.turn = 'black';

    await MoveExecutor.executeMove(game, moveController, { r: 0, c: 3 }, { r: 0, c: 4 });

    expect(game.phase).toBe('GAME_OVER');
    expect(handleGameEnd).toHaveBeenCalledWith('win', 'black');
  });

  test('insufficient material after a move ends the game as a draw', async () => {
    // Only the two kings remain (no pawns) -> draw by insufficient material.
    game.board = emptyBoard();
    game.board[4][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };
    game.turn = 'white';

    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 4, c: 5 });

    expect(game.phase).toBe('GAME_OVER');
    expect(handleGameEnd).toHaveBeenCalledWith('draw', null);
  });

  test('a non-terminal move does NOT end the game and reports no result', async () => {
    game.board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'white', hasMoved: false };
    game.turn = 'white';

    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 2, c: 5 });

    expect(game.phase).toBe('PLAY');
    expect(handleGameEnd).not.toHaveBeenCalled();
    // Turn switched to black.
    expect(game.turn).toBe('black');
  });
});

describe('MoveExecutor — auto-save branch (every 5th move)', () => {
  let game: any;
  let moveController: any;
  let saveGame: ReturnType<typeof vi.fn>;
  let showToast: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    game = baseGame();
    saveGame = vi.fn();
    showToast = vi.fn();
    game.gameController = {
      handleGameEnd: vi.fn(),
      saveGame,
      requestPositionAnalysis: vi.fn(),
    };
    // ui.showToast is mocked at module level; swap the live mock below.
    moveController = { redoStack: [] as any[], updateUndoRedoButtons: vi.fn() };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('saves the game on the 5th move and toasts success', async () => {
    const ui = await import('../js/ui.js');
    (ui as any).showToast = showToast;

    // Pre-seed 4 history entries so the next move is the 5th.
    game.moveHistory = Array(4).fill({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
    game.board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'white', hasMoved: false };
    game.turn = 'white';

    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 2, c: 5 });

    expect(saveGame).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Spiel automatisch gespeichert', 'success');
  });

  test('a failing save is swallowed (logged) and never aborts the move', async () => {
    const ui = await import('../js/ui.js');
    (ui as any).showToast = showToast;
    saveGame.mockImplementation(() => {
      throw new Error('disk full');
    });

    game.moveHistory = Array(4).fill({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
    game.board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'white', hasMoved: false };
    game.turn = 'white';

    // Must resolve without throwing despite the save failure.
    await expect(
      MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 2, c: 5 })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('Auto-save failed');
    // The move itself still completed.
    expect(game.board[2][5]).toEqual({ type: 'n', color: 'white', hasMoved: true });
  });
});

describe('MoveExecutor — post-move analysis wiring (human turn)', () => {
  let game: any;
  let moveController: any;
  let requestPositionAnalysis: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    game = baseGame();
    game.turn = 'white';
    game.analysisMode = true;
    game.aiController = { analysisActive: true } as any;
    game.analysisManager = { updateArrows: vi.fn() };
    requestPositionAnalysis = vi.fn();
    game.gameController = {
      handleGameEnd: vi.fn(),
      saveGame: vi.fn(),
      requestPositionAnalysis,
    };
    moveController = { redoStack: [] as any[], updateUndoRedoButtons: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('requests position analysis and refreshes arrows after a human move', async () => {
    game.board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'white', hasMoved: false };
    game.turn = 'white';

    await MoveExecutor.executeMove(game, moveController, { r: 4, c: 4 }, { r: 2, c: 5 });

    // The analysis callback runs inside a 10ms setTimeout in finishMove.
    vi.advanceTimersByTime(10);

    expect(requestPositionAnalysis).toHaveBeenCalledTimes(1);
    expect(game.analysisManager.updateArrows).toHaveBeenCalledTimes(1);
  });
});
