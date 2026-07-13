/**
 * Focused tests for js/move/MoveExecutor.ts — the core move-execution logic.
 *
 * MoveExecutor drives the heart of the game: castling, en passant, promotion,
 * captures, the half-move clock, and finishMove (turn switch + king-captured
 * game-over + insufficient-material draw). It is heavily UI-wired, so every
 * rendering/sound/effect dependency is mocked to no-ops and only the *state
 * transitions* on the game/board are asserted.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Mock every side-effecting dependency to no-ops ----------------------
vi.mock('../../js/ui.js', () => ({
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  updatePuzzleStatus: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
  showPromotionUI: vi.fn(),
  flashSquare: vi.fn(),
  animateCheckmate: vi.fn(),
  animateCheck: vi.fn(),
  renderEvalGraph: vi.fn(),
  showToast: vi.fn(),
}));

const soundMock = { playCapture: vi.fn(), playMove: vi.fn(), playGameOver: vi.fn(), playError: vi.fn(), playSuccess: vi.fn() };
vi.mock('../../js/sounds.js', () => ({ soundManager: soundMock }));

vi.mock('../../js/effects.js', () => ({ confettiSystem: { spawn: vi.fn() } }));
vi.mock('../../js/ui/NotificationUI.js', () => ({ notificationUI: { show: vi.fn() } }));
vi.mock('../../js/puzzleManager.js', () => ({ puzzleManager: { checkMove: vi.fn(), getPuzzle: vi.fn() } }));
vi.mock('../../js/dailyPuzzle.js', () => ({ dailyPuzzle: { markSolvedToday: vi.fn() } }));
vi.mock('../../js/campaign/CampaignManager.js', () => ({
  campaignManager: { isTalentUnlocked: vi.fn(() => false), addGold: vi.fn(), addUnitXp: vi.fn(), getUnitXp: vi.fn(() => ({ level: 1 })) },
}));
vi.mock('../../js/aiEngine.js', () => ({ evaluatePosition: vi.fn().mockResolvedValue(0) }));

const moveValidatorMock = vi.hoisted(() => ({
  isInsufficientMaterial: vi.fn(() => false),
  getBoardHash: vi.fn(() => 'hash'),
  checkDraw: vi.fn(() => false),
}));
vi.mock('../../js/move/MoveValidator.js', () => moveValidatorMock);

vi.stubGlobal('document', { getElementById: () => null });
vi.stubGlobal('window', { battleChess3D: { enabled: false } });
vi.stubGlobal('setTimeout', (fn: () => void) => {
  fn();
  return 0 as unknown as ReturnType<typeof setTimeout>;
});

const { PHASES } = await import('../../js/gameEngine.js');
const { executeMove, finishMove } = await import('../../js/move/MoveExecutor.js');
const ui = await import('../../js/ui.js');

type Piece = { type: string; color: 'white' | 'black'; hasMoved?: boolean };
type AnyGame = any;

function emptyBoard(size = 9): (Piece | null)[][] {
  return Array.from({ length: size }, () => Array<Piece | null>(size).fill(null));
}

function makeGame(over: Partial<AnyGame> = {}): AnyGame {
  const size = over.boardSize ?? 9;
  return {
    boardSize: size,
    board: emptyBoard(size),
    turn: 'white',
    phase: PHASES.PLAY,
    mode: 'classic',
    isAI: false,
    campaignMode: false,
    clockEnabled: false,
    halfMoveClock: 0,
    stats: { captures: 0, promotions: 0, totalMoves: 0, playerMoves: 0 },
    capturedPieces: { white: [], black: [] },
    moveHistory: [],
    positionHistory: [],
    log: vi.fn(),
    arrowRenderer: null,
    evaluationBar: null,
    bestMoves: [],
    tutorController: null,
    gameController: null,
    isCheckmate: vi.fn(() => false),
    isStalemate: vi.fn(() => false),
    isInCheck: vi.fn(() => false),
    ...over,
  };
}

let game: AnyGame;
let controller: AnyGame;

beforeEach(() => {
  // Reset mocks so per-test return-value overrides don't leak.
  vi.clearAllMocks();
  moveValidatorMock.isInsufficientMaterial.mockReturnValue(false);
  moveValidatorMock.checkDraw.mockReturnValue(false);
  moveValidatorMock.getBoardHash.mockReturnValue('hash');
  game = makeGame();
  controller = {
    redoStack: [] as unknown[],
    undoStack: [] as unknown[],
    updateUndoRedoButtons: vi.fn(),
    executeMove: vi.fn(),
  };
});

function withKings(g: AnyGame): AnyGame {
  // Place kings away from the central columns used by the move-under-test so
  // a promotion/capture move does not overwrite a king (which would trigger a
  // spurious king-captured game-over).
  g.board[8][0] = { type: 'k', color: 'white', hasMoved: false };
  g.board[0][8] = { type: 'k', color: 'black', hasMoved: false };
  return g;
}

describe('finishMove', () => {
  test('switches turn from white to black when both kings remain', () => {
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    finishMove(game, { r: 1, c: 1 });
    expect(game.turn).toBe('black');
    expect(game.phase).toBe(PHASES.PLAY);
  });

  test('king captured ends the game with the surviving side winning', () => {
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    // black king removed -> black loses, white wins
    finishMove(game, { r: 0, c: 4 });
    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(ui.renderBoard).toHaveBeenCalled();
    expect(game.gameController?.handleGameEnd).toBeUndefined(); // gameController not set
  });

  test('king captured calls handleGameEnd with the winning color', () => {
    const handleGameEnd = vi.fn();
    game.gameController = { handleGameEnd };
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    // white king removed -> white loses, black wins
    finishMove(game, { r: 8, c: 4 });
    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(handleGameEnd).toHaveBeenCalledWith('win', 'black');
  });

  test('insufficient material ends the game as a draw', async () => {
    const handleGameEnd = vi.fn();
    game.gameController = { handleGameEnd };
    // Two kings + a pawn; the insufficient-material check runs inside
    // completeMoveExecution (which delegates to finishMove).
    withKings(game);
    game.board[1][0] = { type: 'p', color: 'white', hasMoved: true };
    moveValidatorMock.isInsufficientMaterial.mockReturnValue(true);
    await executeMove(game, controller, { r: 1, c: 0 }, { r: 2, c: 0 });
    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(handleGameEnd).toHaveBeenCalledWith('draw', null);
  });
});

describe('executeMove', () => {
  test('promotes a pawn to the provided promotion type', async () => {
    withKings(game);
    game.board[1][4] = { type: 'p', color: 'white', hasMoved: true };
    await executeMove(game, controller, { r: 1, c: 4 }, { r: 0, c: 4 }, false, 'q');
    expect(game.board[0][4]?.type).toBe('q');
    expect(game.stats.promotions).toBe(1);
    expect(game.turn).toBe('black');
  });

  test('records a capture and resets the half-move clock', async () => {
    withKings(game);
    game.board[5][4] = { type: 'r', color: 'white', hasMoved: true };
    game.board[4][4] = { type: 'n', color: 'black', hasMoved: true };
    await executeMove(game, controller, { r: 5, c: 4 }, { r: 4, c: 4 });
    // capturing rook now on target square
    expect(game.board[4][4]?.type).toBe('r');
    expect(game.board[5][4]).toBeNull();
    expect(game.capturedPieces.white).toHaveLength(1);
    expect(game.stats.captures).toBe(1);
    expect(game.halfMoveClock).toBe(0);
  });

  test('handles en passant capture (removes the passed pawn)', async () => {
    withKings(game);
    // White pawn on (5,4) pushes to (4,4); black pawn just moved (6,3)->(4,3)
    game.board[5][4] = { type: 'p', color: 'white', hasMoved: true };
    game.board[4][3] = { type: 'p', color: 'black', hasMoved: true };
    game.lastMove = { from: { r: 6, c: 3 }, to: { r: 4, c: 3 }, piece: { type: 'p', color: 'black' }, isDoublePawnPush: true };
    await executeMove(game, controller, { r: 5, c: 4 }, { r: 4, c: 3 });
    // white pawn landed diagonally
    expect(game.board[4][3]?.type).toBe('p');
    // the passed black pawn is removed
    expect(game.board[5][3]).toBeNull();
  });

  test('handles kingside castling (moves rook next to king)', async () => {
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };
    // ensure a black king exists so finishMove does not end the game
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    await executeMove(game, controller, { r: 8, c: 4 }, { r: 8, c: 6 });
    expect(game.board[8][6]?.type).toBe('k'); // king to c-file (col 6)
    expect(game.board[8][5]?.type).toBe('r'); // rook moved next to king
    expect(game.board[8][8]).toBeNull();
  });

  test('clears redo stack for a fresh (non-undo) move', async () => {
    withKings(game);
    controller.redoStack = ['stale'];
    game.board[5][4] = { type: 'r', color: 'white', hasMoved: true };
    game.board[4][4] = null;
    await executeMove(game, controller, { r: 5, c: 4 }, { r: 4, c: 4 });
    expect(controller.redoStack).toHaveLength(0);
  });
});
