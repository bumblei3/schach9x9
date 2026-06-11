// Transposition Table with Zobrist hashing for Schach 9x9 AI
// Generates random numbers for each piece type, color, and square.
// Uses a fixed seed for deterministic behavior across runs.

import {
  SQUARE_COUNT,
  PIECE_NONE,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_CHANCELLOR,
  PIECE_ANGEL,
  TYPE_MASK,
  COLOR_MASK,
  COLOR_WHITE,
  COLOR_BLACK,
} from './BoardDefinitions';
import type { Move } from './MoveGenerator';

// Number of piece types (excluding NONE) * 2 colors + maybe for en passant/castling later
const PIECE_TYPES = [
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_CHANCELLOR,
  PIECE_ANGEL,
];
const PIECE_TYPE_COUNT = PIECE_TYPES.length; // 9
const COLOR_COUNT = 2; // white, black

// Zobrist table: [square][pieceIndex][color] -> random 32-bit int
let zobristTable: number[][][] = [];

// Side to move random value
let sideToMoveValue: number = 0;

// Castling rights not implemented in current board representation (no castling rights stored)
// If needed later, extend.

/**
 * Initialize Zobrist random numbers with a fixed seed for reproducibility.
 * Called once at module load.
 */
function initZobrist(): void {
  const seed = 0x12345678;
  let rand = seed;

  // xorshift32 generator
  function nextRand(): number {
    rand ^= rand << 13;
    rand ^= rand >>> 15;
    rand ^= rand << 12;
    return rand >>> 0; // unsigned 32-bit
  }

  // Initialize table
  zobristTable = new Array(SQUARE_COUNT);
  for (let sq = 0; sq < SQUARE_COUNT; sq++) {
    zobristTable[sq] = new Array(PIECE_TYPE_COUNT);
    for (let pt = 0; pt < PIECE_TYPE_COUNT; pt++) {
      zobristTable[sq][pt] = new Array(COLOR_COUNT);
      for (let col = 0; col < COLOR_COUNT; col++) {
        zobristTable[sq][pt][col] = nextRand();
      }
    }
  }
  sideToMoveValue = nextRand();
}

// Initialize on load
initZobrist();

/**
 * Compute Zobrist hash for a given board and optionally side to move.
 * @param board Int8Array board representation (0 for empty, piece encoded)
 * @param sideToMove COLOR_WHITE or COLOR_BLACK; if undefined, side is not included in hash
 * @returns 32-bit signed hash
 */
export function computeZobristHash(board: Int8Array, sideToMove?: number): number {
  let h = 0;
  for (let sq = 0; sq < SQUARE_COUNT; sq++) {
    const piece = board[sq];
    if (piece !== PIECE_NONE) {
      const type = piece & TYPE_MASK;
      const color = piece & COLOR_MASK;
      // find index of type in PIECE_TYPES
      let typeIndex = -1;
      for (let i = 0; i < PIECE_TYPES.length; i++) {
        if (PIECE_TYPES[i] === type) {
          typeIndex = i;
          break;
        }
      }
      if (typeIndex !== -1) {
        const colorIndex = color === COLOR_WHITE ? 0 : 1; // 0 for white, 1 for black
        h ^= zobristTable[sq][typeIndex][colorIndex];
      }
    }
  }
  // XOR side to move if provided
  if (sideToMove !== undefined) {
    if (sideToMove === COLOR_BLACK) {
      h ^= sideToMoveValue;
    }
  }
  // Return as signed 32-bit to match previous behavior
  return h | 0;
}

/**
 * Transposition Table entry interface (same as existing TTEntry)
 */
export interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMove: Move | null;
}

/**
 * Simple TT using Map<number, TTEntry> (as existing code)
 */
export class TranspositionTable {
  private tt: Map<number, TTEntry> = new Map();

  clear(): void {
    this.tt.clear();
  }

  probe(hash: number, depth: number): TTEntry | null {
    const entry = this.tt.get(hash);
    if (entry && entry.depth >= depth) {
      return entry;
    }
    return null;
  }

  store(hash: number, depth: number, score: number, flag: 'exact' | 'lower' | 'upper', bestMove: Move | null): void {
    // Always store if deeper or not present
    const existing = this.tt.get(hash);
    if (!existing || depth > existing.depth) {
      this.tt.set(hash, { depth, score, flag, bestMove });
    }
  }

  size(): number {
    return this.tt.size;
  }
}
