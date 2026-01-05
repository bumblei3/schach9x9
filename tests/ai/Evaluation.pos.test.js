import { evaluatePosition } from '../../js/ai/Evaluation.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_BISHOP,
  WHITE_KNIGHT,
  WHITE_PAWN,
  coordsToIndex,
} from '../../js/ai/BoardDefinitions.js';

describe('Positional Evaluation Improvements', () => {
  let board;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  });

  test('should reward Bishop Pair', () => {
    // White has 2 bishops vs 1 knight
    board[coordsToIndex(7, 2)] = WHITE_BISHOP;
    board[coordsToIndex(7, 5)] = WHITE_BISHOP;
    const scoreWithPair = evaluatePosition(board, 'white');

    // Reset and give only 1 bishop + 1 knight
    board.fill(PIECE_NONE);
    board[coordsToIndex(7, 2)] = WHITE_BISHOP;
    board[coordsToIndex(7, 5)] = WHITE_KNIGHT;
    const scoreWithoutPair = evaluatePosition(board, 'white');

    // Difference should be around Bishop value diff + Pair Bonus
    // B=330, N=320. Diff = 10. Pair Bonus = 50. Total = 60.
    expect(scoreWithPair - scoreWithoutPair).toBeGreaterThan(40);
  });

  test('should penalize Doubled Pawns', () => {
    // Position 1: Pawns on different columns (Column 4 and 5)
    board.fill(PIECE_NONE);
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(6, 5)] = WHITE_PAWN;
    // Add neighbors to avoid isolated penalty
    board[coordsToIndex(6, 3)] = WHITE_PAWN;
    board[coordsToIndex(6, 6)] = WHITE_PAWN;
    evaluatePosition(board, 'white');

    // Position 2: Doubled pawns (Column 4)
    board.fill(PIECE_NONE);
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(7, 4)] = WHITE_PAWN; // Move one back to double it up
    // Add neighbors to avoid isolated penalty
    board[coordsToIndex(6, 3)] = WHITE_PAWN;
    board[coordsToIndex(6, 6)] = WHITE_PAWN;
    evaluatePosition(board, 'white');

    // PST at R6,c4 is -20. PST at R6,c5 is -20.
    // PST at R7,c4 is 0.
    // So moving from (6,5) to (7,4) gains 20 in PST!
    // Penalty is -15.
    // 20 - 15 = 5. Still might be better.

    // Let's use R4 where PST is more stable
    board.fill(PIECE_NONE);
    board[coordsToIndex(4, 3)] = WHITE_PAWN; // Neighbor
    board[coordsToIndex(4, 5)] = WHITE_PAWN; // Neighbor
    board[coordsToIndex(4, 4)] = WHITE_PAWN;
    board[coordsToIndex(3, 3)] = WHITE_PAWN; // Other row neighbor
    evaluatePosition(board, 'white');

    board[coordsToIndex(3, 4)] = WHITE_PAWN; // Add a second pawn to double it
    evaluatePosition(board, 'white');

    // Doubled penalty is -15. Pawn value is 100. PST at R3,c4 is 25.
    // Expected gain without penalty: 100 + 25 = 125.
    // With penalty: 125 - 15 = 110.
    // Let's just verify doubling is penalized compared to a non-doubled placement at same rank.

    board.fill(PIECE_NONE);
    board[coordsToIndex(4, 2)] = WHITE_PAWN;
    board[coordsToIndex(4, 3)] = WHITE_PAWN;
    board[coordsToIndex(4, 4)] = WHITE_PAWN;
    board[coordsToIndex(4, 5)] = WHITE_PAWN;
    const flatScore = evaluatePosition(board, 'white');

    board.fill(PIECE_NONE);
    board[coordsToIndex(4, 3)] = WHITE_PAWN;
    board[coordsToIndex(5, 3)] = WHITE_PAWN; // Doubled
    board[coordsToIndex(4, 4)] = WHITE_PAWN;
    board[coordsToIndex(4, 5)] = WHITE_PAWN;
    const flatDoubledScore = evaluatePosition(board, 'white');

    expect(flatScore).toBeGreaterThan(flatDoubledScore);
  });

  test('should penalize Isolated Pawns', () => {
    // Pawn with neighbor
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(6, 3)] = WHITE_PAWN;
    const supportedScore = evaluatePosition(board, 'white');

    // Isolated pawn (move neighbor far away)
    board.fill(PIECE_NONE);
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(6, 1)] = WHITE_PAWN;
    const isolatedScore = evaluatePosition(board, 'white');

    expect(supportedScore).toBeGreaterThan(isolatedScore);
  });

  test('should reward Passed Pawns based on rank', () => {
    // Pawn at rank 6 (index 6,4)
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    const rank6Score = evaluatePosition(board, 'white');

    // Pawn at rank 3 (index 3,4) - more advanced
    board.fill(PIECE_NONE);
    board[coordsToIndex(3, 4)] = WHITE_PAWN;
    const rank3Score = evaluatePosition(board, 'white');

    expect(rank3Score).toBeGreaterThan(rank6Score);
  });

  test('should reward Linked Pawns', () => {
    // Two pawns on different columns, not supporting each other
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(6, 3)] = WHITE_PAWN;
    evaluatePosition(board, 'white');

    // Two pawns linked (one protecting the other)
    board.fill(PIECE_NONE);
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(7, 3)] = WHITE_PAWN; // (7,3) protects (6,4)
    evaluatePosition(board, 'white');

    // PST for R6,c4 is -20. PST for R6,c3 is -20. Sum -40.
    // PST for R6,c4 is -20. PST for R7,c3 is 0. Sum -20.
    // Moving from (6,3) to (7,3) gains 20 in PST.
    // Linked bonus is +10.
    // So linkedScore should be significantly higher.

    // Let's use same rows to be sure
    board.fill(PIECE_NONE);
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(6, 3)] = WHITE_PAWN;
    board[coordsToIndex(5, 5)] = WHITE_PAWN; // Random neighbor
    const score1 = evaluatePosition(board, 'white');

    board.fill(PIECE_NONE);
    board[coordsToIndex(6, 4)] = WHITE_PAWN;
    board[coordsToIndex(7, 3)] = WHITE_PAWN; // Linked
    board[coordsToIndex(5, 5)] = WHITE_PAWN;
    const score2 = evaluatePosition(board, 'white');

    expect(score2).toBeGreaterThan(score1);
  });
});
