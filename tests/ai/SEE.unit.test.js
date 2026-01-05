import { see } from '../../js/ai/MoveGenerator.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_PAWN,
  WHITE_KNIGHT,
  WHITE_BISHOP,
  WHITE_ROOK,
  WHITE_QUEEN,
  BLACK_PAWN,
  BLACK_KNIGHT,
  BLACK_ROOK,
  BLACK_QUEEN,
  coordsToIndex,
} from '../../js/ai/BoardDefinitions.js';

describe('Static Exchange Evaluation (SEE)', () => {
  let board;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  });

  test('should return positive for winning captures (PxQ)', () => {
    // White Pawn at 4,4 (40) captures Black Queen at 3,5 (32)
    const from = coordsToIndex(4, 4);
    const to = coordsToIndex(3, 5);
    board[from] = WHITE_PAWN;
    board[to] = BLACK_QUEEN;

    const score = see(board, { from, to });
    // Profit = Val(Q) = 900. No defenders.
    expect(score).toBe(900);
  });

  test('should return positive for equal captures (NxN)', () => {
    const from = coordsToIndex(4, 4);
    const to = coordsToIndex(2, 3);
    board[from] = WHITE_KNIGHT;
    board[to] = BLACK_KNIGHT;

    const score = see(board, { from, to });
    // Profit = Val(N) = 320.
    expect(score).toBe(320);
  });

  test('should return 0 for quiet moves', () => {
    const from = coordsToIndex(4, 4);
    const to = coordsToIndex(3, 4);
    board[from] = WHITE_PAWN;
    // target is empty (PIECE_NONE)

    const score = see(board, { from, to });
    expect(score).toBe(0);
  });

  test('should return negative for losing captures (QxP defended)', () => {
    // White Queen captures Black Pawn at 4,4
    // Black Rook at 4,8 defends 4,4
    const from = coordsToIndex(0, 0);
    const to = coordsToIndex(4, 4);
    board[from] = WHITE_QUEEN;
    board[to] = BLACK_PAWN;
    board[coordsToIndex(4, 8)] = BLACK_ROOK;

    const score = see(board, { from, to });
    // White takes Pawn (+100), Black takes Queen (-900) -> -800
    expect(score).toBe(-800);
  });

  test('should handle multi-piece exchange (LVA order)', () => {
    // BxN at 4,4
    // Black has: Pawn at 5,3 defending 4,4
    // White has: Rook at 0,4 defending 4,4

    const to = coordsToIndex(4, 4);
    board[to] = BLACK_KNIGHT; // target N (320)

    // White Attacker 1: Bishop (330)
    const whiteB = coordsToIndex(6, 6);
    board[whiteB] = WHITE_BISHOP;

    // Black Defender 1: Pawn (100)
    const blackP = coordsToIndex(5, 5);
    board[blackP] = BLACK_PAWN;

    // White Attacker 2: Rook (500)
    const whiteR = coordsToIndex(0, 4);
    board[whiteR] = WHITE_ROOK;

    // Exchange:
    // 1. White BxN (+320).
    // 2. Black PxB (-330) -> Score: -10
    // 3. White RxP (+100) -> Score: +90
    // Result should be 320 if White stops (but White won't stop at -10 if they can regain).
    // Actually SEE minimax determines if White should enter.

    const score = see(board, { from: whiteB, to });
    expect(score).toBeGreaterThan(0);
  });

  test('should handle X-ray attacks', () => {
    // White Rook at 0,4
    // White Queen at 0,2 (X-raying through Rook if Rook moves to 'to')
    // Target at 4,4

    const to = coordsToIndex(4, 4);
    board[to] = BLACK_QUEEN; // target Q (900)

    const whiteR = coordsToIndex(0, 4);
    board[whiteR] = WHITE_ROOK; // from

    const whiteQ = coordsToIndex(0, 2);
    board[whiteQ] = WHITE_QUEEN; // X-ray

    const blackR = coordsToIndex(8, 4);
    board[blackR] = BLACK_ROOK; // defender

    // White RxQ (+900)
    // Black RxR (-500)
    // White QxR (+500)
    // Profit: 900

    const score = see(board, { from: whiteR, to });
    expect(score).toBe(900);
  });
});
