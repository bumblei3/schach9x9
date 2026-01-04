import { Game, PHASES } from '../js/gameEngine.js';
import { TutorController } from '../js/tutorController.js';

describe('KI-Mentor Logic', () => {
  let game;
  let tutor;

  beforeEach(() => {
    game = new Game(0, 'classic');
    tutor = new TutorController(game);
    game.tutorController = tutor;
    game.kiMentorEnabled = true;
  });

  describe('analyzePlayerMovePreExecution', () => {
    test('should NOT detect blunder for a normal developing move', () => {
      // e2-e4 (pawn push)
      const move = {
        from: { r: 7, c: 4 },
        to: { r: 5, c: 4 },
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });

    test('should detect blunder for hanging a queen', () => {
      // Clear board for simple test
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      // White Queen at d1, King at e1
      game.board[8][3] = { type: 'q', color: 'white' };
      game.board[8][4] = { type: 'k', color: 'white' };
      // Black Rook at d9, King at e9
      game.board[0][3] = { type: 'r', color: 'black' };
      game.board[0][4] = { type: 'k', color: 'black' };

      const move = {
        from: { r: 8, c: 3 },
        to: { r: 5, c: 3 },
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).not.toBeNull();
      expect(analysis.category).toBe('blunder');
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    test('should detect blunder for hanging a rook', () => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      // White Rook at a1, King at e1
      game.board[8][0] = { type: 'r', color: 'white' };
      game.board[8][4] = { type: 'k', color: 'white' };
      // Black Queen at a9, King at e9
      game.board[0][0] = { type: 'q', color: 'black' };
      game.board[0][4] = { type: 'k', color: 'black' };

      const move = {
        from: { r: 8, c: 0 },
        to: { r: 4, c: 0 }, // Rook moves up, but still on same file as black queen
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).not.toBeNull();
      expect(analysis.category).toBe('blunder');
    });

    test('should NOT detect blunder for a safe capture', () => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      // White Queen at d4, King at e1
      game.board[5][3] = { type: 'q', color: 'white' };
      game.board[8][4] = { type: 'k', color: 'white' };
      // Black Pawn at d5, King at e9
      game.board[4][3] = { type: 'p', color: 'black' };
      game.board[0][4] = { type: 'k', color: 'black' };

      const move = {
        from: { r: 5, c: 3 },
        to: { r: 4, c: 3 }, // Queen captures pawn safely
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });

    test('should NOT detect blunder for a winning exchange', () => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      // White Rook at d1, King at e1
      game.board[8][3] = { type: 'r', color: 'white' };
      game.board[8][4] = { type: 'k', color: 'white' };
      // Black Queen at d5 (undefended), King at e9
      game.board[4][3] = { type: 'q', color: 'black' };
      game.board[0][4] = { type: 'k', color: 'black' };

      const move = {
        from: { r: 8, c: 3 },
        to: { r: 4, c: 3 }, // Rook captures queen
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });
  });

  describe('kiMentorEnabled setting', () => {
    test('should return null when disabled', () => {
      game.kiMentorEnabled = false;

      const move = {
        from: { r: 8, c: 3 },
        to: { r: 1, c: 3 },
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });

    test('should return null when not in PLAY phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;

      const move = {
        from: { r: 7, c: 4 },
        to: { r: 5, c: 4 },
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });
  });

  describe('analysis result structure', () => {
    test('should return correct structure for blunder', () => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      game.board[8][3] = { type: 'q', color: 'white' };
      game.board[8][4] = { type: 'k', color: 'white' };
      game.board[0][3] = { type: 'r', color: 'black' };
      game.board[0][4] = { type: 'k', color: 'black' };

      const move = {
        from: { r: 8, c: 3 },
        to: { r: 5, c: 3 },
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);

      expect(analysis).toHaveProperty('move');
      expect(analysis).toHaveProperty('score');
      expect(analysis).toHaveProperty('category');
      expect(analysis).toHaveProperty('qualityLabel');
      expect(analysis).toHaveProperty('warnings');
      expect(analysis).toHaveProperty('tacticalExplanations');
      expect(analysis).toHaveProperty('strategicExplanations');
      expect(analysis).toHaveProperty('scoreDiff');
      expect(analysis).toHaveProperty('notation');
    });
  });

  describe('edge cases', () => {
    test('should handle move with no piece at source', () => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      const move = {
        from: { r: 4, c: 4 }, // Empty square
        to: { r: 3, c: 4 },
      };

      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });

    test('should handle move at board edge', () => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      game.board[8][0] = { type: 'r', color: 'white' };
      game.board[8][4] = { type: 'k', color: 'white' };
      game.board[0][4] = { type: 'k', color: 'black' };

      const move = {
        from: { r: 8, c: 0 },
        to: { r: 0, c: 0 }, // Rook moves to corner
      };

      // Should not crash
      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis === null || typeof analysis === 'object').toBe(true);
    });
  });
});
