import { Game } from '../js/gameEngine.js';
import { TutorController } from '../js/tutorController.js';

describe('KI-Mentor Warning Levels', () => {
  let game;
  let tutor;

  beforeEach(() => {
    game = new Game(0, 'classic');
    tutor = new TutorController(game);
    game.tutorController = tutor;
    game.kiMentorEnabled = true; // Enabled by default
    game.mentorLevel = 'STANDARD';
  });

  // Blunder: Hanging Queen (>200 eval drop)
  const blunderMove = () => {
    // Clear board
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;
    // White Queen at d1
    game.board[8][3] = { type: 'q', color: 'white' };
    // Black Rook at d9
    game.board[0][3] = { type: 'r', color: 'black' };

    return {
      from: { r: 8, c: 3 },
      to: { r: 5, c: 3 }, // Move into rook's file
    };
  };

  // Mistake: Losing a pawn (~100 drop)
  const mistakeMove = () => {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;
    // White Pawn at row 6, col 0 (edge)
    game.board[6][0] = { type: 'p', color: 'white' };
    // Black Rook at row 4, column 0 - attacks the file
    game.board[4][0] = { type: 'r', color: 'black' };

    return {
      from: { r: 6, c: 0 },
      to: { r: 5, c: 0 }, // Move pawn 1 step forward, into range of Rook
    };
  };

  describe('STANDARD Level', () => {
    beforeEach(() => {
      game.mentorLevel = 'STANDARD';
    });

    test('should warn on Blunder', () => {
      const move = blunderMove();
      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).not.toBeNull();
      expect(analysis.scoreDiff).toBeLessThan(-200);
    });

    test('should NOT warn on Mistake (Pawn loss)', () => {
      const move = mistakeMove();
      const analysis = tutor.analyzePlayerMovePreExecution(move);
      // In Standard mode, dragging pawn to death (score drop ~100) should be ignored
      // Threshold is 200
      expect(analysis).toBeNull();
    });
  });

  describe('STRICT Level', () => {
    beforeEach(() => {
      game.mentorLevel = 'STRICT';
    });

    test('should warn on Blunder', () => {
      const move = blunderMove();
      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).not.toBeNull();
    });

    test('should warn on Mistake', () => {
      const move = mistakeMove();
      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).not.toBeNull();
      // Should be caught by 50 threshold
    });
  });

  describe('OFF Level', () => {
    beforeEach(() => {
      game.mentorLevel = 'OFF';
      game.kiMentorEnabled = false;
    });

    test('should ignore Blunder', () => {
      const move = blunderMove();
      const analysis = tutor.analyzePlayerMovePreExecution(move);
      expect(analysis).toBeNull();
    });
  });
});
