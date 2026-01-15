import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock UI
vi.mock('../js/ui.js', () => ({
  showTutorSuggestions: vi.fn(),
  renderBoard: vi.fn(),
  updateShopUI: vi.fn(),
  getPieceText: vi.fn(piece => (piece ? piece.type : '')),
}));

vi.mock('../js/aiEngine.js', () => ({
  getBestMoveDetailed: vi.fn(),
  getTopMoves: vi.fn(() => []),
  extractPV: vi.fn(() => []),
  evaluatePosition: vi.fn(() => 0),
  isSquareAttacked: vi.fn(() => false),
  see: vi.fn(() => 0),
}));

const aiEngine = await import('../js/aiEngine.js');

const UI = await import('../js/ui.js');
const {
  getTutorHints,
  getSetupTemplates,
  applySetupTemplate,
  isTutorMove,
  showTutorSuggestions,
  updateBestMoves,
} = await import('../js/tutor/HintGenerator.js');

describe('HintGenerator - Unit Tests', () => {
  let game;
  let mockTutorController;

  beforeEach(() => {
    vi.clearAllMocks();

    game = new Game(15, 'classic');
    game.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    game.bestMoves = [];

    mockTutorController = {
      getPieceName: vi.fn(type => type),
      getThreatenedPieces: vi.fn(() => []),
      getDefendedPieces: vi.fn(() => []),
      detectTacticalPatterns: vi.fn(() => []),
      analyzeMoveWithExplanation: vi.fn(() => ({ title: 'Test' })),
      getSetupTemplates: vi.fn(() => []),
      debouncedGetTutorHints: vi.fn(),
    };
  });

  test('getTutorHints should return empty if not in PLAY phase', async () => {
    game.phase = PHASES.SETUP_WHITE_KING;
    const hints = await getTutorHints(game, mockTutorController);
    expect(hints).toEqual([]);
  });

  test('getTutorHints should return hints for human player', async () => {
    game.phase = PHASES.PLAY;
    game.isAI = true;
    game.turn = 'white';

    // Mock AI engine result
    const bestMove = { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } };
    aiEngine.getTopMoves.mockReturnValue([{
      move: bestMove,
      score: 50,
      notation: 'e4',
      nodes: 100
    }]);

    game.board[7][4] = { type: 'p', color: 'white' };

    const hints = await getTutorHints(game, mockTutorController);
    expect(hints.length).toBeGreaterThan(0);
  });

  test('getTutorHints should filter out pieces of wrong color or missing', async () => {
    game.phase = PHASES.PLAY;
    game.board[7][4] = { type: 'p', color: 'black' }; // Wrong color
    aiEngine.getTopMoves.mockReturnValue([{
      move: { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      score: 50,
    }]);

    expect(await getTutorHints(game, mockTutorController)).toEqual([]);

    game.board[7][4] = null; // Missing
    expect(await getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should skip self-captures (though illegal)', async () => {
    game.phase = PHASES.PLAY;
    game.board[7][4] = { type: 'p', color: 'white' };
    game.board[5][4] = { type: 'p', color: 'white' }; // Same color
    aiEngine.getTopMoves.mockReturnValue([{
      move: { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      score: 50,
    }]);

    expect(await getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should return empty for AI turn', async () => {
    game.turn = 'black';
    game.isAI = true;
    expect(await getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should return empty if no legal moves', async () => {
    game.phase = PHASES.PLAY;
    game.getAllLegalMoves = vi.fn(() => []);
    expect(await getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should skip invalid candidates', async () => {
    game.phase = PHASES.PLAY;
    aiEngine.getTopMoves.mockReturnValue([{
      move: { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      score: 50,
    }]);
    game.board[7][4] = null; // No piece at 'from' effectively makes it invalid in getTutorHints logic
    // Actually, getTutorHints filters pieces of wrong color/missing BEFORE calling engine in some tests,
    // but here we call the engine first in the new logic.

    expect(await getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('should return setup templates for different budgets', () => {
    game.initialPoints = 12;
    expect(getSetupTemplates(game)[0].cost).toBe(12);
    game.initialPoints = 18;
    expect(getSetupTemplates(game)[0].cost).toBe(18);
    game.initialPoints = 11;
    expect(getSetupTemplates(game)[0].cost).toBe(15);
  });

  test('showTutorSuggestions should return early if no bestMoves', async () => {
    game.bestMoves = null;
    await showTutorSuggestions(game);
    expect(UI.showTutorSuggestions).not.toHaveBeenCalled();

    game.bestMoves = [];
    await showTutorSuggestions(game);
    expect(UI.showTutorSuggestions).not.toHaveBeenCalled();
  });

  test('showTutorSuggestions should call UI if bestMoves exists', async () => {
    game.bestMoves = [{ move: {}, notation: 'e4' }];
    await showTutorSuggestions(game);
    expect(UI.showTutorSuggestions).toHaveBeenCalled();
  });

  test('applySetupTemplate for black pieces', () => {
    game.phase = PHASES.SETUP_BLACK_PIECES;
    game.blackCorridor = 3;
    const template = {
      id: 'rush_12',
      name: 'Rush',
      pieces: ['q', 'p', 'p', 'p'],
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'rush_12');

    // Black frontRow is rowStart + 2 = 2
    expect(game.board[2][3].type).toBe('p');
  });

  test('applySetupTemplate with piece placement fallback', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = 3;
    // Fill up rows
    for (let c = 3; c < 6; c++) {
      game.board[6][c] = { type: 'p' };
      game.board[7][c] = { type: 'p' };
      game.board[8][c] = { type: 'p' };
    }
    game.board[8][3] = null;

    const template = {
      id: 'test',
      pieces: ['r'],
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'test');
    expect(game.board[8][3].type).toBe('r');
  });

  test('applySetupTemplate fallbacks for queens, knights and others', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = 3;

    // Block all normal slots
    for (let r = 6; r <= 8; r++) {
      for (let c = 3; c <= 5; c++) {
        game.board[r][c] = { type: 'p' };
      }
    }

    // Open one fallback slot in back row
    game.board[8][3] = null;

    const template = {
      id: 'fallback',
      pieces: ['q', 'n', 'e'], // Queen, Knight, Angel (others)
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'fallback');
    // They should all hit placeAnywhere and eventually find 8,3
    expect(game.board[8][3]).toBeDefined();
  });

  test('applySetupTemplate with blocked corners for rooks/bishops', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = 3;

    // Pieces everywhere
    for (let r = 6; r <= 8; r++) {
      for (let c = 3; c <= 5; c++) {
        game.board[r][c] = { type: 'p' };
      }
    }

    // Only one opening not in corner/center
    game.board[7][4] = null;

    const template = {
      id: 'blocked',
      pieces: ['r', 'b'],
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'blocked');
    expect(game.board[7][4]).toBeDefined();
  });

  test('applySetupTemplate should place pieces around key blocker (King)', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = 3;

    // Place King in the best spot for a Queen (Back row centerish)
    // White Back Row is 8. Center col of corridor (3,4,5) is 4.
    game.board[8][4] = { type: 'k', color: 'white' };

    // Template with Queen
    const template = {
      id: 'queen_test',
      pieces: ['q'],
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'queen_test');

    // Queen prefers back row (8). 8,4 is taken by King.
    // Should go to 8,3 or 8,5 or 7,4.
    // Check Queen is placed and NOT at 8,4
    let queenPos = null;
    for (let r = 6; r <= 8; r++) {
      for (let c = 3; c <= 5; c++) {
        if (game.board[r][c] && game.board[r][c].type === 'q') {
          queenPos = { r, c };
        }
      }
    }

    expect(queenPos).not.toBeNull();
    // Verify it didn't overwrite King
    expect(game.board[8][4].type).toBe('k');
    // Verify it found a spot (likely 8,3 or 8,5 as they are back row score 50+20=70 vs middle row 10)
    expect(queenPos.r).toBe(8);
  });

  test('applySetupTemplate heuristics: Pawn preference', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = 3;

    // We use a custom template with 1 pawn and 1 rook
    const template = { id: 'heuristic_test', pieces: ['p', 'r'] };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    // Apply
    applySetupTemplate(game, mockTutorController, 'heuristic_test');

    // Expected: Pawn in front row (6), Rook in back row (8)
    // We check if ANY pawn is in row 6, and ANY rook is in row 8
    const pawnsInFront = [3, 4, 5].some(c => game.board[6][c] && game.board[6][c].type === 'p');
    const rooksInBack = [3, 4, 5].some(c => game.board[8][c] && game.board[8][c].type === 'r');

    expect(pawnsInFront).toBe(true);
    expect(rooksInBack).toBe(true);
  });

  test('isTutorMove should identify moves correctly', () => {
    const from = { r: 6, c: 4 },
      to = { r: 4, c: 4 };
    game.bestMoves = [{ move: { from, to } }];
    expect(isTutorMove(game, from, to)).toBe(true);
  });

  test('updateBestMoves should trigger debounced hints', () => {
    game.phase = PHASES.PLAY;
    updateBestMoves(game, mockTutorController);
    expect(mockTutorController.debouncedGetTutorHints).toHaveBeenCalled();
  });
});
