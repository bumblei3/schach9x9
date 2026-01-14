import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(() => Promise.resolve(0)),
}));

// --- MOCKS FOR I/O ONLY ---
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  animateMove: vi.fn(() => Promise.resolve()),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updatePuzzleStatus: vi.fn(),
  updateStatus: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  renderEvalGraph: vi.fn(),
  animateCheckmate: vi.fn(),
  animateCheck: vi.fn(),
  showToast: vi.fn(),
  showShop: vi.fn(),
  showTutorSuggestions: vi.fn(),
  showPromotionUI: vi.fn((g, r, c, col, mr, cb) => {
    if (g.board[r][c]) g.board[r][c].type = 'e';
    cb();
  }),
}));

vi.mock('../js/puzzleManager.js', () => ({
  puzzleManager: {
    checkMove: vi.fn(),
    getPuzzle: vi.fn(() => ({ solution: [] })),
  },
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playError: vi.fn(),
    playSuccess: vi.fn(),
    playGameOver: vi.fn(),
    playCheck: vi.fn(),
  },
}));

vi.mock('../js/effects.js', () => ({
  confettiSystem: { spawn: vi.fn() },
  shakeScreen: vi.fn(),
  triggerVibration: vi.fn(),
  particleSystem: { spawn: vi.fn() },
  floatingTextManager: { show: vi.fn() },
}));

// Global Window Mocks (Add minimal extensions if needed, but avoid overriding core DOM)
if (typeof window !== 'undefined') {
  window.battleChess3D = undefined;
}

const MoveExecutor = await import('../js/move/MoveExecutor.js');
const { soundManager } = await import('../js/sounds.js');
const { puzzleManager } = await import('../js/puzzleManager.js');
const UI = await import('../js/ui.js');

describe('MoveExecutor Integration Tests', () => {
  let game;
  let moveController;

  beforeEach(() => {
    vi.clearAllMocks();

    // Robust DOM Mock for all tests
    const mockElement = {
      textContent: '',
      classList: { remove: vi.fn(), add: vi.fn() },
      appendChild: vi.fn(),
      scrollTop: 0,
      scrollHeight: 100,
      style: {},
    };

    document.getElementById = vi.fn(id => {
      if (id === 'winner-text') return mockElement;
      if (id === 'game-log') return mockElement;
      return mockElement;
    });

    // REAL Game Instance
    game = new Game(15, 'classic');

    // Manual Board Setup (Clear board for precise testing)
    game.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    // Basic Kings (Required for validation/check logic)
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

    moveController = {
      redoStack: [],
      updateUndoRedoButtons: vi.fn(),
      undoMove: vi.fn(), // We can keep this simple or link to GameStateManager
    };
  });

  // Ensure global document mock is active before tests run if setup in beforeEach?
  // But here we set it globally.

  test('Normal Move: Updates real board state and turn', async () => {
    // Setup: White Pawn at 6,4
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };

    const from = { r: 6, c: 4 };
    const to = { r: 5, c: 4 };

    // Execute Real Move
    await MoveExecutor.executeMove(game, moveController, from, to);

    // Verify State
    expect(game.board[6][4]).toBeNull();
    expect(game.board[5][4]).toEqual(expect.objectContaining({ type: 'p', color: 'white' }));
    expect(game.turn).toBe('black');

    // Verify I/O Side Effects
    expect(UI.renderBoard).toHaveBeenCalled();
    expect(soundManager.playMove).toHaveBeenCalled();
  });

  test('Capture: Updates captured pieces logic', async () => {
    game.board[6][4] = { type: 'r', color: 'white' }; // Rook
    game.board[5][4] = { type: 'p', color: 'black' }; // Enemy Pawn

    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 4 }, { r: 5, c: 4 });

    // Logical Assertions
    expect(game.board[6][4]).toBeNull();
    expect(game.board[5][4].type).toBe('r');
    expect(game.capturedPieces.white).toHaveLength(1);
    expect(game.capturedPieces.white[0].type).toBe('p');

    // Side Effect Assertions
    expect(soundManager.playCapture).toHaveBeenCalled();
  });

  test('Promotion: Pawn promotes to Angel at row 0', async () => {
    game.board[1][0] = { type: 'p', color: 'white' };

    await MoveExecutor.executeMove(game, moveController, { r: 1, c: 0 }, { r: 0, c: 0 });
    await new Promise(resolve => setTimeout(resolve, 0)); // Allow completeMoveExecution to finish

    expect(game.board[0][0].type).toBe('e'); // Angel
    expect(game.turn).toBe('black');
  });

  test('Castling: Moves King and Rook logic', async () => {
    // White King at 8,4. Rook at 8,0.
    game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };

    // Real castling logic relies on "specialMove" flag often passed from Validator
    // For MoveExecutor, it often *constructs* the special move OR receives it?
    // Looking at code: MoveExecutor constructs `moveRecord`.
    // It detects castling by `piece.type === 'k' && Math.abs(to.c - from.c) > 1`.

    await MoveExecutor.executeMove(game, moveController, { r: 8, c: 4 }, { r: 8, c: 2 });

    expect(game.board[8][4]).toBeNull();
    expect(game.board[8][2].type).toBe('k'); // King moved
    expect(game.board[8][0]).toBeNull(); // Rook moved from 0
    expect(game.board[8][3].type).toBe('r'); // Rook moved to 3
  });

  test('Check Detection: Integration with MoveValidator', async () => {
    // Setup Check scenario: White Rook attacks Black King
    game.board[0][4] = { type: 'k', color: 'black' };
    game.board[8][4] = { type: 'r', color: 'white' }; // On same file

    // Check Detection
    // Use a simple Rook check.
    // Board is cleared.
    // Place Black King at 3,3.
    game.board[0][4] = null;
    game.board[3][3] = { type: 'k', color: 'black' };

    // White Rook at 3,0.
    game.board[3][0] = { type: 'r', color: 'white' };

    // Add White King to prevent Insufficient Material draw!
    game.board[8][8] = { type: 'k', color: 'white' };

    // Move Rook from 3,0 to 3,1. Should check 3,3.
    await MoveExecutor.executeMove(game, moveController, { r: 3, c: 0 }, { r: 3, c: 1 });

    // Assertions
    expect(UI.animateCheck).toHaveBeenCalledWith(expect.anything(), 'black');
    expect(soundManager.playCheck).toHaveBeenCalled();
  });

  test('Checkmate: Real Checkmate Scenario', async () => {
    // Fool's Mate equivalent or simple Rook mate.
    // Black King at 0,0. White Rooks at 0,1 and 1,0?
    // Let's trap Black King at 0,0.
    game.board[0][0] = { type: 'k', color: 'black' };
    game.board[0][4] = null; // Removing original king

    // White Rook 1 cuts off row 1.
    game.board[1][8] = { type: 'r', color: 'white' };

    // White Rook 2 moves to row 0 to mate.
    game.board[6][8] = { type: 'r', color: 'white' };

    // Move White Rook 2 to 0,8
    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 8 }, { r: 0, c: 8 });

    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(UI.animateCheckmate).toHaveBeenCalled();
    expect(soundManager.playGameOver).toHaveBeenCalledWith(true); // Player won
  });

  test('Insufficient Material: Real Logic', async () => {
    // Redefine getElementById behavior for this test
    const winnerText = { textContent: '' };

    // We must preserve the 'game-log' behavior!
    const logMock = {
      appendChild: vi.fn(),
      scrollTop: 0,
      scrollHeight: 100,
    };

    document.getElementById = vi.fn(id => {
      if (id === 'winner-text') return winnerText;
      if (id === 'game-log') return logMock;
      // Fallback for everything else
      return {
        textContent: '',
        classList: { remove: vi.fn(), add: vi.fn() },
        appendChild: vi.fn(), // Safety net
        style: {},
      };
    });

    // Only Kings left
    // Ensure board is clear for safety (though beforeEach does it)
    game.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    game.board[0][4] = { type: 'k', color: 'black' };
    game.board[8][4] = { type: 'k', color: 'white' };

    // Create a dummy move (King step)
    await MoveExecutor.executeMove(game, moveController, { r: 8, c: 4 }, { r: 7, c: 4 });

    expect(game.phase).toBe(PHASES.GAME_OVER); // Draw by insufficient material
    expect(winnerText.textContent).toMatch(/Unentschieden/);
  });

  test('3D Battle: Integration with window.battleChess3D', async () => {
    window.battleChess3D = {
      enabled: true,
      playBattleSequence: vi.fn(() => Promise.resolve()),
      removePiece: vi.fn(),
      animateMove: vi.fn(),
    };

    game.board[6][0] = { type: 'r', color: 'white' };
    game.board[5][0] = { type: 'p', color: 'black' };
    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 0 }, { r: 5, c: 0 });
    expect(window.battleChess3D.playBattleSequence).toHaveBeenCalled();
  });

  test('AI Move Trigger: Verified via timeout', async () => {
    vi.useFakeTimers();
    game.isAI = true;
    game.turn = 'white'; // Will become black
    game.aiMove = vi.fn();

    game.board[6][4] = { type: 'p', color: 'white' };
    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 4 }, { r: 5, c: 4 });

    vi.advanceTimersByTime(1500);
    expect(game.aiMove).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('Puzzle Mode: Correct Move', async () => {
    game.mode = 'puzzle';
    game.puzzleState = { currentMoveIndex: 0, puzzleId: 'test-puzzle' };
    game.board[6][4] = { type: 'p', color: 'white' };
    puzzleManager.checkMove.mockReturnValue('correct');

    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 4 }, { r: 5, c: 4 });

    expect(UI.updatePuzzleStatus).toHaveBeenCalledWith('neutral', expect.any(String));
  });

  test('Puzzle Mode: Solved', async () => {
    game.mode = 'puzzle';
    game.board[6][4] = { type: 'p', color: 'white' };
    puzzleManager.checkMove.mockReturnValue('solved');

    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 4 }, { r: 5, c: 4 });

    expect(UI.updatePuzzleStatus).toHaveBeenCalledWith('success', expect.any(String));
    expect(soundManager.playSuccess).toHaveBeenCalled();
  });

  test('Puzzle Wrong: Triggers error UI and sound', async () => {
    // Setup Puzzle Mode
    game.mode = 'puzzle';
    game.board[6][4] = { type: 'p', color: 'white' };

    puzzleManager.checkMove.mockReturnValue('wrong');

    vi.useFakeTimers();
    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 4 }, { r: 5, c: 4 });
    vi.advanceTimersByTime(500);

    expect(UI.updatePuzzleStatus).toHaveBeenCalledWith('error', expect.any(String));
    expect(soundManager.playError).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('Auto-save: Triggers saveGame after a move', async () => {
    // game.settings might not exist on Game class based on view_file.
    // MoveExecutor checks: if (game.moveHistory.length % 5 === 0)
    // AND checks game.gameController.saveGame.

    // Setup
    game.moveHistory = [1, 2, 3, 4]; // 4 moves already
    game.gameController = {
      saveGame: vi.fn(),
      saveGameToStatistics: vi.fn(),
    };
    // Ensure no error thrown
    game.board[6][4] = { type: 'p', color: 'white' };

    await MoveExecutor.executeMove(game, moveController, { r: 6, c: 4 }, { r: 5, c: 4 });

    expect(game.gameController.saveGame).toHaveBeenCalledWith(true);
  });
});
