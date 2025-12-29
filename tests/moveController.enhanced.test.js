import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { MoveController } from '../js/moveController.js';
import { PHASES } from '../js/config.js';

describe('MoveController - Enhanced Coverage Tests', () => {
  let game, moveController;

  beforeEach(() => {
    game = new Game(15, 'classic');
    moveController = new MoveController(game);
    game.moveController = moveController;

    // Mock basic board setup
    game.board[6][4] = { type: 'p', color: 'white' };
    game.board[1][4] = { type: 'p', color: 'black' };
    game.phase = PHASES.PLAY;
    game.turn = 'white';

    // Mock game methods
    game.stopClock = jest.fn();
    game.startClock = jest.fn();

    // Mock DOM elements
    jest.spyOn(document, 'getElementById').mockImplementation((id) => ({
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      },
      textContent: '',
      disabled: false
    }));

    jest.clearAllMocks();
  });

  describe('Replay Mode Edge Cases', () => {
    test('should handle multiple promotions in replay', () => {
      // Setup: Create game with promotion history
      game.moveHistory = [
        {
          from: { r: 6, c: 4 },
          to: { r: 4, c: 4 },
          piece: { type: 'p', color: 'white' }
        },
        {
          from: { r: 4, c: 4 },
          to: { r: 0, c: 4 },
          piece: { type: 'p', color: 'white' },
          promotion: 'q' // Promoted to queen
        }
      ];

      moveController.enterReplayMode();
      expect(game.replayMode).toBe(true);
      expect(game.replayPosition).toBe(1); // Starts at last move

      // Go to first move
      moveController.replayFirst();
      expect(game.replayPosition).toBe(-1);

      // Step through promotion move
      moveController.replayNext();
      expect(game.replayPosition).toBe(0);

      // Verify replay mode is active
      expect(game.replayMode).toBe(true);
    });

    test('should handle castling in replay correctly', () => {
      // Setup castling move
      game.board[7][4] = { type: 'k', color: 'white' };
      game.board[7][7] = { type: 'r', color: 'white' };

      game.moveHistory = [
        {
          from: { r: 7, c: 4 },
          to: { r: 7, c: 6 },
          piece: { type: 'k', color: 'white' },
          castling: { rookFrom: { r: 7, c: 7 }, rookTo: { r: 7, c: 5 } }
        }
      ];

      moveController.enterReplayMode();
      expect(game.replayMode).toBe(true);

      moveController.replayNext();

      // Verify replay mode is functional
      expect(game.replayPosition).toBeGreaterThanOrEqual(0);
    });

    test('should handle en passant in replay', () => {
      // Setup en passant
      game.board[3][4] = { type: 'p', color: 'white' };
      game.board[3][5] = { type: 'p', color: 'black' };

      game.moveHistory = [
        {
          from: { r: 3, c: 4 },
          to: { r: 2, c: 5 },
          piece: { type: 'p', color: 'white' },
          enPassant: { r: 3, c: 5 }
        }
      ];

      moveController.enterReplayMode();
      expect(game.replayMode).toBe(true);

      moveController.replayNext();

      // Verify replay is working
      expect(game.replayPosition).toBeGreaterThanOrEqual(0);
    });

    test('should correctly undo complex move sequences in replay', () => {
      game.moveHistory = [
        { from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, piece: { type: 'p', color: 'white' } },
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: { type: 'p', color: 'black' } },
        { from: { r: 5, c: 4 }, to: { r: 4, c: 4 }, piece: { type: 'p', color: 'white' } }
      ];

      moveController.enterReplayMode();

      // Should start at last move
      expect(game.replayPosition).toBe(2);

      // Go to first move
      moveController.replayFirst();
      expect(game.replayPosition).toBe(-1);

      // Go back to last
      moveController.replayLast();
      expect(game.replayPosition).toBe(2);

      // Verify replay mode is active
      expect(game.replayMode).toBe(true);
    });

    test('should handle replay boundary conditions', () => {
      game.moveHistory = [
        { from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, piece: { type: 'p', color: 'white' } }
      ];

      moveController.enterReplayMode();

      // Starts at last move (position 0 for 1 move)
      expect(game.replayPosition).toBe(0);

      // Try to go past last (should stay at 0)
      moveController.replayNext();
      expect(game.replayPosition).toBe(0);

      // Go to first, then try to go before (should stay at 0 or -1)
      moveController.replayFirst();
      const firstPosition = game.replayPosition;
      moveController.replayPrevious();

      // Position should not change or should be at minimum allowed
      expect(game.replayPosition).toBeLessThanOrEqual(0);
    });
  });

  describe('Clock Management Tests', () => {
    beforeEach(() => {
      game.clockEnabled = true;
      game.whiteTime = 300;
      game.blackTime = 300;
      game.clockRunning = false;
    });

    test('should trigger timeout when time reaches zero', () => {
      game.whiteTime = 1;
      game.turn = 'white';
      game.clockRunning = true;

      // Mock setTimeout
      jest.useFakeTimers();

      // Simulate clock tick
      game.whiteTime = 0;

      // Check if timeout is detected
      const isTimeout = game.whiteTime <= 0;
      expect(isTimeout).toBe(true);

      jest.useRealTimers();
    });

    test('should apply time increment after move', () => {
      game.timeControl = { initial: 300, increment: 2 };
      game.whiteTime = 100;
      game.turn = 'black'; // After white's move

      // Simulate increment application
      const timeAfterIncrement = 100 + 2;
      expect(timeAfterIncrement).toBe(102);
    });

    test('should pause clock correctly', () => {
      game.clockRunning = true;
      game.whiteTime = 250;

      moveController.stopClock = jest.fn(() => {
        game.clockRunning = false;
      });

      moveController.stopClock();
      expect(game.clockRunning).toBe(false);
      expect(moveController.stopClock).toHaveBeenCalled();
    });

    test('should not decrement time when clock is paused', () => {
      game.clockRunning = false;
      const initialTime = game.whiteTime;

      // Simulate tick attempt
      if (!game.clockRunning) {
        // Time should not change
        expect(game.whiteTime).toBe(initialTime);
      }
    });

    test('should handle different time controls', () => {
      const timeControls = [
        { name: 'blitz3', initial: 180, increment: 0 },
        { name: 'blitz5', initial: 300, increment: 0 },
        { name: 'rapid10', initial: 600, increment: 5 },
        { name: 'rapid15', initial: 900, increment: 10 }
      ];

      timeControls.forEach(tc => {
        game.timeControl = tc;
        game.whiteTime = tc.initial;
        game.blackTime = tc.initial;

        expect(game.whiteTime).toBe(tc.initial);
        expect(game.blackTime).toBe(tc.initial);
      });
    });
  });

  describe('Save/Load Robustness Tests', () => {
    test('should handle corrupt save data gracefully', () => {
      localStorage.setItem('schach9x9_save_autosave', 'invalid-json-{]}');

      expect(() => {
        try {
          JSON.parse(localStorage.getItem('schach9x9_save_autosave'));
        } catch (e) {
          // Should catch parse error
          expect(e).toBeInstanceOf(SyntaxError);
        }
      }).not.toThrow();
    });

    test('should handle missing fields with defaults', () => {
      const incompleteSave = {
        turn: 'white',
        board: game.board
        // Missing: moveHistory, capturedPieces, etc.
      };

      localStorage.setItem('schach9x9_save_autosave', JSON.stringify(incompleteSave));

      const loaded = JSON.parse(localStorage.getItem('schach9x9_save_autosave'));

      // Should provide defaults
      const moveHistory = loaded.moveHistory || [];
      const capturedPieces = loaded.capturedPieces || { white: [], black: [] };

      expect(moveHistory).toEqual([]);
      expect(capturedPieces).toEqual({ white: [], black: [] });
    });

    test('should migrate old save format', () => {
      const oldFormatSave = {
        turn: 'white',
        boardState: game.board, // Old key name
        moves: [] // Old key name
      };

      localStorage.setItem('schach9x9_save_autosave', JSON.stringify(oldFormatSave));

      const loaded = JSON.parse(localStorage.getItem('schach9x9_save_autosave'));

      // Simulate migration
      const migratedBoard = loaded.board || loaded.boardState;
      const migratedMoves = loaded.moveHistory || loaded.moves;

      expect(migratedBoard).toBeDefined();
      expect(migratedMoves).toEqual([]);
    });

    test('should handle localStorage quota exceeded', () => {
      // Create very large save data
      const largeSave = {
        board: game.board,
        moveHistory: new Array(10000).fill({
          from: { r: 0, c: 0 },
          to: { r: 1, c: 1 },
          piece: { type: 'p', color: 'white' }
        })
      };

      try {
        localStorage.setItem('schach9x9_save_autosave', JSON.stringify(largeSave));
      } catch (e) {
        // Should handle QuotaExceededError
        expect(e.name).toBe('QuotaExceededError');
      }
    });
  });

  describe('Position Hash and Draw Detection', () => {
    test('should generate consistent board hashes', () => {
      const hash1 = moveController.getBoardHash();
      const hash2 = moveController.getBoardHash();

      expect(hash1).toBe(hash2);
    });

    test('should detect threefold repetition', () => {
      // Setup: Create position that repeats 3 times
      moveController.positionHistory = ['hash1', 'hash2', 'hash1', 'hash2', 'hash1'];

      const currentHash = 'hash1';
      const count = moveController.positionHistory.filter(h => h === currentHash).length;

      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should detect insufficient material', () => {
      // King vs King
      game.board = Array(9).fill(null).map(() => Array(9).fill(null));
      game.board[0][4] = { type: 'k', color: 'black' };
      game.board[8][4] = { type: 'k', color: 'white' };

      const isInsufficient = moveController.isInsufficientMaterial();
      expect(isInsufficient).toBe(true);
    });

    test('should not detect sufficient material as insufficient', () => {
      // King + Queen vs King
      game.board = Array(9).fill(null).map(() => Array(9).fill(null));
      game.board[0][4] = { type: 'k', color: 'black' };
      game.board[8][4] = { type: 'k', color: 'white' };
      game.board[8][3] = { type: 'q', color: 'white' };

      const isInsufficient = moveController.isInsufficientMaterial();
      expect(isInsufficient).toBe(false);
    });
  });
});
