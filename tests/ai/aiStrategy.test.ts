import { describe, test, expect, beforeEach } from 'vitest';
import { orderMoves } from '../../js/ai/MoveOrdering.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_PAWN,
  BLACK_PAWN,
  WHITE_ROOK,
  BLACK_QUEEN,
  coordsToIndex,
} from '../../js/ai/BoardDefinitions.js';

describe('AI Strategy - Move Ordering', () => {
  let board: Int8Array;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  });

  test('should prioritize capture moves over quiet moves', () => {
    const fromRow = 4,
      fromCol = 3;
    const capRow = 3,
      capCol = 4;
    const quietRow = 3,
      quietCol = 3;

    const fromIdx = coordsToIndex(fromRow, fromCol);
    const capIdx = coordsToIndex(capRow, capCol);
    const quietIdx = coordsToIndex(quietRow, quietCol);

    board[fromIdx] = WHITE_PAWN;
    board[capIdx] = BLACK_PAWN;
    board[quietIdx] = PIECE_NONE;

    const captureMove = { from: fromIdx, to: capIdx };
    const quietMove = { from: fromIdx, to: quietIdx };

    // orderMoves(board, moves, ttMove, killers, history, prevMove)
    const moves = [quietMove, captureMove];
    const sortedMoves = orderMoves(board, moves, null, null, null, null);

    // Expect capture to be first
    expect(sortedMoves[0]).toEqual(captureMove);
    expect(sortedMoves[1]).toEqual(quietMove);
  });

  test('should prioritize MVV-LVA (Most Valuable Victim - Least Valuable Attacker)', () => {
    // Victim: Black Queen at d5 (3, 4)
    const vicRow = 3,
      vicCol = 4;
    const vicIdx = coordsToIndex(vicRow, vicCol);
    board[vicIdx] = BLACK_QUEEN;

    // Attacker 1: White Pawn at d4 (4, 3)
    const pIdx = coordsToIndex(4, 3);
    board[pIdx] = WHITE_PAWN;

    // Attacker 2: White Rook at c5 (3, 2)
    const rIdx = coordsToIndex(3, 2);
    board[rIdx] = WHITE_ROOK;

    const pawnCapture = { from: pIdx, to: vicIdx };
    const rookCapture = { from: rIdx, to: vicIdx };

    const moves = [rookCapture, pawnCapture];

    const sortedMoves = orderMoves(board, moves, null, null, null, null);

    // Pawn capture (score: 8900) > Rook capture (score: 8500)
    expect(sortedMoves[0]).toEqual(pawnCapture);
    expect(sortedMoves[1]).toEqual(rookCapture);
  });
});
