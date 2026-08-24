import { describe, it, expect } from 'vitest';
import {
  startingBoard,
  materialDiff,
  fenToBoardTurn,
  TACTICAL_FENS,
} from '../js/matchRefs.js';

// ============================================================================
// Invariant suite for the DOM-free exports of js/matchRefs.ts — the A/B
// engine-match harness. The board helpers are the measurement foundation:
// a wrong startingBoard/materialDiff silently invalidates every match verdict.
// ============================================================================

describe('startingBoard', () => {
  it('builds a 9x9 zero-filled board without FEN', () => {
    const b = startingBoard();
    expect(b).toHaveLength(9);
    for (const row of b) expect(row).toHaveLength(9);
    expect(b.flat().every((c) => Number.isInteger(c))).toBe(true);
  });

  it('places exactly the standard 36 pieces on the initial board', () => {
    const flat = startingBoard().flat();
    expect(flat.filter((c) => c !== 0)).toHaveLength(36);
    expect(flat.filter((c) => c > 0)).toHaveLength(18); // white
    expect(flat.filter((c) => c < 0)).toHaveLength(18); // black
  });

  it('mirrors piece codes between white (rank 8) and black (rank 0)', () => {
    const b = startingBoard();
    for (let c = 0; c < 9; c++) {
      expect(b[8][c]).toBe(-b[0][c]);
      expect(b[7][c]).toBe(-b[1][c]); // pawn ranks
    }
  });

  it('honours a FEN instead of the symmetric opening', () => {
    // Single-king FEN must NOT look like the start position.
    const b = startingBoard('9/9/9/9/9/9/9/9/k1K5N w - - 0 1');
    const pieces = b.flat().filter((c) => c !== 0);
    expect(pieces.length).toBe(3); // k, K, N
    expect(pieces).toContain(6); // white king code
  });

  it('parses every TACTICAL_FEN into exactly one king per colour (legal positions)', () => {
    expect(TACTICAL_FENS.length).toBeGreaterThanOrEqual(4);
    for (const fen of TACTICAL_FENS) {
      const b = startingBoard(fen);
      const kings = b.flat().filter((c) => Math.abs(c) === 6);
      expect(kings.filter((c) => c === 6).length).toBe(1);
      expect(kings.filter((c) => c === -6).length).toBe(1);
    }
  });
});

describe('fenToBoardTurn', () => {
  it("maps 'w' to white and 'b' to black", () => {
    expect(fenToBoardTurn('9/9/9/9/9/9/9/9/9 w - - 0 1')).toBe('white');
    expect(fenToBoardTurn('9/9/9/9/9/9/9/9/9 b - - 0 1')).toBe('black');
  });

  it('defaults anything unexpected to white (documented fallback)', () => {
    expect(fenToBoardTurn('9/9/9/9/9/9/9/9/9 x - - 0 1')).toBe('white');
  });
});

describe('materialDiff', () => {
  it('returns 0 for the symmetric starting board regardless of side assignment', () => {
    const b = startingBoard();
    expect(materialDiff(b, true)).toBe(0);
    expect(materialDiff(b, false)).toBe(0);
  });

  it('is antisymmetric under swapping which side NEW plays', () => {
    const b = startingBoard('9/9/9/3r5/9/9/7N1/7K1/k8 w - - 0 1');
    const dWhite = materialDiff(b, true);
    const dBlack = materialDiff(b, false);
    expect(dBlack).toBe(-dWhite);
  });

  it('counts a hanging rook as +500 for the side owning the extra rook', () => {
    // FEN 3 has black R d5 and white N d6 → material equal EXCEPT nothing hangs
    // in raw counts; build an explicit asymmetric position instead:
    const b = startingBoard('9/9/9/3r5/9/9/9/K6k1/9 w - - 0 1'); // only black rook extra vs bare kings
    // white king (20000) vs black king (20000) + black rook (500):
    // newIsWhite=true → diff = -(500)
    expect(materialDiff(b, true)).toBe(-500);
    expect(materialDiff(b, false)).toBe(500);
  });

  it('ignores unknown piece codes via ?? 0 without crashing', () => {
    const b = [[99, 0, 0], [0, -6, 0], [0, 0, 6]];
    expect(Number.isFinite(materialDiff(b as unknown as number[][], true))).toBe(true);
  });

  it('values agree with the documented PIECE_VALUE table on a known delta', () => {
    const before = startingBoard();
    // remove a white knight (code 2, value 320): find and clear one
    outer: for (const row of before) {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === 2) { row[c] = 0; break outer; }
      }
    }
    expect(materialDiff(before, true)).toBe(-320);
  });
});
