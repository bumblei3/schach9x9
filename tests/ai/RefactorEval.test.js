import { evaluatePosition } from '../../js/ai/Evaluation.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_PAWN,
  WHITE_KNIGHT,
  // WHITE_KING,
  // BLACK_PAWN,
  BLACK_KNIGHT,
  // BLACK_KING,
  coordsToIndex,
  // COLOR_WHITE,
  // COLOR_BLACK
} from '../../js/ai/BoardDefinitions.js';

describe('Integer Evaluation', () => {
  let board;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  });

  test('should value material correctly', () => {
    // White Pawn vs Empty
    board[0] = WHITE_PAWN;
    const score = evaluatePosition(board, 'white');

    // Pawn = 100 + PST + etc.
    // Approx > 0 (Material balanced but positional bonuses exist)
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(800);
  });

  test('should respect PST (Knight Center vs Corner)', () => {
    // Knight Center (4,4)
    const centerIdx = coordsToIndex(4, 4);
    board.fill(PIECE_NONE);
    board[centerIdx] = WHITE_KNIGHT;
    const centerScore = evaluatePosition(board, 'white');

    // Knight Corner (0,0)
    const cornerIdx = coordsToIndex(0, 0);
    board.fill(PIECE_NONE);
    board[cornerIdx] = WHITE_KNIGHT;
    const cornerScore = evaluatePosition(board, 'white');

    expect(centerScore).toBeGreaterThan(cornerScore);
  });

  test('should satisfy symmetry', () => {
    // White Knight at 4,4
    const idx = coordsToIndex(4, 4);
    board[idx] = WHITE_KNIGHT;
    const whiteScore = evaluatePosition(board, 'white');

    // Black Knight at 4,4 (Mirror? No, Black at same square)
    // If Black Knight is at 4,4, and we eval for Black...
    // 4,4 mirrored row is 4,4 (Row 4 is middle).
    // 8 - 4 = 4.
    // So Black Knight at 4,4 should have SAME score as White Knight at 4,4.

    board.fill(PIECE_NONE);
    board[idx] = BLACK_KNIGHT;
    const blackScore = evaluatePosition(board, 'black');

    // Tempo bonus might differ if we hardcoded "+10 for side to move".
    // evaluatePosition adds tempo to *mgScore*.
    // If both called with side-to-move, they get same tempo.

    expect(blackScore).toBe(whiteScore);
  });
});
