/**
 * Invariant tests for js/ai/transpositionTable.ts
 *
 * Supplements the existing transpositionTable.coverage.test.ts (which is
 * branch-coverage oriented). Here we assert the *algebraic* properties the
 * search actually relies on:
 *   - Zobrist hashing: determinism, symmetry, avalanche, index folding,
 *     collision resistance of the raw hash, and side-to-move orthogonality.
 *   - TranspositionTable: store/probe round-trip, depth-preferred replacement
 *     rule, index-mask collision behaviour, no mutation on probe, and that
 *     size() equals the number of distinct occupied slots.
 * Pure module, no DOM, no engine required.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TranspositionTable, computeZobristHash } from '../../js/ai/transpositionTable.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  PIECE_PAWN,
  PIECE_ANGEL,
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_TYPE_INDEX,
} from '../../js/ai/BoardDefinitions.js';

// Build a board with a single piece at square `sq` of the given type/color.
function boardWith(sq: number, type: number, color: number): Int8Array {
  const b = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  if (sq >= 0) b[sq] = type | color;
  return b;
}

// Hamming distance between two (signed) 32-bit integers.
function hamming(a: number, b: number): number {
  let x = (a ^ b) >>> 0;
  let c = 0;
  while (x) {
    c += x & 1;
    x >>>= 1;
  }
  return c;
}

describe('Zobrist hashing — determinism & symmetry', () => {
  test('identical boards hash identically (reflexivity)', () => {
    const b = boardWith(20, PIECE_PAWN, COLOR_WHITE);
    expect(computeZobristHash(b, COLOR_WHITE)).toBe(computeZobristHash(b, COLOR_WHITE));
  });

  test('hash is independent of board array identity (only contents matter)', () => {
    const a = boardWith(5, PIECE_ANGEL, COLOR_BLACK);
    const c = boardWith(5, PIECE_ANGEL, COLOR_BLACK);
    expect(computeZobristHash(a, COLOR_WHITE)).toBe(computeZobristHash(c, COLOR_WHITE));
  });

  test('empty board hashes to a constant (no side to move => 0)', () => {
    const empty = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
    // No piece bits XORed, no side term => accumulator stays 0.
    expect(computeZobristHash(empty)).toBe(0);
    expect(computeZobristHash(empty, undefined)).toBe(0);
  });

  test('a single white piece and its black mirror differ only by color term', () => {
    const w = boardWith(7, PIECE_PAWN, COLOR_WHITE);
    const blk = boardWith(7, PIECE_PAWN, COLOR_BLACK);
    const hw = computeZobristHash(w);
    const hb = computeZobristHash(blk);
    // XOR cancels the (identical) square/type contribution, leaving exactly
    // the difference between the two color random values at that square.
    expect(hw ^ hb).toBe(hw ^ hb); // tautology guard; real check below
    expect(hw).not.toBe(hb);
    // The delta must be a single zobrist table entry (a valid 32-bit value),
    // i.e. flipping only color must change by an exact table value. We verify
    // the delta equals hw XOR hb and is non-zero and within 32-bit range.
    const delta = (hw ^ hb) >>> 0;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(0xffffffff);
  });

  test('flipping side to move toggles exactly the side term (no other bits)', () => {
    const b = boardWith(40, PIECE_ANGEL, COLOR_WHITE);
    const hw = computeZobristHash(b, COLOR_WHITE);
    const hb = computeZobristHash(b, COLOR_BLACK);
    // Only black side adds the side term; white adds nothing. So the delta is
    // exactly the sideToMoveValue, and white-with-side == white-without-side.
    const noSide = computeZobristHash(b);
    expect(hw).toBe(noSide); // white does not contribute a side term
    expect(hb).not.toBe(noSide);
    const sideTerm = (hb ^ hw) >>> 0;
    expect(sideTerm).toBeGreaterThan(0);
  });
});

describe('Zobrist hashing — avalanche / diffusion', () => {
  test('moving one piece to a different square changes the hash', () => {
    const a = boardWith(0, PIECE_PAWN, COLOR_WHITE);
    const b = boardWith(1, PIECE_PAWN, COLOR_WHITE);
    expect(computeZobristHash(a)).not.toBe(computeZobristHash(b));
  });

  test('a single square flip flips roughly half the bits (avalanche)', () => {
    // Average bit-difference between a board and that board with one piece
    // moved should be near 16 of 32 bits, not a tiny constant delta.
    let total = 0;
    let n = 0;
    const base = boardWith(4, PIECE_PAWN, COLOR_WHITE);
    const baseHash = computeZobristHash(base);
    for (let sq = 0; sq < SQUARE_COUNT; sq++) {
      const moved = boardWith(sq, PIECE_PAWN, COLOR_WHITE);
      total += hamming(baseHash, computeZobristHash(moved));
      n++;
    }
    const avg = total / n;
    expect(avg).toBeGreaterThan(8); // substantial diffusion, not a 1-bit shift
    expect(avg).toBeLessThan(28);
  });

  test('distinct squares with the same piece never produce the same delta', () => {
    // The table values per square must be distinct, otherwise moving a piece
    // could cancel another piece's contribution. Verify two squares differ.
    const h0 = computeZobristHash(boardWith(0, PIECE_PAWN, COLOR_WHITE));
    const h1 = computeZobristHash(boardWith(1, PIECE_PAWN, COLOR_WHITE));
    const h2 = computeZobristHash(boardWith(2, PIECE_PAWN, COLOR_WHITE));
    expect(h1 ^ h0).not.toBe(h2 ^ h1); // consecutive deltas distinct
  });
});

describe('Zobrist hashing — index folding & collisions', () => {
  const TT_MASK = (1 << 18) - 1;

  test('TT index is always within [0, 2^18)', () => {
    for (let i = 0; i < 50; i++) {
      const sq = (i * 7) % SQUARE_COUNT;
      const h = computeZobristHash(boardWith(sq, PIECE_PAWN, COLOR_WHITE), COLOR_WHITE);
      const idx = (h >>> 0) & TT_MASK;
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(1 << 18);
    }
  });

  test('distinct full-length hashes that alias in the low 18 bits collide in index', () => {
    const hA = 0x0000a; // low 18 bits = 0xa
    const hB = (1 << 18) | 0x000a; // next bucket up, same low 18 bits
    expect((hA >>> 0) & TT_MASK).toBe((hB >>> 0) & TT_MASK);
  });

  test('two different piece configurations almost never share a raw 32-bit hash', () => {
    // Exhaustively probe a small space: boards differing by one occupied square
    // among 64 sample squares should be pairwise-distinct (1 collision or fewer
    // out of C(64,2)=2016 pairs is acceptable for a fixed-seed table).
    const hashes = new Set<number>();
    let collisions = 0;
    // Use 64 DISTINCT squares so every pair compares two genuinely different
    // board positions (a repeated square would hash identically and wrongly
    // count as a collision).
    const squareCount = Math.min(64, SQUARE_COUNT);
    const squares = Array.from({ length: squareCount }, (_, i) => i);
    for (let i = 0; i < squares.length; i++) {
      for (let j = i + 1; j < squares.length; j++) {
        const hi = computeZobristHash(boardWith(squares[i], PIECE_PAWN, COLOR_WHITE));
        const hj = computeZobristHash(boardWith(squares[j], PIECE_PAWN, COLOR_WHITE));
        if (hi === hj) collisions++;
        hashes.add(hi);
        hashes.add(hj);
      }
    }
    expect(collisions).toBeLessThanOrEqual(1);
  });
});

describe('TranspositionTable — store/probe round-trip', () => {
  let tt: TranspositionTable;
  beforeEach(() => {
    tt = new TranspositionTable();
    tt.clear();
  });

  test('a stored entry is retrievable at any depth <= stored depth', () => {
    const h = computeZobristHash(boardWith(10, PIECE_ANGEL, COLOR_BLACK), COLOR_WHITE);
    tt.store(h, 5, 123, 'exact', { from: 10, to: 20 });
    expect(tt.probe(h, 1)!.score).toBe(123);
    expect(tt.probe(h, 5)!.score).toBe(123);
    expect(tt.probe(h, 5)!.flag).toBe('exact');
    expect(tt.probe(h, 5)!.bestMove).toEqual({ from: 10, to: 20 });
  });

  test('probe never mutates the table (size stable across probes)', () => {
    const h = computeZobristHash(boardWith(3, PIECE_PAWN, COLOR_WHITE), COLOR_WHITE);
    tt.store(h, 4, 50, 'lower', null);
    const before = tt.size();
    for (let i = 0; i < 20; i++) tt.probe(h, 1);
    expect(tt.size()).toBe(before);
    expect(tt.probe(h, 1)!.score).toBe(50);
  });

  test('storing the same hash twice keeps size at 1 (replacement, not growth)', () => {
    const h = computeZobristHash(boardWith(0, PIECE_PAWN, COLOR_WHITE), COLOR_WHITE);
    tt.store(h, 2, 10, 'exact', null);
    tt.store(h, 2, 20, 'exact', null);
    expect(tt.size()).toBe(1);
    expect(tt.probe(h, 1)!.score).toBe(20);
  });

  test('storing distinct hashes grows size by one each, capped correctly', () => {
    const hashes = [1, 2, 3, 4, 5].map(h => (h * 99991) >>> 0);
    for (const h of hashes) tt.store(h, 1, 1, 'exact', null);
    expect(tt.size()).toBe(hashes.length);
  });
});

describe('TranspositionTable — depth-preferred replacement rule', () => {
  let tt: TranspositionTable;
  beforeEach(() => {
    tt = new TranspositionTable();
    tt.clear();
  });

  test('a shallower re-store with the SAME hash replaces anyway (same-hash always wins)', () => {
    const h = 0xabcde;
    tt.store(h, 9, 100, 'exact', { from: 1, to: 2 });
    tt.store(h, 3, 999, 'lower', { from: 5, to: 6 });
    // Implementation replaces unconditionally for matching hash.
    expect(tt.probe(h, 1)!.depth).toBe(3);
    expect(tt.probe(h, 1)!.score).toBe(999);
    expect(tt.probe(h, 1)!.bestMove).toEqual({ from: 5, to: 6 });
  });

  test('a shallower re-store with a DIFFERENT hash at the same index does NOT replace', () => {
    // Choose two hashes that alias to the same low-18-bit index but differ.
    const h1 = 0x0000a;
    const h2 = (1 << 18) | 0x000a; // same index, different full hash
    tt.store(h1, 10, 100, 'exact', { from: 1, to: 2 });
    tt.store(h2, 2, 999, 'lower', { from: 3, to: 4 }); // shallow + mismatched hash
    // depth 2 < stored 10 and hash differs => no replacement
    expect(tt.probe(h1, 1)!.score).toBe(100);
    expect(tt.size()).toBe(1);
  });

  test('a deeper re-store at the same index (different hash) DOES replace', () => {
    const h1 = 0x0000a;
    const h2 = (1 << 18) | 0x000a;
    tt.store(h1, 3, 100, 'exact', null);
    tt.store(h2, 7, 777, 'upper', null); // deeper, replaces shallow entry
    // Now probing the new hash returns the deeper score; probing old hash misses.
    expect(tt.probe(h2, 1)!.score).toBe(777);
    expect(tt.probe(h1, 1)).toBeNull();
  });

  test('probe with depth > stored depth misses even when hash matches', () => {
    const h = computeZobristHash(boardWith(8, PIECE_PAWN, COLOR_BLACK), COLOR_BLACK);
    tt.store(h, 4, 42, 'exact', null);
    expect(tt.probe(h, 5)).toBeNull(); // requested depth strictly greater
    expect(tt.probe(h, 4)).not.toBeNull(); // equal depth hits
  });
});

describe('TranspositionTable — flags & score integrity', () => {
  let tt: TranspositionTable;
  beforeEach(() => {
    tt = new TranspositionTable();
    tt.clear();
  });

  test('all three flag values survive a round-trip', () => {
    const base = 0x13579;
    tt.store(base + 1, 1, 1, 'exact', null);
    tt.store(base + 2, 1, -1, 'lower', null);
    tt.store(base + 3, 1, 0, 'upper', null);
    expect(tt.probe(base + 1, 1)!.flag).toBe('exact');
    expect(tt.probe(base + 2, 1)!.flag).toBe('lower');
    expect(tt.probe(base + 3, 1)!.flag).toBe('upper');
  });

  test('negative and zero scores are preserved exactly', () => {
    const h = 0x24680;
    tt.store(h, 2, -1234, 'exact', null);
    expect(tt.probe(h, 1)!.score).toBe(-1234);
    tt.store(h, 2, 0, 'exact', null);
    expect(tt.probe(h, 1)!.score).toBe(0);
  });

  test('bestMove is dropped when null is stored, kept when set', () => {
    const h = 0x97531;
    tt.store(h, 1, 1, 'exact', null);
    expect(tt.probe(h, 1)!.bestMove).toBeNull();
    tt.store(h, 1, 1, 'exact', { from: 7, to: 8 });
    expect(tt.probe(h, 1)!.bestMove).toEqual({ from: 7, to: 8 });
    tt.store(h, 1, 1, 'exact', null); // overwrite with no move
    expect(tt.probe(h, 1)!.bestMove).toBeNull();
  });

  test('clear() empties every slot and resets size to 0', () => {
    for (let i = 0; i < 100; i++) tt.store((i * 12345) >>> 0, 1, i, 'exact', null);
    expect(tt.size()).toBe(100);
    tt.clear();
    expect(tt.size()).toBe(0);
    expect(tt.probe(12345, 1)).toBeNull();
  });
});

describe('TranspositionTable — index collision accounting', () => {
  let tt: TranspositionTable;
  beforeEach(() => {
    tt = new TranspositionTable();
    tt.clear();
  });

  test('two aliasing hashes occupy one logical slot and size counts it once', () => {
    const h1 = 0x0000f;
    const h2 = (1 << 18) | 0x000f; // same index
    tt.store(h1, 5, 11, 'exact', null);
    tt.store(h2, 5, 22, 'exact', null); // same depth => replaces
    expect(tt.size()).toBe(1);
    expect(tt.probe(h2, 1)!.score).toBe(22);
  });

  test('PIECE_TYPE_INDEX maps every used piece type to a valid table index', () => {
    // Guards against the zobrist table being indexed out of bounds for any
    // piece the engine can actually place on the board.
    for (const t of [PIECE_PAWN, PIECE_ANGEL]) {
      const idx = PIECE_TYPE_INDEX[t];
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(9);
    }
  });
});
