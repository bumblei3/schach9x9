// Transposition Table with 64-bit Zobrist hashing for Schach 9x9 AI
// Generates random numbers for each piece type, color, and square.
// Uses a fixed seed for deterministic behavior across runs.
//
// M1.3: hashes are 64-bit (two 32-bit halves) to make collisions
// negligible at 2^20 table entries. The old 32-bit hash collided often
// enough to measurably corrupt search results.

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

/** A 64-bit hash split into two unsigned 32-bit halves. */
export interface Hash64 {
  low: number;
  high: number;
}

// Zobrist table: [square][pieceIndex][color] -> random 64-bit value
let zobristTable: [number, number][][][] = [];

// Side to move random value
let sideToMoveValue: [number, number] = [0, 0];

// Castling rights: 4 independent keys (WK, WQ, BK, BQ)
let castlingWKValue: [number, number] = [0, 0];
let castlingWQValue: [number, number] = [0, 0];
let castlingBKValue: [number, number] = [0, 0];
let castlingBQValue: [number, number] = [0, 0];

// En passant: 1 key (file where EP is possible, or a generic key)
let enPassantValue: [number, number] = [0, 0];

/**
 * Initialize Zobrist random numbers with a fixed seed for reproducibility.
 * Called once at module load.
 */
function initZobrist(): void {
  const seed = 0x12345678;
  let rand = seed;

  // xorshift32 generator
  function nextRand(): [number, number] {
    rand ^= rand << 13;
    rand ^= rand >>> 15;
    rand ^= rand << 12;
    const low = rand >>> 0; // unsigned 32-bit
    // Second half: run the generator again for an independent value
    rand ^= rand << 13;
    rand ^= rand >>> 15;
    rand ^= rand << 12;
    const high = rand >>> 0;
    return [low, high];
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

  // Castling rights and EP keys
  castlingWKValue = nextRand();
  castlingWQValue = nextRand();
  castlingBKValue = nextRand();
  castlingBQValue = nextRand();
  enPassantValue = nextRand();
}

// Initialize on load
initZobrist();

// Exported for incremental hash updates in search.ts (M1.1, M1.2, M1.3)
export {
  zobristTable,
  sideToMoveValue,
  castlingWKValue,
  castlingWQValue,
  castlingBKValue,
  castlingBQValue,
  enPassantValue,
};

/**
 * Compute Zobrist hash for a given board and optionally side to move.
 * @param board Int8Array board representation (0 for empty, piece encoded)
 * @param sideToMove COLOR_WHITE or COLOR_BLACK; if undefined, side is not included in hash
 * @returns 64-bit hash as { low, high }
 */
export function computeZobristHash(
  board: Int8Array,
  sideToMove?: number,
  castlingRights?: { wk: boolean; wq: boolean; bk: boolean; bq: boolean },
  epFile?: number | null
): Hash64 {
  let low = 0;
  let high = 0;
  for (let sq = 0; sq < SQUARE_COUNT; sq++) {
    const piece = board[sq];
    if (piece !== PIECE_NONE) {
      const type = piece & TYPE_MASK;
      const color = piece & COLOR_MASK;
      const typeIndex = PIECE_TYPE_INDEX[type];
      if (typeIndex !== -1) {
        const colorIndex = color === COLOR_WHITE ? 0 : 1;
        const [zl, zh] = zobristTable[sq][typeIndex][colorIndex];
        low ^= zl;
        high ^= zh;
      }
    }
  }
  // XOR side to move if provided
  if (sideToMove !== undefined) {
    if (sideToMove === COLOR_BLACK) {
      low ^= sideToMoveValue[0];
      high ^= sideToMoveValue[1];
    }
  }
  // XOR castling rights if provided
  if (castlingRights) {
    if (castlingRights.wk) { low ^= castlingWKValue[0]; high ^= castlingWKValue[1]; }
    if (castlingRights.wq) { low ^= castlingWQValue[0]; high ^= castlingWQValue[1]; }
    if (castlingRights.bk) { low ^= castlingBKValue[0]; high ^= castlingBKValue[1]; }
    if (castlingRights.bq) { low ^= castlingBQValue[0]; high ^= castlingBQValue[1]; }
  }
  // XOR en passant file if provided
  if (epFile !== null && epFile !== undefined) {
    low ^= enPassantValue[0];
    high ^= enPassantValue[1];
  }
  return { low, high };
}

/**
 * Transposition Table entry — packed into a compact object.
 * Uses depth-preferred replacement: always replace if new depth >= stored depth.
 */
export interface TTEntry {
  hash: Hash64; // full 64-bit hash for collision detection
  depth: number; // search depth
  score: number; // evaluation score
  flag: 'exact' | 'lower' | 'upper';
  bestMove: Move | null;
}

/**
 * Fixed-size transposition table using Zobrist hash as index.
 * Size: 2^20 = 1048576 entries (~16MB with packed entries).
 * Replacement: depth-preferred (replace if new depth >= stored depth, or same slot).
 */
const TT_SIZE = 1 << 20; // 1048576 entries (~16MB with packed entries; raised 1<<18->1<<20 for fewer collisions at depth)
const TT_MASK = TT_SIZE - 1;

// Pre-allocated arrays for cache-friendly access — 64-bit hashes split into two Int32Arrays
const ttHashLow = new Int32Array(TT_SIZE);
const ttHashHigh = new Int32Array(TT_SIZE);
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
    ttHashLow.fill(0);
    ttHashHigh.fill(0);
    ttDepths.fill(0);
    ttScores.fill(0);
    ttFlags.fill(0);
    ttBestMoveValid.fill(0);
    ttEntryCount = 0;
  }

  probe(hashLow: number, hashHigh: number, depth: number): TTEntry | null {
    const idx = (hashLow >>> 0) & TT_MASK;
    if (
      ttFlags[idx] !== 0 &&
      ttHashLow[idx] === hashLow &&
      ttHashHigh[idx] === hashHigh &&
      ttDepths[idx] >= depth
    ) {
      return {
        hash: { low: ttHashLow[idx], high: ttHashHigh[idx] },
        depth: ttDepths[idx],
        score: ttScores[idx],
        flag: uint8ToFlag(ttFlags[idx]),
        bestMove: ttBestMoveValid[idx] ? { from: ttBestFrom[idx], to: ttBestTo[idx] } : null,
      };
    }
    return null;
  }

  store(
    hashLow: number,
    hashHigh: number,
    depth: number,
    score: number,
    flag: 'exact' | 'lower' | 'upper',
    bestMove: Move | null
  ): void {
    const idx = (hashLow >>> 0) & TT_MASK;
    // Depth-preferred replacement: replace if empty, same hash, or deeper search
    if (
      ttFlags[idx] === 0 ||
      (ttHashLow[idx] === hashLow && ttHashHigh[idx] === hashHigh) ||
      depth >= ttDepths[idx]
    ) {
      if (ttFlags[idx] === 0) ttEntryCount++;
      ttHashLow[idx] = hashLow;
      ttHashHigh[idx] = hashHigh;
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
