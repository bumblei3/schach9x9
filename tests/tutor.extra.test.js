import { PHASES } from '../js/config.js';

// Mock UI and other dependencies
global.document = {
  getElementById: vi.fn(() => ({
    textContent: '',
    appendChild: vi.fn(),
    innerHTML: '',
    style: {},
    classList: { add: vi.fn(), remove: vi.fn() },
  })),
  body: {
    appendChild: vi.fn(),
  },
};

vi.mock('../js/ui.js', () => ({
  showToast: vi.fn(),
  showModal: vi.fn(),
  renderBoard: vi.fn(),
  getPieceText: vi.fn(() => 'P'),
  showMoveQuality: vi.fn(),
  updateStatus: vi.fn(),
}));

const UI = await import('../js/ui.js');
const { TutorController } = await import('../js/tutorController.js');

describe('TutorController Extra Coverage', () => {
  let game, tutor;

  beforeEach(() => {
    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: PHASES.PLAY,
      turn: 'white',
      tutorMode: 'standard',
      tutorPoints: 0,
      lastEval: 0,
      stats: { accuracies: [] },
      bestMoves: [],
      getAllLegalMoves: vi.fn(() => []),
      getValidMoves: vi.fn(() => []),
      isSquareUnderAttack: vi.fn(() => false),
      isSquareAttacked: vi.fn(() => false), // Legacy support if needed
      isInCheck: vi.fn(() => false),
      isCheckmate: vi.fn(() => false),
      isStalemate: vi.fn(() => false),
      findKing: vi.fn(() => ({ r: 8, c: 4 })),
      undoMove: vi.fn(),
      log: vi.fn(),
    };
    tutor = new TutorController(game);
    vi.clearAllMocks();
  });

  describe('handlePlayerMove', () => {
    test('should reward points for correct guess in guess_the_move mode', () => {
      game.tutorMode = 'guess_the_move';
      const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };
      game.bestMoves = [{ move: move }];
      game.getAllLegalMoves.mockReturnValue([move]);

      tutor.handlePlayerMove(move.from, move.to);

      expect(game.tutorPoints).toBe(10);
      expect(UI.showToast).toHaveBeenCalledWith(expect.stringContaining('Richtig'), 'success');
    });

    test('should not reward points for incorrect guess', () => {
      game.tutorMode = 'guess_the_move';
      const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };
      const bestMove = { from: { r: 6, c: 3 }, to: { r: 5, c: 3 } };
      game.bestMoves = [{ move: bestMove }];
      game.getAllLegalMoves.mockReturnValue([move, bestMove]);

      tutor.handlePlayerMove(move.from, move.to);

      expect(game.tutorPoints).toBe(0);
      expect(UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Nicht der beste'),
        'neutral'
      );
    });

    test('should do nothing if phase is not PLAY', () => {
      game.phase = PHASES.SETUP;
      tutor.handlePlayerMove({ r: 6, c: 4 }, { r: 5, c: 4 });
      expect(game.getAllLegalMoves).not.toHaveBeenCalled();
    });
  });

  describe('checkBlunder', () => {
    test('should detect blunder for white (heavy eval drop)', async () => {
      game.lastEval = 100; // White is +1.0
      const moveRecord = {
        from: { r: 6, c: 4 },
        to: { r: 4, c: 4 },
        piece: { color: 'white', type: 'p' },
        evalScore: -350, // White is now -3.5 (Drop of 4.5)
      };
      // Setup board for getMoveNotation/tactical check
      game.board[6][4] = { type: 'p', color: 'white' };

      // Mock analysis results and internal calls
      tutor.analyzeMoveWithExplanation = vi.fn(() => ({
        title: 'Blunder',
        tacticalExplanations: [],
        warnings: [],
      }));
      tutor.showBlunderWarning = vi.fn();
      await tutor.checkBlunder(moveRecord);
      expect(tutor.showBlunderWarning).toHaveBeenCalled();
      expect(game.lastEval).toBe(-350);
    });

    test('should not detect blunder for minor drop', () => {
      game.lastEval = 100;
      const moveRecord = {
        from: { r: 6, c: 4 },
        to: { r: 4, c: 4 },
        piece: { color: 'white' },
        evalScore: 50, // Drop of 0.5
      };

      tutor.showBlunderWarning = vi.fn();
      tutor.checkBlunder(moveRecord);

      expect(tutor.showBlunderWarning).not.toHaveBeenCalled();
    });
  });

  describe('showBlunderWarning', () => {
    test('should call UI.showModal with undo option', () => {
      const analysis = {
        qualityLabel: 'Grober Fehler',
        scoreDiff: -2.5,
        warnings: ['Warnung'],
        tacticalExplanations: ['Hängende Figur'],
        strategicExplanations: [],
        move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, piece: { type: 'p', color: 'white' } },
      };

      // Mock getMoveNotation to avoid board lookup
      tutor.getMoveNotation = vi.fn(() => 'e4');

      tutor.showBlunderWarning(analysis);

      expect(UI.showModal).toHaveBeenCalledWith(
        expect.stringContaining('Schwerer Fehler'),
        expect.stringContaining('Hängende Figur'),
        expect.any(Array)
      );
    });
  });

  describe('analyzeMoveWithExplanation', () => {
    test('should correctly categorize a great move', () => {
      const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };
      const moveRecord = { from: move.from, to: move.to, piece: { type: 'p', color: 'white' } };
      const currentEval = 100;
      const bestEval = 105;

      // Setup board
      game.board[6][4] = { type: 'p', color: 'white' };

      const analysis = tutor.analyzeMoveWithExplanation(moveRecord, currentEval, bestEval);

      expect(analysis.category).toBe('excellent');
      expect(analysis.qualityLabel).toContain('Exzellenter Zug!');
    });
  });
});
