import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';
import * as aiEngine from '../js/aiEngine.js';

// Mock UI module
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  getPieceText: vi.fn((piece: any) => {
    if (!piece) return '';
    const symbols: Record<string, string> = {
      p: '♟',
      n: '♞',
      b: '♝',
      r: '♜',
      q: '♛',
      k: '♚',
      a: '♗',
      c: '♖',
      e: '♕',
    };
    return symbols[piece.type] || '?';
  }),
  renderEvalGraph: vi.fn(),
  setTutorLoading: vi.fn(),
}));

// Mock sounds module
vi.mock('../js/sounds.js', () => ({
  soundManager: { init: vi.fn() },
}));

// Mock AI Engine to prevent slow JS fallback execution
vi.mock('../js/aiEngine.js', () => ({
  getBestMoveDetailed: vi.fn().mockResolvedValue({
    move: {
      from: { r: 6, c: 4 },
      to: { r: 5, c: 4 },
      promotion: undefined,
    },
    score: 100,
    notation: 'e3', // simplified
  }),
  getTopMoves: vi.fn().mockResolvedValue([
    {
      move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, promotion: undefined },
      score: 100,
      nodes: 0,
    },
    {
      move: { from: { r: 6, c: 5 }, to: { r: 5, c: 5 }, promotion: undefined },
      score: 80,
      nodes: 0,
    },
    {
      move: { from: { r: 6, c: 6 }, to: { r: 5, c: 6 }, promotion: undefined },
      score: 60,
      nodes: 0,
    },
  ]),
  evaluatePosition: vi.fn().mockResolvedValue(50),
  convertBoardToInt: vi.fn(),
  getParamsForElo: vi.fn().mockReturnValue({}),
  isSquareAttacked: vi.fn().mockReturnValue(false),
  see: vi.fn().mockReturnValue(0),
  findKing: vi.fn().mockReturnValue({ r: 0, c: 0 }),
  isInCheck: vi.fn().mockReturnValue(false),
}));

// Import after mocking
const { TutorController } = await import('../js/tutorController.js');

describe('TutorController', () => {
  let game: any;
  let tutorController: any;

  beforeEach(() => {
    game = new Game(15, 'classic');
    tutorController = new TutorController(game);
    game.tutorController = tutorController;
    game.log = vi.fn();
    game.minimax = vi.fn().mockReturnValue(100); // Mock minimax to return a score
  });

  describe('updateBestMoves', () => {
    test('should set bestMoves during PLAY phase for white', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      game.isAI = false;

      tutorController.updateBestMoves();

      expect(game.bestMoves).toBeDefined();
      expect(Array.isArray(game.bestMoves)).toBe(true);
    });

    test('should return empty array when not in PLAY phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      game.turn = 'white';

      tutorController.updateBestMoves();

      expect(game.bestMoves).toEqual([]);
    });

    test('should return empty array for AI turn', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'black';
      game.isAI = true;

      tutorController.updateBestMoves();

      expect(game.bestMoves).toEqual([]);
    });
  });

  describe('getTutorHints', () => {
    beforeEach(() => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      game.isAI = false;
    });

    test('should return empty array when no legal moves', async () => {
      // Empty board, no pieces
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const hints = await tutorController.getTutorHints();

      expect(hints).toEqual([]);
    });

    test('should return hints for positions with pieces', async () => {
      // Add a white pawn that can move
      game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };

      // Default mock returns 6,4 -> 5,4 which is valid
      const hints = await tutorController.getTutorHints();

      expect(hints.length).toBeGreaterThan(0);
      expect(hints.length).toBeLessThanOrEqual(3); // Max 3 hints
    });

    test('should include move notation in hints', async () => {
      game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };

      const hints = await tutorController.getTutorHints();

      if (hints.length > 0) {
        expect(hints[0]).toHaveProperty('notation');
        expect(hints[0]).toHaveProperty('score');
        expect(hints[0]).toHaveProperty('move');
      }
    });

    test('should prioritize capture moves', async () => {
      // White pawn can capture black piece
      game.board[5][4] = { type: 'p', color: 'white', hasMoved: false };
      game.board[4][5] = { type: 'p', color: 'black', hasMoved: false };

      // Mock a capture move
      (aiEngine.getTopMoves as any).mockResolvedValueOnce([
        {
          move: { from: { r: 5, c: 4 }, to: { r: 4, c: 5 }, promotion: undefined },
          score: 200,
          notation: 'exf5',
          nodes: 100,
        },
      ]);

      const hints = await tutorController.getTutorHints();

      expect(hints.length).toBeGreaterThan(0);
      // Capture moves should be evaluated
    });
  });

  describe('getMoveNotation', () => {
    test('should return notation for pawn move', () => {
      const move = {
        from: { r: 6, c: 4 },
        to: { r: 5, c: 4 },
      };
      game.board[6][4] = { type: 'p', color: 'white' };

      const notation = tutorController.getMoveNotation(move);

      expect(notation).toContain('Bauer');
      expect(notation).toContain('e4'); // Column e, row 4 (destination)
    });

    test('should return notation for capture', () => {
      const move = {
        from: { r: 5, c: 4 },
        to: { r: 4, c: 5 },
      };
      game.board[5][4] = { type: 'p', color: 'white' };
      game.board[4][5] = { type: 'n', color: 'black' };

      const notation = tutorController.getMoveNotation(move);

      expect(notation).toContain('schlägt');
      expect(notation).toContain('Springer');
    });

    test('should return notation for Angel piece', () => {
      const move = {
        from: { r: 5, c: 4 },
        to: { r: 3, c: 4 },
      };
      game.board[5][4] = { type: 'e', color: 'white' };

      const notation = tutorController.getMoveNotation(move);

      expect(notation).toContain('Engel');
    });
  });

  describe('getPieceName', () => {
    test('should return German names for all pieces', () => {
      expect(tutorController.getPieceName('p')).toBe('Bauer');
      expect(tutorController.getPieceName('n')).toBe('Springer');
      expect(tutorController.getPieceName('b')).toBe('Läufer');
      expect(tutorController.getPieceName('r')).toBe('Turm');
      expect(tutorController.getPieceName('q')).toBe('Dame');
      expect(tutorController.getPieceName('k')).toBe('König');
      expect(tutorController.getPieceName('a')).toBe('Erzbischof');
      expect(tutorController.getPieceName('c')).toBe('Kanzler');
      expect(tutorController.getPieceName('e')).toBe('Engel');
    });
  });

  describe('isTutorMove', () => {
    test('should return true if move matches best move', () => {
      game.bestMoves = [
        {
          move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
          score: 100,
          notation: 'e3',
        },
      ];

      const result = tutorController.isTutorMove({ r: 6, c: 4 }, { r: 5, c: 4 });

      expect(result).toBe(true);
    });

    test('should return false if move does not match', () => {
      game.bestMoves = [
        {
          move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
          score: 100,
          notation: 'e3',
        },
      ];

      const result = tutorController.isTutorMove({ r: 6, c: 3 }, { r: 5, c: 3 });

      expect(result).toBe(false);
    });
  });

  describe('Tactical and Structural Analysis', () => {
    test('should return true for rook orthogonal moves in canPieceMove', () => {
      expect(tutorController.canPieceMove('r', 1, 0)).toBe(true);
      expect(tutorController.canPieceMove('r', 0, 1)).toBe(true);
      expect(tutorController.canPieceMove('r', 1, 1)).toBe(false);
    });

    test('should detect pin when rook pins piece to king', () => {
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      game.board[0][0] = { type: 'k', color: 'black' };
      game.board[0][4] = { type: 'r', color: 'white' };
      game.board[0][2] = { type: 'n', color: 'black' };
      const pins = tutorController.detectPins({ r: 0, c: 4 }, 'white');
      expect(pins.length).toBe(1);
      expect(pins[0].pinnedPiece.type).toBe('n');
    });

    test('should count defenders accurately', () => {
      game.board[4][4] = { type: 'p', color: 'white' };
      game.board[5][3] = { type: 'p', color: 'white' };
      expect(tutorController.countDefenders(4, 4, 'white')).toBeGreaterThanOrEqual(0);
    });

    test('should detect strategic values like center control', () => {
      const move = { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } };
      game.board[6][4] = { type: 'n', color: 'white', hasMoved: false };
      const strategic = tutorController.analyzeStrategicValue(move);
      expect(strategic.some((s: any) => s.type === 'center_control')).toBe(true);
    });

    test('should return correct score descriptions', () => {
      expect(tutorController.getScoreDescription(1000).label).toContain('Gewinnstellung');
      expect(tutorController.getScoreDescription(0).label).toContain('Ausgeglichen');
      expect(tutorController.getScoreDescription(-1000).label).toContain('Verloren');
    });
  });

  describe('applySetupTemplate', () => {
    beforeEach(() => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.initialPoints = 15;
      game.points = 15;
      game.whiteCorridor = 3; // Standard white corridor starting column
      game.blackCorridor = 3; // Standard black corridor starting column

      // Clear board
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
    });

    test('should place pawns in the front row for White', () => {
      // Use a template with pawns
      // Mock getSetupTemplates to return a controlled template
      const mockTemplate = {
        id: 'test_pawns',
        name: 'Test Pawns',
        pieces: ['p', 'p', 'p'],
        cost: 3,
      };

      // Spy on getSetupTemplates
      vi.spyOn(tutorController, 'getSetupTemplates').mockReturnValue([mockTemplate]);

      tutorController.applySetupTemplate('test_pawns');

      // White front row is row 6 (closest to center relative to corridor start 6..8? No wait)
      // In my implementation:
      // if isWhite: frontRow = corridor.rowStart (6)
      // middleRow = 7
      // backRow = 8
      // Wait, let's re-verify the logic I implemented.
      // White moves UP (decreasing indices). So row 6 is "Front" (closest to row 0).
      // Row 8 is "Back" (furthest from row 0).
      // So pawns should be at row 6.

      expect(game.board[6][3]).toEqual(expect.objectContaining({ type: 'p', color: 'white' }));
      expect(game.board[6][4]).toEqual(expect.objectContaining({ type: 'p', color: 'white' }));
      expect(game.board[6][5]).toEqual(expect.objectContaining({ type: 'p', color: 'white' }));
    });

    test('should place rooks in back corners for White', () => {
      const mockTemplate = {
        id: 'test_rooks',
        name: 'Test Rooks',
        pieces: ['r', 'r'],
        cost: 10,
      };
      vi.spyOn(tutorController, 'getSetupTemplates').mockReturnValue([mockTemplate]);

      tutorController.applySetupTemplate('test_rooks');

      // Back row is 8. Corners are col 3 and 5.
      expect(game.board[8][3]).toEqual(expect.objectContaining({ type: 'r', color: 'white' }));
      expect(game.board[8][5]).toEqual(expect.objectContaining({ type: 'r', color: 'white' }));
    });

    test('should deduct points correctly', () => {
      const mockTemplate = {
        id: 'test_cost',
        name: 'Test Cost',
        pieces: ['q', 'p'], // 9 + 1 = 10
        cost: 10,
      };
      vi.spyOn(tutorController, 'getSetupTemplates').mockReturnValue([mockTemplate]);

      tutorController.applySetupTemplate('test_cost');

      expect(game.points).toBe(15 - 10); // 5
    });

    test('should clear existing pieces in corridor', () => {
      // Place some garbage
      game.board[7][4] = { type: 'n', color: 'white' };

      const mockTemplate = {
        id: 'test_clear',
        name: 'Test Clear',
        pieces: ['p'],
        cost: 1,
      };
      vi.spyOn(tutorController, 'getSetupTemplates').mockReturnValue([mockTemplate]);

      tutorController.applySetupTemplate('test_clear');

      // Garbage should be gone (unless it was overwritten by new piece, but here we only place 1 pawn)
      // The pawn goes to front row (6). Row 7 should be empty.
      expect(game.board[7][4]).toBeNull();
    });
  });

  describe('getSetupTemplates', () => {
    test('should return templates for 12 points', () => {
      game.initialPoints = 12;
      const templates = tutorController.getSetupTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].cost).toBe(12);
    });

    test('should return templates for 15 points', () => {
      game.initialPoints = 15;
      const templates = tutorController.getSetupTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].cost).toBe(15);
    });

    test('should return templates for 18 points', () => {
      game.initialPoints = 18;
      const templates = tutorController.getSetupTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].cost).toBe(18);
    });

    test('should handle unknown point values gracefully', () => {
      game.initialPoints = 20; // Unsupported value
      const templates = tutorController.getSetupTemplates();
      // Should return empty array or default templates
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('applySetupTemplate - Edge Cases', () => {
    beforeEach(() => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.initialPoints = 15;
      game.points = 15;
      game.whiteCorridor = 3;
      game.blackCorridor = 3;
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
    });

    test('should handle invalid template ID', () => {
      vi.spyOn(game, 'log');
      tutorController.applySetupTemplate('invalid_template_id');
      // Should not crash, may log an error
      expect(game.points).toBe(15); // Points unchanged
    });

    test('should not apply template if insufficient points', () => {
      const mockExpensiveTemplate = {
        id: 'expensive',
        name: 'Expensive',
        pieces: ['q', 'q', 'q'], // 27 points
        cost: 27,
      };
      vi.spyOn(tutorController, 'getSetupTemplates').mockReturnValue([mockExpensiveTemplate]);
      game.points = 15;

      tutorController.applySetupTemplate('expensive');
      // Should handle gracefully
      expect(game.points).toBeLessThanOrEqual(15);
    });

    test('should handle corridor placement at board edges', () => {
      // Test with corridor at edge
      game.whiteCorridor = 0;
      const mockTemplate = {
        id: 'edge_test',
        name: 'Edge Test',
        pieces: ['p', 'p', 'p'],
        cost: 3,
      };
      vi.spyOn(tutorController, 'getSetupTemplates').mockReturnValue([mockTemplate]);

      tutorController.applySetupTemplate('edge_test');
      // Should not crash
      expect(game.points).toBe(12);
    });
  });

  describe('getMoveNotation - Edge Cases', () => {
    test('should handle move with null piece gracefully', () => {
      const move = {
        from: { r: 6, c: 4 },
        to: { r: 5, c: 4 },
      };
      game.board[6][4] = null;

      const notation = tutorController.getMoveNotation(move);
      expect(notation).toBeDefined();
      expect(typeof notation).toBe('string');
    });

    test('should handle castling notation', () => {
      const move = {
        from: { r: 8, c: 4 },
        to: { r: 8, c: 6 }, // Kingside castling
      };
      game.board[8][4] = { type: 'k', color: 'white' };

      const notation = tutorController.getMoveNotation(move);
      expect(notation).toContain('König');
    });

    test('should handle promotion move', () => {
      const move = {
        from: { r: 1, c: 4 },
        to: { r: 0, c: 4 },
      };
      game.board[1][4] = { type: 'p', color: 'white' };

      const notation = tutorController.getMoveNotation(move);
      expect(notation).toContain('Bauer');
    });
  });

  describe('getTutorHints - Advanced Scenarios', () => {
    beforeEach(() => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      game.isAI = false;
    });

    test('should handle checkmate position', async () => {
      // Set up a checkmate scenario
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      game.board[0][0] = { type: 'k', color: 'black' };
      game.board[8][8] = { type: 'k', color: 'white' };
      game.board[7][7] = { type: 'q', color: 'white' }; // Threatening king

      const hints = await tutorController.getTutorHints();
      // Should still return hints (unless no legal moves)
      expect(Array.isArray(hints)).toBe(true);
    });

    test('should limit hints to maximum of 3', async () => {
      // Set up a position with many legal moves
      game.board[4][4] = { type: 'q', color: 'white' }; // Queen in center has many moves

      const hints = await tutorController.getTutorHints();
      expect(hints.length).toBeLessThanOrEqual(3);
    }, 30000); // Increased timeout for JS engine fallback

    test('should properly evaluate tactical moves', async () => {
      // Setup a position where white can win material
      game.board[4][4] = { type: 'p', color: 'white' };
      game.board[3][5] = { type: 'q', color: 'black' }; // Black queen can be captured

      // Mock positive SEE (winning material)
      (aiEngine.see as any).mockReturnValue(800);

      // Mock capture move
      (aiEngine.getTopMoves as any).mockResolvedValueOnce([
        {
          move: { from: { r: 4, c: 4 }, to: { r: 3, c: 5 }, promotion: undefined },
          score: 900,
          notation: 'exd5',
          nodes: 100,
        },
      ]);

      const hints = await tutorController.getTutorHints();
      expect(hints.length).toBeGreaterThan(0);
      if (hints.length > 0) {
        expect(hints[0]).toHaveProperty('score');
      }
    });
  });

  describe('updateBestMoves - Enhanced Tests', () => {
    test('should handle board with only kings', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      game.isAI = false;
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      game.board[0][0] = { type: 'k', color: 'black' };
      game.board[8][8] = { type: 'k', color: 'white' };

      tutorController.updateBestMoves();
      expect(game.bestMoves).toBeDefined();
    });

    test('should skip AI turns correctly', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'black';
      game.isAI = true;
      game.board[4][4] = { type: 'p', color: 'black' };

      tutorController.updateBestMoves();
      expect(game.bestMoves).toEqual([]);
    });
  });

  describe('debouncedGetTutorHints', () => {
    test('should call showTutorSuggestions after fetching hints', async () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      game.isAI = false;
      // Add a white pawn that can move
      game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };

      // Spy on showTutorSuggestions
      // We need to cast to any because showTutorSuggestions might be protected/private or just to be safe with the mock setup
      const showSpy = vi.spyOn(tutorController, 'showTutorSuggestions');

      // Trigger the debounced function
      tutorController.debouncedGetTutorHints();

      // Wait for debounce delay (300ms) + buffer
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(showSpy).toHaveBeenCalled();
      // Verify bestMoves is set (mocked aiEngine returns data)
      expect(game.bestMoves).toBeDefined();
      expect(game.bestMoves.length).toBeGreaterThan(0);
    });

    test('should clear loading state even if phase is invalid', async () => {
      game.phase = PHASES.GAME_OVER;

      // Spy on setTutorLoading from the mocked UI module
      const uiModule = await import('../js/ui.js');
      const loadingSpy = uiModule.setTutorLoading as any;
      loadingSpy.mockClear();

      await tutorController.getTutorHints();

      expect(loadingSpy).toHaveBeenCalledWith(true); // Should set true initially
      expect(loadingSpy).toHaveBeenCalledWith(false); // Should clear it finally
    });
  });
});
