import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import {
  getTutorHints,
  getSetupTemplates,
  applySetupTemplate,
  isTutorMove,
} from '../js/tutor/HintGenerator.js';
import { BOARD_SIZE, PHASES } from '../js/config.js';

describe('HintGenerator - Unit Tests', () => {
  let game;

  beforeEach(() => {
    game = new Game(15, 'classic');
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    game.bestMoves = [];
  });

  test('getTutorHints should return empty if not in PLAY phase', () => {
    game.phase = PHASES.SETUP_WHITE_KING;
    const hints = getTutorHints(game, {});
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

    const mockTutorController = {
      getPieceName: jest.fn(type => type),
      getThreatenedPieces: jest.fn(() => []),
      getDefendedPieces: jest.fn(() => []),
      detectTacticalPatterns: jest.fn(() => []),
      analyzeMoveWithExplanation: jest.fn(() => ({ title: 'Test' })),
    };

    const hints = getTutorHints(game, mockTutorController);
    expect(hints.length).toBeGreaterThan(0);
  });

  test('should return setup templates for different budgets', () => {
    game.initialPoints = 12;
    expect(getSetupTemplates(game)[0].cost).toBe(12);
    game.initialPoints = 18;
    expect(getSetupTemplates(game)[0].cost).toBe(18);
    game.initialPoints = 11;
    expect(getSetupTemplates(game)[0].cost).toBe(15);
  });

  test('should apply setup template correctly', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.whiteCorridor = { rowStart: 6, colStart: 3 };
    game.board[7][4] = { type: 'k', color: 'white' };

    const mockTutorController = {
      getSetupTemplates: () => [
        {
          id: 'test',
          name: 'Test',
          pieces: ['q', 'r', 'b', 'n', 'p', 'x'],
          cost: 15,
        },
      ],
    };

    applySetupTemplate(game, mockTutorController, 'test');
    expect(game.points).toBe(15 - 1 - 5 - 3 - 3 - 9 - 0); // q(9), r(5), b(3), n(3), p(1), x(0). Wait, x is 'others' which is 0. Total = 21? No, budget is 15.
    // template.pieces is ['q', 'r', 'b', 'n', 'p', 'x'].
    // Point values: q(9), r(5), b(3), n(3), p(1), x(0).
    // Total cost = 9+5+3+3+1 = 21.
    // game.points = 15 - 21 = -6. Correct.
  });

  test('isTutorMove should identify moves correctly', () => {
    const from = { r: 6, c: 4 },
      to = { r: 4, c: 4 };
    game.bestMoves = [{ move: { from, to } }];
    expect(isTutorMove(game, from, to)).toBe(true);
  });
});
