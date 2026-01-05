import { evaluatePosition } from '../../js/ai/Evaluation.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_PAWN,
  WHITE_KING,
  BLACK_KING,
  BLACK_PAWN,
  coordsToIndex,
} from '../../js/ai/BoardDefinitions.js';

describe('AI Elo Personalities', () => {
  let board;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  });

  test('AGGRESSIVE personality should reward forward pieces more', () => {
    // Pawn close to enemy king
    board[coordsToIndex(1, 4)] = WHITE_PAWN;
    board[coordsToIndex(0, 4)] = BLACK_KING; // Enemy king
    board[coordsToIndex(8, 4)] = WHITE_KING;

    const normalScore = evaluatePosition(board, 'white', { personality: 'NORMAL' });
    const aggressiveScore = evaluatePosition(board, 'white', { personality: 'AGGRESSIVE' });

    // AGGRESSIVE has attackWeight = 1.4, NORMAL is 1.0.
    // PST for Pawn at R1 is 50.
    // 50 * 1.4 = 70 vs 50 * 1.0 = 50.
    expect(aggressiveScore).toBeGreaterThan(normalScore);
  });

  test('SOLID personality should reward pawn structure more', () => {
    // Linked pawns
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(7, 3)] = WHITE_PAWN;
    board[coordsToIndex(8, 4)] = WHITE_KING;
    board[coordsToIndex(0, 4)] = BLACK_KING;

    const normalScore = evaluatePosition(board, 'white', { personality: 'NORMAL' });
    const solidScore = evaluatePosition(board, 'white', { personality: 'SOLID' });

    // SOLID has pawnStructureWeight = 1.3, NORMAL is 1.0.
    // Linked bonus is 10. 10 * 1.3 = 13 vs 10 * 1.0 = 10.
    expect(solidScore).toBeGreaterThan(normalScore);
  });

  test('SOLID personality should penalize exposed kings more', () => {
    // White king with no pawn shelter
    board[coordsToIndex(8, 4)] = WHITE_KING;
    // Black king WITH pawn shelter
    board[coordsToIndex(0, 4)] = BLACK_KING;
    board[coordsToIndex(1, 4)] = BLACK_PAWN;

    const normalScore = evaluatePosition(board, 'white', { personality: 'NORMAL' });
    const solidScore = evaluatePosition(board, 'white', { personality: 'SOLID' });

    // Shelter penalty is -15. -15 * 0.5 = -7.5 for egScore.
    // SOLID has kingSafetyWeight = 1.4, so penalty is -21. -21 * 0.5 = -10.5.
    // normalScore should be around 5 (tempo) - 7.5 (shelter) + black_pieces...
    // solidScore should be lower than normalScore because it cares MORE about safety.
    expect(solidScore).toBeLessThan(normalScore);
  });
});
