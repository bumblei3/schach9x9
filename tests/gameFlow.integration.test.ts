import { describe, expect, test, beforeEach, vi } from 'vitest';
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';
import { setupJSDOM } from './test-utils.js';

// Mock UI dependencies
vi.mock('../js/ui.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    renderBoard: vi.fn(),
    showModal: vi.fn((_title, _message, buttons) => {
      // Only auto-click 'Fortfahren' or 'OK', not 'undo' actions in tests unless desired
      const continueBtn = buttons.find((b: any) => b.text === 'Fortfahren' || b.text === 'OK');
      if (continueBtn && continueBtn.callback) continueBtn.callback();
    }),
    updateStatus: vi.fn(),
    updateShopUI: vi.fn(),
    showShop: vi.fn(),
    updateStatistics: vi.fn(),
    updateMoveHistoryUI: vi.fn(),
    updateCapturedUI: vi.fn(),
    updateClockUI: vi.fn(),
    updateClockDisplay: vi.fn(),
    showToast: vi.fn(),
    renderEvalGraph: vi.fn(),
    animateMove: vi.fn().mockResolvedValue(undefined),
    animateCheck: vi.fn(),
    animateCheckmate: vi.fn(),
    showPromotionUI: vi.fn(),
    showPuzzleOverlay: vi.fn(),
    updatePuzzleStatus: vi.fn(),
  };
});

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playGameStart: vi.fn(),
    playGameOver: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  },
}));

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(() => 0),
  findKing: vi.fn(() => ({ r: 0, c: 0 })),
  getBestMove: vi.fn().mockResolvedValue(null),
}));

import { GameController } from '../js/gameController.js';
import { MoveController } from '../js/moveController.js';
import { TutorController } from '../js/tutorController.js';
import * as UI from '../js/ui.js';

describe('Comprehensive Game Flow Integration Tests', () => {
  let game: any;
  let gc: GameController;
  let mc: MoveController;
  let tc: TutorController;

  beforeEach(() => {
    setupJSDOM();

    // Mock localStorage
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: any) => {
          store[key] = value.toString();
        }),
        clear: vi.fn(() => {
          store = {};
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
      };
    })();
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

    game = new Game(15, 'classic');
    gc = new GameController(game);
    mc = new MoveController(game);
    tc = new TutorController(game);

    game.gameController = gc;
    game.moveController = mc;
    game.tutorController = tc;

    // Link handlePlayClick as App does
    game.handlePlayClick = mc.handlePlayClick.bind(mc);

    vi.clearAllMocks();
  });

  describe('Auto-Save Trigger Integration', () => {
    test('should trigger save exactly every 5 moves', async () => {
      const saveSpy = vi.spyOn(gc, 'saveGame');

      // Move 1
      await mc.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });
      expect(saveSpy).not.toHaveBeenCalled();

      // Move 2
      await mc.executeMove({ r: 1, c: 4 }, { r: 2, c: 4 });
      expect(saveSpy).not.toHaveBeenCalled();

      // Move 3
      await mc.executeMove({ r: 7, c: 3 }, { r: 6, c: 3 });
      expect(saveSpy).not.toHaveBeenCalled();

      // Move 4
      await mc.executeMove({ r: 1, c: 3 }, { r: 2, c: 3 });
      expect(saveSpy).not.toHaveBeenCalled();

      // Move 5 - Should trigger auto-save
      await mc.executeMove({ r: 7, c: 2 }, { r: 6, c: 2 });
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(true); // Silent save

      // Move 6-9 (Black moves 3 times, White moves once)
      await mc.executeMove({ r: 1, c: 0 }, { r: 2, c: 0 }); // 6
      await mc.executeMove({ r: 7, c: 0 }, { r: 6, c: 0 }); // 7
      await mc.executeMove({ r: 1, c: 1 }, { r: 2, c: 1 }); // 8
      await mc.executeMove({ r: 7, c: 1 }, { r: 6, c: 1 }); // 9

      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Move 10 - Should trigger auto-save again
      await mc.executeMove({ r: 1, c: 2 }, { r: 2, c: 2 });
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Special Moves Integration', () => {
    test('should handle castling and update state correctly', async () => {
      // Clear pieces for easy castling
      game.board[8][5] = null; // Guard
      game.board[8][6] = null; // Chancellor
      game.board[8][7] = null; // Knight

      // Execute King move (castling)
      const from = { r: 8, c: 4 };
      const to = { r: 8, c: 6 };

      await mc.executeMove(from, to, false);

      expect(game.board[8][6]).toMatchObject({ type: 'k', color: 'white' });
      expect(game.board[8][5]).toMatchObject({ type: 'r', color: 'white' });
      expect(game.moveHistory).toHaveLength(1);
      expect(game.moveHistory[0].specialMove?.type).toBe('castling');
    });

    test('should handle pawn promotion through UI flow', async () => {
      // Place pawn one step from promotion
      game.board[1][4] = { type: 'p', color: 'white' };
      game.board[0][4] = null;

      // Mock UI to select 'e' (Angel)
      (UI.showPromotionUI as any).mockImplementation(function (_g: any, _r: any, _c: any, _color: any, _moveRecord: any, callback: any) {
        game.board[0][4] = { type: 'e', color: 'white' };
        callback();
      });

      await mc.executeMove({ r: 1, c: 4 }, { r: 0, c: 4 });

      expect(game.board[0][4]).toMatchObject({ type: 'e', color: 'white' });
      expect(game.moveHistory[0].specialMove?.type).toBe('promotion');
      expect(game.moveHistory[0].specialMove?.promotedTo).toBe('e');
    });
  });

  describe('Puzzle Mode Lifecycle', () => {
    test('should transition to puzzle mode and solve a simple puzzle', async () => {
      await import('../js/puzzleManager.js');

      // Start puzzle mode
      gc.startPuzzleMode(0);

      expect(game.phase).toBe(PHASES.PLAY);
      expect(game.mode).toBe('puzzle');
      expect(game.currentPuzzle).toBeDefined();

      const puzzle = game.currentPuzzle;
      const firstMove = puzzle.solution[0];

      // Make the correct move
      await mc.executeMove(firstMove.from, firstMove.to);

      // Verify puzzle progression
      expect(game.moveHistory).toHaveLength(1);
    });
  });

  describe('Special Pieces Integration', () => {
    test('should allow Chancellor (C) to move like Rook + Knight', async () => {
      game.board[4][4] = { type: 'c', color: 'white' };

      // Rook move
      await mc.executeMove({ r: 4, c: 4 }, { r: 2, c: 4 });
      expect(game.board[2][4]).toMatchObject({ type: 'c', color: 'white' });

      game.turn = 'white'; // Cheat turn for test
      // Knight move
      await mc.executeMove({ r: 2, c: 4 }, { r: 0, c: 5 });
      expect(game.board[0][5]).toMatchObject({ type: 'c', color: 'white' });
    });

    test('should allow Archbishop (A) to move like Bishop + Knight', async () => {
      game.board[4][4] = { type: 'a', color: 'white' };

      // Bishop move
      await mc.executeMove({ r: 4, c: 4 }, { r: 6, c: 6 });
      expect(game.board[6][6]).toMatchObject({ type: 'a', color: 'white' });

      game.turn = 'white'; // Cheat turn for test
      // Knight move
      await mc.executeMove({ r: 6, c: 6 }, { r: 4, c: 5 });
      expect(game.board[4][5]).toMatchObject({ type: 'a', color: 'white' });
    });
  });
});
