import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { Game, createEmptyBoard } from '../js/gameEngine';
import { PHASES } from '../js/config';
import { setupJSDOM } from './test-utils';
import { MoveController } from '../js/moveController';
import * as UIModule from '../js/ui';
import { soundManager } from '../js/sounds';

// Define types for mocks
type MockUI = {
  renderBoard: MockInstance;
  showModal: MockInstance;
  showPromotionModal: MockInstance;
  showPromotionUI: MockInstance;
  showToast: MockInstance;
  animateMove: MockInstance;
  animateCheck: MockInstance;
  animateCheckmate: MockInstance;
  updateStatistics: MockInstance;
  updateMoveHistoryUI: MockInstance;
  updateCapturedUI: MockInstance;
  updateStatus: MockInstance;
  updateShopUI: MockInstance;
  showShop: MockInstance;
  updateClockDisplay: MockInstance;
  updateClockUI: MockInstance;
  renderEvalGraph: MockInstance;
};

// Extended Game interface for testing to include mocked methods and properties
interface TestGame
  extends Omit<Game, 'moveController' | 'log' | 'stopClock' | 'startClock' | 'updateBestMoves'> {
  moveController?: MoveController;
  log: MockInstance;
  stopClock: MockInstance;
  startClock: MockInstance;
  updateBestMoves: MockInstance;
  aiMove?: MockInstance;
  isTutorMove?: MockInstance;
  currentTheme?: string;
  // Use any for stats to avoid strict GameStats checks in tests
  stats: any;
  // Override properties that might conflict with Game
  [key: string]: any;
}

// Mock UI and SoundManager modules
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  showPromotionModal: vi.fn(),
  showPromotionUI: vi.fn(),
  showToast: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
  animateCheck: vi.fn(),
  animateCheckmate: vi.fn(),
  updateStatistics: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  showShop: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playCheckmate: vi.fn(),
    playGameOver: vi.fn(),
  },
}));

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(() => 0),
  findKing: vi.fn(() => ({ r: 0, c: 0 })),
  getBestMove: vi.fn().mockResolvedValue(null),
}));

// Mock localStorage
Storage.prototype.getItem = vi.fn(() => null);
Storage.prototype.setItem = vi.fn();
Storage.prototype.removeItem = vi.fn();
Storage.prototype.clear = vi.fn();

// Mock alert
global.alert = vi.fn();

// Cast UI to MockUI to access mock methods
const UI = UIModule as unknown as MockUI;

describe('MoveController', () => {
  let game: TestGame;
  let moveController: MoveController;

  beforeEach(() => {
    setupJSDOM();
    game = new Game() as unknown as TestGame;
    // Cast to any to allow easier test setup with partial objects if needed
    game.board = createEmptyBoard() as any;
    game.phase = PHASES.PLAY;

    moveController = new MoveController(game);
    game.moveController = moveController; // Link back
    game.log = vi.fn(); // Mock log function
    game.stopClock = vi.fn();
    game.startClock = vi.fn();
    game.updateBestMoves = vi.fn();
    game.stats = {
      playerMoves: 0,
      playerBestMoves: 0,
      totalMoves: 0,
      captures: 0,
      promotions: 0,
      accuracies: [],
    }; // Initialize basic stats

    // Place Kings to avoid "King captured" game over logic
    // Use corners to avoid conflict with test moves (usually in center/files 4)
    // Using 'any' for piece assignment to bypass strict PieceWithMoved checks in setup
    game.board[0][0] = { type: 'k', color: 'black', hasMoved: false } as any;
    game.board[8][8] = { type: 'k', color: 'white', hasMoved: false } as any;

    vi.clearAllMocks();
  });

  it('should execute a simple move', async () => {
    // Setup: White Pawn at 6,4
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false } as any;

    const from = { r: 6, c: 4 };
    const to = { r: 5, c: 4 };

    await moveController.executeMove(from, to);

    // Check board update
    expect(game.board[6][4]).toBeNull();
    // Casting to any for expect check to avoid strict type issues with jest matchers
    expect(game.board[5][4]).toEqual(
      expect.objectContaining({ type: 'p', color: 'white', hasMoved: true })
    );

    // Check turn switch
    expect(game.turn).toBe('black');

    // Check UI update
    expect(UI.renderBoard).toHaveBeenCalled();
    expect(soundManager.playMove).toHaveBeenCalled();
  });

  it('should handle capture', async () => {
    // Setup: White Rook at 4,4, Black Pawn at 4,6
    game.board[4][4] = { type: 'r', color: 'white' } as any;
    game.board[4][6] = { type: 'p', color: 'black' } as any;

    const from = { r: 4, c: 4 };
    const to = { r: 4, c: 6 };

    await moveController.executeMove(from, to);

    // Check board
    expect(game.board[4][4]).toBeNull();
    expect(game.board[4][6]!.type).toBe('r');

    // Check captures
    expect(game.capturedPieces.white.length).toBe(1); // White captured a piece
    expect(game.capturedPieces.white[0].type).toBe('p');

    // Check sound
    expect(soundManager.playCapture).toHaveBeenCalled();
  });

  it('should handle promotion', async () => {
    // Setup: White Pawn at 1,4 (about to promote)
    game.board[1][4] = { type: 'p', color: 'white' } as any;

    const from = { r: 1, c: 4 };
    const to = { r: 0, c: 4 };

    // Mock showPromotionUI to immediately call callback
    (UI.showPromotionUI as unknown as MockInstance).mockImplementation(function (
      _g: any,
      _r: number,
      _c: number,
      _color: string,
      _record: any,
      callback: Function
    ) {
      // Manually set the piece to Angel (e)
      game.board[0][4] = { type: 'e', color: 'white', hasMoved: true } as any;
      // Call the callback to finish move
      callback();
    });

    await moveController.executeMove(from, to);

    // Check board - was manually promoted to Angel by the mock
    expect(game.board[0][4]!.type).toBe('e');
  });

  it('should correctly undo promotion', async () => {
    // Setup: White Pawn at 1,4 (about to promote)
    game.board[1][4] = { type: 'p', color: 'white' } as any;

    const from = { r: 1, c: 4 };
    const to = { r: 0, c: 4 };

    await moveController.executeMove(from, to);

    // Verify promotion
    expect(game.board[0][4]!.type).toBe('e');

    // Undo
    moveController.undoMove();

    // Should be back to pawn at 1,4
    expect(game.board[1][4]).not.toBeNull();
    expect(game.board[1][4]!.type).toBe('p');
    expect(game.board[0][4]).toBeNull();
  });

  it('should handle undo move', async () => {
    // Setup: Execute a move first
    game.board[6][4] = { type: 'p', color: 'white' } as any;
    const from = { r: 6, c: 4 };
    const to = { r: 5, c: 4 };

    await moveController.executeMove(from, to);
    expect(game.board[5][4]).not.toBeNull();

    // Now undo
    moveController.undoMove();

    // Piece should be back at original position
    expect(game.board[6][4]).not.toBeNull();
    expect(game.board[5][4]).toBeNull();
    expect(game.turn).toBe('white'); // Turn should be back to white
  });

  it('should handle castling kingside', async () => {
    // Setup: White King and Rook for kingside castling
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false } as any;
    game.board[8][8] = { type: 'r', color: 'white', hasMoved: false } as any;

    const from = { r: 8, c: 4 };
    const to = { r: 8, c: 6 }; // Kingside castle

    await moveController.executeMove(from, to);

    // King should move to g1 (col 6), Rook to f1 (col 5)
    expect(game.board[8][6]).not.toBeNull();
    expect(game.board[8][6]!.type).toBe('k');
    expect(game.board[8][5]).not.toBeNull();
    expect(game.board[8][5]!.type).toBe('r');
  });

  it('should correctly undo kingside castling', async () => {
    // Setup: White King and Rook for kingside castling
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false } as any;
    game.board[8][8] = { type: 'r', color: 'white', hasMoved: false } as any;

    const from = { r: 8, c: 4 };
    const to = { r: 8, c: 6 }; // Kingside castle

    await moveController.executeMove(from, to);
    moveController.undoMove();

    // King should be back at e1 (8, 4)
    expect(game.board[8][4]).not.toBeNull();
    expect(game.board[8][4]!.type).toBe('k');
    expect(game.board[8][4]!.hasMoved).toBe(false);

    // Rook should be back at i1 (8, 8)
    expect(game.board[8][8]).not.toBeNull();
    expect(game.board[8][8]!.type).toBe('r');
    expect(game.board[8][8]!.hasMoved).toBe(false);

    // Castling squares should be empty
    expect(game.board[8][6]).toBeNull();
    expect(game.board[8][5]).toBeNull();
  });

  it('should handle en passant', async () => {
    // Setup: Black pawn does double move
    game.board[1][4] = { type: 'p', color: 'black' } as any;
    await moveController.executeMove({ r: 1, c: 4 }, { r: 3, c: 4 });

    // White pawn positioned to capture en passant
    game.board[3][3] = { type: 'p', color: 'white' } as any;
    game.turn = 'white';

    // En passant capture
    await moveController.executeMove({ r: 3, c: 3 }, { r: 2, c: 4 });

    // White pawn should be at 2,4 and black pawn at 3,4 should be gone
    expect(game.board[2][4]).not.toBeNull();
    expect(game.board[2][4]!.type).toBe('p');
    expect(game.board[3][4]).toBeNull();
  });

  it('should correctly undo en passant', async () => {
    // Setup: Black pawn does double move
    game.board[1][4] = { type: 'p', color: 'black' } as any;
    await moveController.executeMove({ r: 1, c: 4 }, { r: 3, c: 4 });

    // White pawn positioned to capture en passant
    game.board[3][3] = { type: 'p', color: 'white' } as any;
    game.turn = 'white';

    // En passant capture
    await moveController.executeMove({ r: 3, c: 3 }, { r: 2, c: 4 });

    // Undo
    moveController.undoMove();

    // White pawn back at 3,3
    expect(game.board[3][3]).not.toBeNull();
    expect(game.board[3][3]!.type).toBe('p');

    // Black pawn back at 3,4 (captured pawn restored)
    expect(game.board[3][4]).not.toBeNull();
    expect(game.board[3][4]!.type).toBe('p');
    expect(game.board[3][4]!.color).toBe('black');

    // Destination square empty
    expect(game.board[2][4]).toBeNull();
  });

  it('should record move in history', async () => {
    game.board[6][4] = { type: 'p', color: 'white' } as any;
    const initialHistoryLength = game.moveHistory.length;

    await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

    expect(game.moveHistory.length).toBe(initialHistoryLength + 1);
    expect(game.moveHistory[game.moveHistory.length - 1]).toMatchObject({
      from: { r: 6, c: 4 },
      to: { r: 5, c: 4 },
    });
  });

  it('should handle redo move', async () => {
    // Setup and execute a move
    game.board[6][4] = { type: 'p', color: 'white' } as any;
    await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

    // Undo the move
    moveController.undoMove();
    expect(game.board[6][4]).not.toBeNull();
    expect(game.board[5][4]).toBeNull();

    // Redo the move
    await moveController.redoMove();

    // After redo, piece should be at the destination again
    expect(game.board[5][4]).not.toBeNull();
    expect(game.board[5][4]!.type).toBe('p');
    expect(game.board[6][4]).toBeNull();
  });

  it('should clear redo stack when new move is made', async () => {
    // Setup and execute a move
    game.board[6][4] = { type: 'p', color: 'white' } as any;
    await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

    // Undo
    moveController.undoMove();

    // Make a different move (should clear redo stack)
    game.board[6][3] = { type: 'p', color: 'white' } as any;
    await moveController.executeMove({ r: 6, c: 3 }, { r: 5, c: 3 });

    // Redo should not work now
    // Accessing private property redoStack via casting to any for testing
    expect((moveController as any).redoStack.length).toBe(0);
    const initialHistoryLength = game.moveHistory.length;
    moveController.redoMove();
    expect(game.moveHistory.length).toBe(initialHistoryLength);
  });

  it('should handle castling queenside', async () => {
    // Setup: White King and Rook for queenside castling
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false } as any;
    game.board[8][0] = { type: 'r', color: 'white', hasMoved: false } as any;

    const from = { r: 8, c: 4 };
    const to = { r: 8, c: 2 }; // Queenside castle

    await moveController.executeMove(from, to);

    // King should move to c1 (col 2), Rook to d1 (col 3)
    expect(game.board[8][2]).not.toBeNull();
    expect(game.board[8][2]!.type).toBe('k');
    expect(game.board[8][3]).not.toBeNull();
    expect(game.board[8][3]!.type).toBe('r');
  });

  it('should correctly undo queenside castling', async () => {
    // Setup: White King and Rook for queenside castling
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false } as any;
    game.board[8][0] = { type: 'r', color: 'white', hasMoved: false } as any;

    const from = { r: 8, c: 4 };
    const to = { r: 8, c: 2 }; // Queenside castle

    await moveController.executeMove(from, to);
    moveController.undoMove();

    // King should be back at e1 (8, 4)
    expect(game.board[8][4]).not.toBeNull();
    expect(game.board[8][4]!.type).toBe('k');
    expect(game.board[8][4]!.hasMoved).toBe(false);

    // Rook should be back at a1 (8, 0)
    expect(game.board[8][0]).not.toBeNull();
    expect(game.board[8][0]!.type).toBe('r');
    expect(game.board[8][0]!.hasMoved).toBe(false);

    // Castling squares should be empty
    expect(game.board[8][2]).toBeNull();
    expect(game.board[8][3]).toBeNull();
  });

  it('should set hasMoved flag on pieces', async () => {
    // Setup: fresh piece without hasMoved
    game.board[6][4] = { type: 'p', color: 'white' } as any;

    await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

    // hasMoved should be set
    expect(game.board[5][4]!.hasMoved).toBe(true);
  });

  it('should handle multiple undo operations', async () => {
    // Execute 3 moves
    game.board[6][4] = { type: 'p', color: 'white' } as any;
    await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

    game.board[1][4] = { type: 'p', color: 'black' } as any;
    await moveController.executeMove({ r: 1, c: 4 }, { r: 2, c: 4 });

    game.board[5][4] = { type: 'p', color: 'white', hasMoved: true } as any;
    await moveController.executeMove({ r: 5, c: 4 }, { r: 4, c: 4 });

    // Verify we have 3 moves in history
    expect(game.moveHistory.length).toBeGreaterThanOrEqual(3);

    // Undo all 3
    moveController.undoMove();
    moveController.undoMove();
    moveController.undoMove();

    // Should be back to initial state
    expect(game.turn).toBe('white'); // Back to white's turn
    expect(game.moveHistory.length).toBe(0); // All moves undone
  });

  describe('handlePlayClick', () => {
    it('should select own piece', () => {
      game.board[4][4] = { type: 'p', color: 'white' } as any;

      moveController.handlePlayClick(4, 4);

      expect(game.selectedSquare).toEqual({ r: 4, c: 4 });
      expect(game.validMoves).toBeDefined();
      expect(UI.renderBoard).toHaveBeenCalled();
    });

    it('should deselect when clicking empty square', () => {
      game.selectedSquare = { r: 4, c: 4 };
      game.validMoves = [{ r: 3, c: 4 }];

      moveController.handlePlayClick(2, 2);

      expect(game.selectedSquare).toBeNull();
      expect(game.validMoves).toBeNull();
    });

    it('should switch selection when clicking different own piece', () => {
      game.board[4][4] = { type: 'p', color: 'white' } as any;
      game.board[5][5] = { type: 'r', color: 'white' } as any;
      game.selectedSquare = { r: 4, c: 4 };

      moveController.handlePlayClick(5, 5);

      expect(game.selectedSquare).toEqual({ r: 5, c: 5 });
    });

    it('should show threats when clicking enemy piece', () => {
      game.board[4][4] = { type: 'q', color: 'black' } as any;

      moveController.handlePlayClick(4, 4);

      expect(game.selectedSquare).toEqual({ r: 4, c: 4 });
      expect(game.validMoves).toBeDefined();
    });

    it('should track player stats for valid move', () => {
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      game.turn = 'white';
      game.selectedSquare = { r: 6, c: 4 };
      game.validMoves = [{ r: 5, c: 4 }];
      game.stats = { playerMoves: 0, playerBestMoves: 0 };

      // Mock tutor move check
      game.isTutorMove = vi.fn(() => true);

      moveController.handlePlayClick(5, 4);

      expect(game.stats.playerMoves).toBe(1);
      expect(game.stats.playerBestMoves).toBe(1);
    });
  });

  describe('Draw Conditions', () => {
    it('should detect insufficient material (K vs K)', () => {
      game.board = createEmptyBoard() as any;
      game.board[0][0] = { type: 'k', color: 'black' } as any;
      game.board[8][8] = { type: 'k', color: 'white' } as any;

      expect(moveController.isInsufficientMaterial()).toBe(true);
    });

    it('should detect insufficient material (K+N vs K)', () => {
      game.board = createEmptyBoard() as any;
      game.board[0][0] = { type: 'k', color: 'black' } as any;
      game.board[8][8] = { type: 'k', color: 'white' } as any;
      game.board[7][7] = { type: 'n', color: 'white' } as any;

      expect(moveController.isInsufficientMaterial()).toBe(true);
    });

    it('should detect insufficient material (K+B vs K)', () => {
      game.board = createEmptyBoard() as any;
      game.board[0][0] = { type: 'k', color: 'black' } as any;
      game.board[8][8] = { type: 'k', color: 'white' } as any;
      game.board[7][7] = { type: 'b', color: 'white' } as any;

      expect(moveController.isInsufficientMaterial()).toBe(true);
    });

    it('should NOT detect insufficient material with pawn', () => {
      game.board = createEmptyBoard() as any;
      game.board[0][0] = { type: 'k', color: 'black' } as any;
      game.board[8][8] = { type: 'k', color: 'white' } as any;
      game.board[6][4] = { type: 'p', color: 'white' } as any;

      expect(moveController.isInsufficientMaterial()).toBe(false);
    });
  });

  describe('Save and Load Game', () => {
    it('should call localStorage.setItem when saving', () => {
      moveController.saveGame();

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'schach9x9_save_autosave',
        expect.any(String)
      );
    });

    it('should handle missing save data', () => {
      // Ensure getItem returns null (already default, but explicit)
      (Storage.prototype.getItem as unknown as MockInstance).mockReturnValueOnce(null);

      moveController.loadGame();

      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('gefunden'));
    });

    it('should successfully load a saved game', () => {
      const savedState = {
        board: createEmptyBoard(),
        phase: PHASES.PLAY,
        turn: 'black',
        points: { white: 10, black: 10 },
        moveHistory: [],
        capturedPieces: { white: [], black: [] },
        isAI: false,
        difficulty: 'medium',
      };

      (Storage.prototype.getItem as unknown as MockInstance).mockReturnValue(
        JSON.stringify(savedState)
      );

      // Explicitly mock getElementById for this test to avoid leakage issues
      document.getElementById = vi.fn((id: string) => {
        if (id === 'ai-toggle') return { checked: false, addEventListener: vi.fn() } as any;
        if (id === 'difficulty-select')
          return { value: 'medium', addEventListener: vi.fn() } as any;
        if (id === 'draw-offer-overlay')
          return { classList: { remove: vi.fn(), add: vi.fn() } } as any;
        if (id === 'move-history-panel')
          return { classList: { remove: vi.fn(), add: vi.fn() } } as any;
        if (id === 'captured-pieces-panel')
          return { classList: { remove: vi.fn(), add: vi.fn() } } as any;
        return {
          classList: { remove: vi.fn(), add: vi.fn() },
          style: {},
          textContent: '',
          value: '',
          checked: false,
          innerHTML: '',
          addEventListener: vi.fn(),
        } as any;
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(function () {});

      moveController.loadGame();

      expect(game.turn).toBe('black');
      expect(game.phase).toBe(PHASES.PLAY);
      expect(UI.renderBoard).toHaveBeenCalled();
      expect(UI.updateStatus).toHaveBeenCalled();
      expect(UI.updateShopUI).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should handle corrupt save data', () => {
      (Storage.prototype.getItem as unknown as MockInstance).mockReturnValue('invalid-json');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const success = moveController.loadGame();

      expect(success).toBe(false);
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Fehler'));
      errorSpy.mockRestore();
    });
  });

  describe('Material Calculation', () => {
    it('should calculate material advantage correctly', () => {
      game.board = createEmptyBoard() as any;
      game.board[0][0] = { type: 'k', color: 'black' } as any;
      game.board[8][8] = { type: 'k', color: 'white' } as any;
      game.board[7][7] = { type: 'q', color: 'white' } as any; // +9
      game.board[0][4] = { type: 'r', color: 'black' } as any; // -5

      const advantage = moveController.calculateMaterialAdvantage();

      expect(advantage).toBe(4);
    });

    it('should return correct value for Angel piece', () => {
      const angel = { type: 'e', color: 'white' } as any;

      expect(moveController.getMaterialValue(angel)).toBe(12);
    });
  });

  describe('Replay Mode', () => {
    beforeEach(() => {
      // Mock replay-specific elements
      document.getElementById = vi.fn((id: string) => {
        if (id === 'replay-status' || id === 'replay-exit' || id === 'undo-btn') {
          return {
            classList: { remove: vi.fn(), add: vi.fn() },
            disabled: false,
            textContent: '',
          } as any;
        }
        return {
          classList: { remove: vi.fn(), add: vi.fn() },
          style: {},
          textContent: '',
          value: '',
          checked: false,
          disabled: false,
          appendChild: vi.fn(),
          scrollTop: 0,
          scrollHeight: 100,
          innerHTML: '',
        } as any;
      });
    });

    it('should enter replay mode', async () => {
      // Setup: Make a move so we have history
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      moveController.enterReplayMode();

      expect(game.replayMode).toBe(true);
      expect(game.replayPosition).toBe(0);
      expect(game.stopClock).toHaveBeenCalled();
      expect(game.savedGameState).toBeDefined();
    });

    it('should exit replay mode', async () => {
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });
      moveController.enterReplayMode();

      moveController.exitReplayMode();

      expect(game.replayMode).toBe(false);
      expect(game.replayPosition).toBe(-1);
      expect(game.savedGameState).toBeNull();
    });

    it('should navigate through replay', async () => {
      // Setup: 3 moves
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      game.board[1][4] = { type: 'p', color: 'black' } as any;
      await moveController.executeMove({ r: 1, c: 4 }, { r: 2, c: 4 });

      game.board[5][4] = { type: 'p', color: 'white', hasMoved: true } as any;
      await moveController.executeMove({ r: 5, c: 4 }, { r: 4, c: 4 });

      moveController.enterReplayMode();
      expect(game.replayPosition).toBe(2);

      moveController.replayFirst();
      expect(game.replayPosition).toBe(-1);

      moveController.replayNext();
      expect(game.replayPosition).toBe(0);

      moveController.replayLast();
      expect(game.replayPosition).toBe(2);

      moveController.replayPrevious();
      expect(game.replayPosition).toBe(1);
    });

    it('undoMoveForReplay should handle castling', () => {
      // Setup a move record for castling
      const move: any = {
        from: { r: 8, c: 4 },
        to: { r: 8, c: 6 },
        piece: { type: 'k', color: 'white', hasMoved: false },
        specialMove: {
          type: 'castling',
          rookFrom: { r: 8, c: 8 },
          rookTo: { r: 8, c: 5 },
          rookHadMoved: false,
        },
      };

      // Setup board state AFTER castling
      game.board[8][6] = { type: 'k', color: 'white', hasMoved: true } as any;
      game.board[8][5] = { type: 'r', color: 'white', hasMoved: true } as any;
      game.board[8][4] = null;
      game.board[8][8] = null;

      moveController.undoMoveForReplay(move);

      // Verify board state restored
      expect(game.board[8][4]!.type).toBe('k');
      expect(game.board[8][8]!.type).toBe('r');
      expect(game.board[8][6]).toBeNull();
      expect(game.board[8][5]).toBeNull();
    });

    it('undoMoveForReplay should handle en passant', () => {
      const move: any = {
        from: { r: 3, c: 3 },
        to: { r: 2, c: 4 },
        piece: { type: 'p', color: 'white', hasMoved: true },
        specialMove: {
          type: 'enPassant',
          capturedPawn: { type: 'p', color: 'black', hasMoved: true },
          capturedPawnPos: { r: 3, c: 4 },
        },
      };

      // Setup board state AFTER en passant
      game.board[2][4] = { type: 'p', color: 'white', hasMoved: true } as any;
      game.board[3][3] = null;
      game.board[3][4] = null; // Captured pawn is gone

      moveController.undoMoveForReplay(move);

      // Verify
      expect(game.board[3][3]!.type).toBe('p'); // Mover back
      expect(game.board[3][4]!.type).toBe('p'); // Captured back
      expect(game.board[3][4]!.color).toBe('black');
      expect(game.board[2][4]).toBeNull();
    });

    it('undoMoveForReplay should handle promotion', () => {
      const move: any = {
        from: { r: 1, c: 0 },
        to: { r: 0, c: 0 },
        piece: { type: 'e', color: 'white', hasMoved: true }, // Promoted piece
        specialMove: {
          type: 'promotion',
          promotedTo: 'e',
        },
      };

      // Setup board state AFTER promotion
      game.board[0][0] = { type: 'e', color: 'white', hasMoved: true } as any;
      game.board[1][0] = null;

      moveController.undoMoveForReplay(move);

      // Verify
      expect(game.board[1][0]!.type).toBe('p'); // Should be pawn again
      expect(game.board[0][0]).toBeNull();
    });

    it('setTheme should update theme and localStorage', () => {
      // Spy on the mock function directly
      const setItemSpy = Storage.prototype.setItem;

      // Mock document.body.setAttribute
      document.body.setAttribute = vi.fn();

      moveController.setTheme('dark-mode');

      expect(game.currentTheme).toBe('dark-mode');
      expect(document.body.setAttribute).toHaveBeenCalledWith('data-theme', 'dark-mode');
      expect(setItemSpy).toHaveBeenCalledWith('chess_theme', 'dark-mode');
    });
  });

  describe('Draw Detection', () => {
    beforeEach(() => {
      // Mock game-over overlay elements
      document.getElementById = vi.fn((id: string) => {
        if (id === 'game-over-overlay' || id === 'winner-text') {
          return {
            classList: { remove: vi.fn(), add: vi.fn() },
            textContent: '',
          } as any;
        }
        return {
          classList: { remove: vi.fn(), add: vi.fn() },
          style: {},
          textContent: '',
          value: '',
          checked: false,
          disabled: false,
          appendChild: vi.fn(),
          scrollTop: 0,
          scrollHeight: 100,
          innerHTML: '',
        } as any;
      });
    });

    it('should detect 50-move rule', () => {
      game.halfMoveClock = 100;
      const result = moveController.checkDraw();
      expect(result).toBe(true);
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });

    it('should detect 3-fold repetition', () => {
      game.positionHistory = ['hash1', 'hash2', 'hash1', 'hash3', 'hash1'];
      moveController.getBoardHash = vi.fn(() => 'hash1');

      const result = moveController.checkDraw();
      expect(result).toBe(true);
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });
  });

  describe('handlePlayClick EdgeCases', () => {
    it('should deselect when clicking empty square with piece selected', () => {
      game.board[6][0] = { type: 'p', color: 'white' } as any;
      game.turn = 'white';
      moveController.handlePlayClick(6, 0);
      expect(game.selectedSquare).toEqual({ r: 6, c: 0 });

      moveController.handlePlayClick(5, 5); // empty square
      expect(game.selectedSquare).toBeNull();
    });

    it('should switch selection between own pieces', () => {
      game.board[6][0] = { type: 'p', color: 'white' } as any;
      game.board[6][1] = { type: 'p', color: 'white' } as any;
      game.turn = 'white';

      moveController.handlePlayClick(6, 0);
      const firstSelection = game.selectedSquare;

      moveController.handlePlayClick(6, 1);
      const secondSelection = game.selectedSquare;

      expect(firstSelection).toEqual({ r: 6, c: 0 });
      expect(secondSelection).toEqual({ r: 6, c: 1 });
    });
  });

  describe('Coverage Improvements', () => {
    it('enterReplayMode should do nothing if already in replay mode', () => {
      game.moveHistory.push({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } } as any); // Ensure history is not empty
      moveController.enterReplayMode();
      const firstState = game.savedGameState;

      moveController.enterReplayMode(); // Call again
      expect(game.savedGameState).toBe(firstState); // Should be same object reference
    });

    it('enterReplayMode should do nothing if history is empty', () => {
      game.moveHistory = [];
      moveController.enterReplayMode();
      expect(game.replayMode).toBeFalsy();
    });

    it('exitReplayMode should do nothing if not in replay mode', () => {
      game.replayMode = false;
      moveController.exitReplayMode();
      expect(game.savedGameState).toBeNull(); // Should remain null
    });

    it('replay navigation functions should enter replay mode if not active', () => {
      // Ensure history with valid move structure
      game.moveHistory.push({
        from: { r: 6, c: 4 },
        to: { r: 5, c: 4 },
        piece: { type: 'p', color: 'white', hasMoved: true },
      } as any);

      // Mock board state for the move
      game.board[5][4] = { type: 'p', color: 'white', hasMoved: true } as any;

      moveController.replayFirst();
      expect(game.replayMode).toBe(true);
      moveController.exitReplayMode();

      moveController.replayPrevious();
      expect(game.replayMode).toBe(true);
      moveController.exitReplayMode();

      moveController.replayNext();
      expect(game.replayMode).toBe(true);
      moveController.exitReplayMode();

      moveController.replayLast();
      expect(game.replayMode).toBe(true);
      moveController.exitReplayMode();
    });
  });

  describe('executeMove Edge Cases', () => {
    it('should detect checkmate', async () => {
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      game.isCheckmate = vi.fn(() => true);

      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(UI.animateCheckmate).toHaveBeenCalled();
    });

    it('should detect stalemate', async () => {
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      game.isCheckmate = vi.fn(() => false);
      game.isStalemate = vi.fn(() => true);

      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(UI.updateStatus).toHaveBeenCalled();
    });

    it('should trigger AI move if enabled', async () => {
      vi.useFakeTimers();
      game.board[6][4] = { type: 'p', color: 'white' } as any;
      game.isAI = true;
      game.turn = 'white'; // Start with white, executeMove switches to black, triggering AI
      game.aiMove = vi.fn();

      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      vi.runAllTimers();

      expect(game.aiMove).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Undo/Redo Complex Scenarios', () => {
    it('should undo and redo castling', async () => {
      // Mock animateMove to avoid async issues/delays
      (moveController as any).animateMove = vi.fn().mockResolvedValue(undefined);

      // Setup castling situation
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false } as any;
      game.board[8][8] = { type: 'r', color: 'white', hasMoved: false } as any;
      // Clear path
      game.board[8][5] = null;
      game.board[8][6] = null;
      game.board[8][7] = null;

      const from = { r: 8, c: 4 };
      const to = { r: 8, c: 6 }; // Kingside castling target

      await moveController.executeMove(from, to);

      // Verify castling execution
      expect(game.board[8][6]!.type).toBe('k');
      expect(game.board[8][5]!.type).toBe('r');

      // Undo
      moveController.undoMove();

      expect(game.board[8][4]!.type).toBe('k');
      expect(game.board[8][8]!.type).toBe('r');
      expect(game.board[8][6]).toBeNull();
      expect(game.board[8][5]).toBeNull();

      // Redo
      await moveController.redoMove();

      expect(game.board[8][6]!.type).toBe('k');
      expect(game.board[8][5]!.type).toBe('r');
    });

    it('should undo and redo en passant', async () => {
      // Mock animateMove
      (moveController as any).animateMove = vi.fn().mockResolvedValue(undefined);

      // Setup en passant situation
      game.board[3][4] = { type: 'p', color: 'white' } as any;
      game.board[3][3] = { type: 'p', color: 'black' } as any;
      game.lastMove = {
        from: { r: 1, c: 3 },
        to: { r: 3, c: 3 },
        piece: { type: 'p', color: 'black' },
        isDoublePawnPush: true, // Correct property name
      } as any;

      const from = { r: 3, c: 4 };
      const to = { r: 2, c: 3 }; // En passant capture square

      await moveController.executeMove(from, to);

      // Verify capture
      expect(game.board[2][3]!.type).toBe('p');
      expect(game.board[3][3]).toBeNull(); // Captured pawn gone

      // Undo
      moveController.undoMove();

      expect(game.board[3][4]!.type).toBe('p'); // White pawn back
      expect(game.board[3][3]!.type).toBe('p'); // Black pawn back
      expect(game.board[2][3]).toBeNull();

      // Redo
      await moveController.redoMove();

      expect(game.board[2][3]!.type).toBe('p');
      expect(game.board[3][3]).toBeNull();
    });
  });

  describe('Game Over and Special States', () => {
    it('should handle checkmate', async () => {
      game.isCheckmate = vi.fn(() => true);
      game.turn = 'white';

      game.board[6][4] = { type: 'p', color: 'white' } as any;
      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(UI.animateCheckmate).toHaveBeenCalledWith(game, 'black');
      expect(soundManager.playGameOver).toHaveBeenCalled();
    });

    it('should handle stalemate', async () => {
      game.isStalemate = vi.fn(() => true);
      game.turn = 'white';

      game.board[6][4] = { type: 'p', color: 'white' } as any;
      await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('PATT'));
    });

    it('should generate consistent board hash', () => {
      game.board[0][0] = { type: 'k', color: 'black' } as any;
      game.board[8][8] = { type: 'k', color: 'white' } as any;

      const hash1 = moveController.getBoardHash();
      const hash2 = moveController.getBoardHash();
      expect(hash1).toBe(hash2);

      game.board[4][4] = { type: 'p', color: 'white' } as any;
      const hash3 = moveController.getBoardHash();
      expect(hash1).not.toBe(hash3);
    });
  });
});
