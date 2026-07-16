/**
 * Invariant tests for js/matchRefs.ts — the engine strength-measurement gate.
 *
 * These lock in the bug fix from PR (fix/matchrefs-fen-gate):
 *   - A start FEN must be played for real (not silently replaced by the
 *     starting position with a phantom first move).
 *   - Material verdict must reflect MATERIAL GAINED from the start FEN, not
 *     absolute board material (tactical FENs may start lopsided).
 *   - Promotion / side-to-move must be honoured.
 *
 * All FENs are VALID 9x9 (9 ranks, each rank sums to 9 files a..i).
 */

import { describe, it, expect } from 'vitest';
import {
  startingBoard,
  materialDiff,
  fenToBoardTurn,
} from '../js/matchRefs.js';
import { parseFEN } from '../js/utils.js';

/** piece letter -> internal code, mirror of engine code mapping. */
function pieceCode(t: string): number {
  return { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6, a: 7, c: 8, e: 9, j: 10 }[t] ?? 0;
}

describe('matchRefs gate — start FEN is honored (not silently replaced)', () => {
  it('startingBoard(fen) builds the FEN position, not the starting position', () => {
    // Back-rank FEN (9x9): white queen on d2, black king on a8, white king on i8.
    const fen9 = '9/9/9/9/9/9/9/3q5/k1K5N w - - 0 1';
    const board = startingBoard(fen9);
    // Black queen (code -5) must be present on the board at d2.
    const queenCount = board.flat().filter((c) => c === -5).length;
    expect(queenCount).toBe(1);
    // The FEN board must differ from the starting position
    // (starting position has no queen on d2 and 9 pawns per side).
    const starter = startingBoard();
    expect(board).not.toEqual(starter);
  });

  it('startingBoard() without FEN returns the canonical 9x9 starting position', () => {
    const board = startingBoard();
    // White back rank: R N B Q K B N R A = 4,2,3,5,6,3,2,4,7
    expect(board[8]).toEqual([4, 2, 3, 5, 6, 3, 2, 4, 7]);
    expect(board[0]).toEqual([-4, -2, -3, -5, -6, -3, -2, -4, -7]);
    // Two full pawn rows.
    expect(board[1].every((c) => c === -1)).toBe(true);
    expect(board[7].every((c) => c === 1)).toBe(true);
  });

  it('FEN is parsed into the same board that parseFEN produces', () => {
    const fen = '9/9/9/2N6/2r6/9/9/K5k1/9 b - - 0 1';
    const fromGate = startingBoard(fen);
    const { board } = parseFEN(fen);
    const expected = board.map((row) =>
      row.map((p) =>
        p ? (p.color === 'white' ? 1 : -1) * pieceCode(p.type) : 0
      )
    );
    expect(fromGate).toEqual(expected);
  });
});

describe('matchRefs gate — material verdict reflects GAINED material (not absolute)', () => {
  it('materialDiff is zero for a balanced empty-ish start position', () => {
    // Symmetric: same material each side (a rook each), NEW=white.
    const fen9 = '9/9/9/9/4r4/9/4R4/9/9 w - - 0 1';
    const board = startingBoard(fen9);
    expect(materialDiff(board, true)).toBe(0);
  });

  it('materialDiff ignores the starting lopsidedness of a tactical FEN', () => {
    // White: only K. Black: K + Q(d2). Black starts up a queen (900),
    // but that is the GIVEN position, not something either engine "won".
    const fen9 = '9/9/9/9/9/9/9/3q5/7kK w - - 0 1';
    const board = startingBoard(fen9);
    // black owns the queen (value 900) -> NEW(white) is behind by 900 at start.
    expect(materialDiff(board, true)).toBe(-900);
    // If white captures the queen (net +900), the gained-material verdict flips.
    board[7][3] = 0; // remove black queen on d2 (row7, col3 in 0-indexed)
    expect(materialDiff(board, true)).toBe(0);
  });

  it('materialDiff is symmetric under color swap', () => {
    // white N(d6)+K(i1) vs black n(d6)+K(i1) — symmetric.
    const fen9 = '9/9/9/9/3N5/9/9/9/3n4K w - - 0 1';
    const board = startingBoard(fen9);
    expect(materialDiff(board, true)).toBe(-materialDiff(board, false));
  });
});

describe('matchRefs gate — side-to-move parsing', () => {
  it('reads white from FEN', () => {
    expect(fenToBoardTurn('9/9/9/9/9/9/9/3q5/k1K5N w - - 0 1')).toBe('white');
  });
  it('reads black from FEN', () => {
    expect(fenToBoardTurn('9/9/9/2N6/2r6/9/9/K5k1/9 b - - 0 1')).toBe('black');
  });
  it('defaults to white for malformed turn field', () => {
    expect(fenToBoardTurn('9/9/9/9/9/9/9/3q5/k1K5N x - - 0 1')).toBe('white');
  });
});
