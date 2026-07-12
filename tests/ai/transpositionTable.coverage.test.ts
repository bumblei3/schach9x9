/**
 * TranspositionTable Branch Coverage Tests
 * Target: 85%+ branch coverage for js/ai/transpositionTable.ts
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TranspositionTable, computeZobristHash } from '../../js/ai/transpositionTable.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  COLOR_WHITE,
  COLOR_BLACK,
} from '../../js/ai/BoardDefinitions.js';

describe('TranspositionTable - Branch Coverage', () => {
  let tt: TranspositionTable;

  beforeEach(() => {
    tt = new TranspositionTable();
    tt.clear();
  });

  // ============================================================
  // computeZobristHash Tests
  // ============================================================

  describe('computeZobristHash', () => {
    test('should return hash for empty board with white to move', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      const hash = computeZobristHash(board, COLOR_WHITE);
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    test('should return hash for empty board with black to move', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      const hash = computeZobristHash(board, COLOR_BLACK);
      expect(typeof hash).toBe('number');
    });

    test('should return hash for empty board without side to move', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      const hash = computeZobristHash(board);
      expect(typeof hash).toBe('number');
    });

    test('should return different hashes for different boards', () => {
      const board1 = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      const board2 = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      board1[0] = 1 | 16; // white pawn at 0
      board2[0] = 1 | 32; // black pawn at 0

      const hash1 = computeZobristHash(board1);
      const hash2 = computeZobristHash(board2);

      expect(hash1).not.toBe(hash2);
    });

    test('should include sideToMove in hash when provided', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      board[0] = 1 | 16; // white pawn at 0

      const hashWhite = computeZobristHash(board, COLOR_WHITE);
      const hashBlack = computeZobristHash(board, COLOR_BLACK);

      expect(hashWhite).not.toBe(hashBlack);
    });

    test('should handle all piece types in hash computation', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);

      // Place all piece types at different squares
      const pieces = [
        { type: 1, color: COLOR_WHITE }, // pawn
        { type: 2, color: COLOR_WHITE }, // knight
        { type: 3, color: COLOR_WHITE }, // bishop
        { type: 4, color: COLOR_WHITE }, // rook
        { type: 5, color: COLOR_WHITE }, // queen
        { type: 6, color: COLOR_WHITE }, // king
        { type: 7, color: COLOR_WHITE }, // archbishop
        { type: 8, color: COLOR_WHITE }, // chancellor
        { type: 9, color: COLOR_WHITE }, // angel
      ];

      pieces.forEach((p, i) => {
        if (i < SQUARE_COUNT) {
          board[i] = p.type | p.color;
        }
      });

      const hash = computeZobristHash(board, COLOR_WHITE);
      expect(typeof hash).toBe('number');
    });

    test('should handle black pieces correctly', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      board[0] = 1 | COLOR_BLACK; // black pawn

      const hash = computeZobristHash(board, COLOR_WHITE);
      expect(typeof hash).toBe('number');
    });

    test('should return same hash for identical boards', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      board[0] = 1 | 16; // white pawn
      board[10] = 1 | 32; // black pawn

      const hash1 = computeZobristHash(board, COLOR_WHITE);
      const hash2 = computeZobristHash(board, COLOR_WHITE);

      expect(hash1).toBe(hash2);
    });
  });

  // ============================================================
  // TranspositionTable.clear() Tests
  // ============================================================

  describe('TranspositionTable.clear()', () => {
    test('should reset all internal arrays', () => {
      // Store something first
      const hash = 12345;
      tt.store(hash, 5, 100, 'exact', null);

      // Clear
      tt.clear();

      // Verify entry count is 0
      expect(tt.size()).toBe(0);

      // Probe should return null
      expect(tt.probe(12345, 1)).toBeNull();
    });

    test('should reset entry count to 0', () => {
      // Add multiple entries
      for (let i = 0; i < 10; i++) {
        tt.store(i * 100, 5, 100, 'exact', null);
      }
      expect(tt.size()).toBeGreaterThan(0);

      tt.clear();
      expect(tt.size()).toBe(0);
    });
  });

  // ============================================================
  // TranspositionTable.probe() Tests
  // ============================================================

  describe('TranspositionTable.probe() - miss cases', () => {
    test('should return null for empty table', () => {
      const result = tt.probe(12345, 1);
      expect(result).toBeNull();
    });

    test('should return null when hash does not match', () => {
      tt.store(100, 5, 100, 'exact', null);
      const result = tt.probe(200, 1); // different hash
      expect(result).toBeNull();
    });

    test('should return null when stored depth is less than requested depth', () => {
      tt.store(100, 3, 100, 'exact', null);
      const result = tt.probe(100, 5); // requesting depth 5, but stored depth 3
      expect(result).toBeNull();
    });

    test('should return entry when depth matches exactly', () => {
      tt.store(100, 5, 100, 'exact', null);
      const result = tt.probe(100, 5);
      expect(result).not.toBeNull();
      expect(result!.depth).toBe(5);
    });

    test('should return entry when stored depth is greater than requested', () => {
      tt.store(100, 7, 100, 'exact', null);
      const result = tt.probe(100, 5); // stored depth 7 > requested 5
      expect(result).not.toBeNull();
      expect(result!.depth).toBe(7);
    });

    test('should return entry with correct flag', () => {
      tt.store(100, 5, 100, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.flag).toBe('exact');

      tt.clear();
      tt.store(200, 5, 50, 'lower', null);
      const result2 = tt.probe(200, 1);
      expect(result2!.flag).toBe('lower');

      tt.clear();
      tt.store(300, 5, -50, 'upper', null);
      const result3 = tt.probe(300, 1);
      expect(result3!.flag).toBe('upper');
    });

    test('should return entry with correct score', () => {
      tt.store(100, 5, 250, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.score).toBe(250);
    });

    test('should return entry with correct depth', () => {
      tt.store(100, 7, 100, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.depth).toBe(7);
    });

    test('should return entry with correct hash', () => {
      const hash = 12345;
      tt.store(hash, 5, 100, 'exact', null);
      const result = tt.probe(hash, 1);
      expect(result!.hash).toBe(hash);
    });

    test('should return null bestMove when none stored', () => {
      tt.store(100, 5, 100, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.bestMove).toBeNull();
    });

    test('should return bestMove when stored', () => {
      const bestMove = { from: 10, to: 20 };
      tt.store(100, 5, 100, 'exact', bestMove);
      const result = tt.probe(100, 1);
      expect(result!.bestMove).toEqual(bestMove);
    });
  });

  // ============================================================
  // TranspositionTable.store() Tests
  // ============================================================

  describe('TranspositionTable.store() - all branches', () => {
    test('should store entry in empty slot', () => {
      tt.store(100, 5, 100, 'exact', null);
      expect(tt.size()).toBe(1);
    });

    test('should increment entry count on first store', () => {
      tt.store(100, 5, 100, 'exact', null);
      expect(tt.size()).toBe(1);
    });

    test('should not increment entry count on same hash replacement', () => {
      tt.store(100, 5, 100, 'exact', null);
      tt.store(100, 5, 100, 'exact', null); // same hash
      expect(tt.size()).toBe(1);
    });

    test('should increment entry count for new hash', () => {
      tt.store(100, 5, 100, 'exact', null);
      tt.store(200, 5, 100, 'exact', null);
      expect(tt.size()).toBe(2);
    });

    test('should replace when depth is greater or equal (depth-preferred)', () => {
      // Store with depth 3
      tt.store(100, 3, 100, 'exact', { from: 1, to: 2 });
      expect(tt.size()).toBe(1);

      // Store with depth 5 (greater) - should replace
      tt.store(100, 5, 200, 'lower', { from: 3, to: 4 });

      const result = tt.probe(100, 1);
      expect(result).not.toBeNull();
      expect(result!.depth).toBe(5);
      expect(result!.score).toBe(200);
    });

    test('should replace when depth is equal', () => {
      tt.store(100, 5, 100, 'exact', { from: 1, to: 2 });

      // Store with same depth - should replace
      tt.store(100, 5, 999, 'upper', { from: 3, to: 4 });

      const result = tt.probe(100, 1);
      expect(result!.score).toBe(999);
      expect(result!.bestMove).toEqual({ from: 3, to: 4 });
    });

    test('should replace when depth is less (same hash always replaces)', () => {
      // Same hash always replaces regardless of depth (per implementation)
      const hash = 0x200007;
      tt.store(hash, 7, 100, 'exact', { from: 1, to: 2 });

      // Even with lower depth, same hash replaces
      tt.store(hash, 3, 999, 'lower', { from: 3, to: 4 });

      const result = tt.probe(hash, 1);
      expect(result!.depth).toBe(3); // replaced with lower depth
      expect(result!.score).toBe(999);
    });

    test('should store with exact flag', () => {
      tt.store(100, 5, 100, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.flag).toBe('exact');
    });

    test('should store with lower flag', () => {
      tt.store(100, 5, 100, 'lower', null);
      const result = tt.probe(100, 1);
      expect(result!.flag).toBe('lower');
    });

    test('should store with upper flag', () => {
      tt.store(100, 5, 100, 'upper', null);
      const result = tt.probe(100, 1);
      expect(result!.flag).toBe('upper');
    });

    test('should store bestMove with from/to', () => {
      const bestMove = { from: 42, to: 52 };
      tt.store(100, 5, 100, 'exact', bestMove);

      const result = tt.probe(100, 1);
      expect(result!.bestMove).toEqual(bestMove);
    });

    test('should handle null bestMove', () => {
      tt.store(100, 5, 100, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.bestMove).toBeNull();
    });

    test('should store negative scores', () => {
      tt.store(100, 5, -500, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result!.score).toBe(-500);
    });

    test('should handle depth 0', () => {
      tt.store(100, 0, 0, 'exact', null);
      const result = tt.probe(100, 0);
      expect(result).not.toBeNull();
      expect(result!.depth).toBe(0);
    });

    test('should handle large hashes', () => {
      // Use a hash that doesn't collide with other tests
      const largeHash = 0x300015;
      tt.store(largeHash, 5, 100, 'exact', null);
      const result = tt.probe(largeHash, 1);
      expect(result).not.toBeNull();
    });

    test('should handle hash index collision (different hashes same index)', () => {
      // TT_MASK is 1<<18 - 1, so hashes with same lower 18 bits collide
      const hash1 = 0x00001;
      const hash2 = 0x40001; // same lower 18 bits

      tt.store(hash1, 5, 100, 'exact', { from: 1, to: 2 });
      tt.store(hash2, 5, 200, 'exact', { from: 3, to: 4 });

      // Second store should replace first (same index, different hash but depth >=)
      const result = tt.probe(hash2, 1);
      // Which one survives depends on replacement logic - depth is equal so replace
      expect(result).not.toBeNull();
    });
  });

  // ============================================================
  // TranspositionTable.size() Tests
  // ============================================================

  describe('TranspositionTable.size()', () => {
    test('should return 0 for empty table', () => {
      expect(tt.size()).toBe(0);
    });

    test('should return correct count after stores', () => {
      tt.store(100, 5, 100, 'exact', null);
      tt.store(200, 5, 100, 'exact', null);
      tt.store(300, 5, 100, 'exact', null);
      expect(tt.size()).toBe(3);
    });

    test('should not count replacements', () => {
      tt.store(100, 5, 100, 'exact', null);
      tt.store(100, 5, 100, 'exact', null); // replacement
      expect(tt.size()).toBe(1);
    });

    test('should return 0 after clear', () => {
      tt.store(100, 5, 100, 'exact', null);
      tt.clear();
      expect(tt.size()).toBe(0);
    });
  });

  // ============================================================
  // Edge Cases & Integration
  // ============================================================

  describe('Edge Cases', () => {
    test('should handle multiple probes without mutations', () => {
      tt.store(100, 5, 100, 'exact', { from: 1, to: 2 });

      const r1 = tt.probe(100, 1);
      const r2 = tt.probe(100, 1);
      const r3 = tt.probe(100, 3);

      expect(r1).toEqual(r2);
      expect(r3).toEqual(r2);
    });

    test('should work with computeZobristHash integration', () => {
      const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
      board[0] = 1 | COLOR_WHITE; // white pawn at 0
      board[10] = 1 | COLOR_BLACK; // black pawn at 10

      const hash = computeZobristHash(board, COLOR_WHITE);
      tt.store(hash, 5, 100, 'exact', null);

      const probed = tt.probe(hash, 1);
      expect(probed).not.toBeNull();
    });

    test('should handle max depth (127 for Int8Array)', () => {
      tt.store(100, 127, 100, 'exact', null);
      const result = tt.probe(100, 1);
      expect(result).not.toBeNull();
      expect(result!.depth).toBe(127);
    });

    test('should not increment counter when depth < stored depth', () => {
      tt.store(100, 10, 100, 'exact', null);
      const initialSize = tt.size();

      tt.store(100, 5, 999, 'lower', null); // should not replace

      expect(tt.size()).toBe(initialSize);
    });
  });
});
