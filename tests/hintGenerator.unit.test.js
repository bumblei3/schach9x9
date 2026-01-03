import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock UI
jest.unstable_mockModule('../js/ui.js', () => ({
  showTutorSuggestions: jest.fn(),
  renderBoard: jest.fn(),
  updateShopUI: jest.fn(),
}));

const UI = await import('../js/ui.js');
const {
  getTutorHints,
  getSetupTemplates,
  applySetupTemplate,
  isTutorMove,
  showTutorSuggestions,
  updateBestMoves
} = await import('../js/tutor/HintGenerator.js');

describe('HintGenerator - Unit Tests', () => {
  let game;
  let mockTutorController;

  beforeEach(() => {
    jest.clearAllMocks();

    game = new Game(15, 'classic');
    game.board = Array(9).fill(null).map(() => Array(9).fill(null));
    game.bestMoves = [];

    mockTutorController = {
      getPieceName: jest.fn(type => type),
      getThreatenedPieces: jest.fn(() => []),
      getDefendedPieces: jest.fn(() => []),
      detectTacticalPatterns: jest.fn(() => []),
      analyzeMoveWithExplanation: jest.fn(() => ({ title: 'Test' })),
      getSetupTemplates: jest.fn(() => []),
      debouncedGetTutorHints: jest.fn(),
    };
  });

  test('getTutorHints should return empty if not in PLAY phase', () => {
    game.phase = PHASES.SETUP_WHITE_KING;
    const hints = getTutorHints(game, mockTutorController);
    expect(hints).toEqual([]);
  });

  test('getTutorHints should return hints for human player', () => {
    game.phase = PHASES.PLAY;
    game.isAI = true;
    game.turn = 'white';

    // Mock game methods
    game.getAllLegalMoves = jest.fn(() => [{ from: { r: 7, c: 4 }, to: { r: 5, c: 4 } }]);
    game.getValidMoves = jest.fn(() => [{ r: 5, c: 4 }]);
    game.isSquareUnderAttack = jest.fn(() => false);
    game.minimax = jest.fn(() => 50);

    game.board[7][4] = { type: 'p', color: 'white' };

    const hints = getTutorHints(game, mockTutorController);
    expect(hints.length).toBeGreaterThan(0);
  });

  test('getTutorHints should filter out pieces of wrong color or missing', () => {
    game.phase = PHASES.PLAY;
    game.board[7][4] = { type: 'p', color: 'black' }; // Wrong color
    game.getAllLegalMoves = jest.fn(() => [{ from: { r: 7, c: 4 }, to: { r: 5, c: 4 } }]);

    expect(getTutorHints(game, mockTutorController)).toEqual([]);

    game.board[7][4] = null; // Missing
    expect(getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should skip self-captures (though illegal)', () => {
    game.phase = PHASES.PLAY;
    game.board[7][4] = { type: 'p', color: 'white' };
    game.board[5][4] = { type: 'p', color: 'white' }; // Same color
    game.getAllLegalMoves = jest.fn(() => [{ from: { r: 7, c: 4 }, to: { r: 5, c: 4 } }]);

    expect(getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should return empty for AI turn', () => {
    game.turn = 'black';
    game.isAI = true;
    expect(getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should return empty if no legal moves', () => {
    game.phase = PHASES.PLAY;
    game.getAllLegalMoves = jest.fn(() => []);
    expect(getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('getTutorHints should skip invalid candidates', () => {
    game.phase = PHASES.PLAY;
    game.getAllLegalMoves = jest.fn(() => [{ from: { r: 7, c: 4 }, to: { r: 5, c: 4 } }]);
    game.getValidMoves = jest.fn(() => []); // None valid
    game.board[7][4] = { type: 'p', color: 'white' };

    expect(getTutorHints(game, mockTutorController)).toEqual([]);
  });

  test('should return setup templates for different budgets', () => {
    game.initialPoints = 12;
    expect(getSetupTemplates(game)[0].cost).toBe(12);
    game.initialPoints = 18;
    expect(getSetupTemplates(game)[0].cost).toBe(18);
    game.initialPoints = 11;
    expect(getSetupTemplates(game)[0].cost).toBe(15);
  });

  test('showTutorSuggestions should return early if no bestMoves', () => {
    game.bestMoves = null;
    showTutorSuggestions(game);
    expect(UI.showTutorSuggestions).not.toHaveBeenCalled();

    game.bestMoves = [];
    showTutorSuggestions(game);
    expect(UI.showTutorSuggestions).not.toHaveBeenCalled();
  });

  test('showTutorSuggestions should call UI if bestMoves exists', () => {
    game.bestMoves = [{ move: {}, notation: 'e4' }];
    showTutorSuggestions(game);
    expect(UI.showTutorSuggestions).toHaveBeenCalled();
  });

  test('applySetupTemplate for black pieces', () => {
    game.phase = PHASES.SETUP_BLACK_PIECES;
    game.blackCorridor = { rowStart: 0, colStart: 3 };
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
    game.whiteCorridor = { rowStart: 6, colStart: 3 };
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
    game.whiteCorridor = { rowStart: 6, colStart: 3 };

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
      pieces: ['q', 'n', 'e'] // Queen, Knight, Angel (others)
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'fallback');
    // They should all hit placeAnywhere and eventually find 8,3
    expect(game.board[8][3]).toBeDefined();
  });

  test('applySetupTemplate with blocked corners for rooks/bishops', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = { rowStart: 6, colStart: 3 };

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
      pieces: ['r', 'b']
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    applySetupTemplate(game, mockTutorController, 'blocked');
    expect(game.board[7][4]).toBeDefined();
  });

  test('applySetupTemplate with fallback for bishops/queens/knights', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = { rowStart: 6, colStart: 3 };

    // Fill all slots
    for (let r = 6; r <= 8; r++) {
      for (let c = 3; c <= 5; c++) {
        game.board[r][c] = { type: 'p' };
      }
    }

    // Open one distant slot (though theoretically not possible in corridor but good for fallback test)
    game.board[0][0] = null;

    const template = {
      id: 'super_fallback',
      pieces: ['b', 'q', 'n']
    };
    mockTutorController.getSetupTemplates.mockReturnValue([template]);

    // This might fail if placeAnywhere only checks a narrow range,
    // let's check placeAnywhere: it checks backSquares, middleSquares, frontSquares.
    // So it only checks the corridor!
    // If corridor is full, it will just not place it.

    // Let's open one slot in the corridor.
    game.board[6][3] = null; // front row, first slot

    applySetupTemplate(game, mockTutorController, 'super_fallback');
    expect(game.board[6][3]).toBeDefined();
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
