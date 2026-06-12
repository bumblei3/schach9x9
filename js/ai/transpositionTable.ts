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
import { PIECE_TYPE_INDEX } from './BoardDefinitions';
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
      const typeIndex = PIECE_TYPE_INDEX[type];
      if (typeIndex !== -1) {
        const colorIndex = color === COLOR_WHITE ? 0 : 1;
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
 * Transposition Table entry — packed into a compact object.
 * Uses depth-preferred replacement: always replace if new depth >= stored depth.
 */
export interface TTEntry {
  hash: number;       // full 32-bit hash for collision detection
  depth: number;      // search depth
  score: number;      // evaluation score
  flag: 'exact' | 'lower' | 'upper';
  bestMove: Move | null;
}

/**
 * Fixed-size transposition table using Zobrist hash as index.
 * Size: 2^18 = 262144 entries (~4MB with packed entries).
 * Replacement: depth-preferred (replace if new depth >= stored depth, or same slot).
 */
const TT_SIZE = 1 << 18; // 262144 entries
const TT_MASK = TT_SIZE - 1;

// Pre-allocated arrays for cache-friendly access
const ttHashes = new Int32Array(TT_SIZE);
const ttDepths = new Int8Array(TT_SIZE);
const ttScores = new Int32Array(TT_SIZE);
const ttFlags = new Uint8Array(TT_SIZE); // 0=empty, 1=exact, 2=lower, 3=upper
const ttBestFrom = new Uint8Array(TT_SIZE);
const ttBestTo = new Uint8Array(TT_SIZE);
const ttBestMoveValid = new Uint8Array(TT_SIZE); // 0=no best move, 1=valid

let ttEntryCount = 0;

function flagToUint8(f: 'exact' | 'lower' | 'upper'): number {
  return f === 'exact' ? 1 : f === 'lower' ? 2 : 3;
}

function uint8ToFlag(f: number): 'exact' | 'lower' | 'upper' {
  return f === 1 ? 'exact' : f === 2 ? 'lower' : 'upper';
}

export class TranspositionTable {
  clear(): void {
    ttHashes.fill(0);
    ttDepths.fill(0);
    ttScores.fill(0);
    ttFlags.fill(0);
    ttBestMoveValid.fill(0);
    ttEntryCount = 0;
  }

  probe(hash: number, depth: number): TTEntry | null {
    const idx = (hash >>> 0) & TT_MASK;
    if (ttFlags[idx] !== 0 && ttHashes[idx] === hash && ttDepths[idx] >= depth) {
      return {
        hash: ttHashes[idx],
        depth: ttDepths[idx],
        score: ttScores[idx],
        flag: uint8ToFlag(ttFlags[idx]),
        bestMove: ttBestMoveValid[idx] ? { from: ttBestFrom[idx], to: ttBestTo[idx] } : null,
      };
    }
    return null;
  }

  store(hash: number, depth: number, score: number, flag: 'exact' | 'lower' | 'upper', bestMove: Move | null): void {
    const idx = (hash >>> 0) & TT_MASK;
    // Depth-preferred replacement: replace if empty, same hash, or deeper search
    if (ttFlags[idx] === 0 || ttHashes[idx] === hash || depth >= ttDepths[idx]) {
      if (ttFlags[idx] === 0) ttEntryCount++;
      ttHashes[idx] = hash;
      ttDepths[idx] = depth;
      ttScores[idx] = score;
      ttFlags[idx] = flagToUint8(flag);
      if (bestMove) {
        ttBestFrom[idx] = bestMove.from;
        ttBestTo[idx] = bestMove.to;
        ttBestMoveValid[idx] = 1;
      } else {
        ttBestMoveValid[idx] = 0;
      }
    }
  }

  size(): number {
    return ttEntryCount;
  }
}
