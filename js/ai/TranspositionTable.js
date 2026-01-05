import {
  SQUARE_COUNT,
  PIECE_NONE,
  COLOR_WHITE
} from './BoardDefinitions.js';

// Transposition Table Constants
export const TT_EXACT = 0;
export const TT_ALPHA = 1;
export const TT_BETA = 2;

// 128MB Default size (approx 2M entries?)
// Each entry: 
// Key (BigInt64) - 8 bytes
// Move (Int16) - 2 bytes
// Score (Int16) - 2 bytes
// Depth (Int8) - 1 byte
// Flag (Int8) - 1 byte
// Total ~16 bytes/entry + overhead.
// Map adds overhead.
// For JS, Map overhead is significant. 
// We stick to Map for simplicity in this refactor, 
// unless we want to use SharedArrayBuffer for "Real" TT.
// "Grand Refactor" implied Int8Array board.
// Moving TT to SAB is Phase 6. Stick to Map.

const ttDeep = new Map();   // Stores best nodes from deep search (tier 1)
const ttRecent = new Map(); // Stores recent nodes (tier 2), smaller, LRU behaviorgInt?)
// Zobrist Keys (Int32 or BigInt?)
// JS Numbers are doubles (53-bit int). 
// 53 bits is enough for collisions? 2^26 entries. Square root of 2^53.
// 2^26 = 67 Million. Enough for us.
// Or use BigInt (64-bit). BigInt is slower?
// Let's use BigInt for safety.

const ZOBRIST_KEYS = new Array(64); // Safe for color + type bits
const SIDE_TO_MOVE_KEY = randomBigInt();

function randomBigInt() {
  // 64-bit random
  const h = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  const l = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  return (h << 32n) | l;
}

// Initialize Keys
for (let p = 0; p < 64; p++) {
  ZOBRIST_KEYS[p] = new Array(SQUARE_COUNT);
  for (let s = 0; s < SQUARE_COUNT; s++) {
    ZOBRIST_KEYS[p][s] = randomBigInt();
  }
}

// Two-Tier Logic
// Deep = 40%, Recent = 60%
// If user sets max size to N items.
let TT_MAX_SIZE = 1000000;
let TT_DEEP_SIZE = 400000;
let TT_RECENT_SIZE = 600000;
const DEEP_DEPTH_THRESHOLD = 4;

export function computeZobristHash(board, turnColor) {
  let hash = 0n;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = board[i];
    if (piece !== PIECE_NONE) {
      // Bounds check for safety (Int8Array can be negative)
      if (piece >= 0 && piece < 64 && ZOBRIST_KEYS[piece]) {
        hash ^= ZOBRIST_KEYS[piece][i];
      }
    }
  }

  // Side to move
  if (turnColor === 'white' || turnColor === COLOR_WHITE) {
    hash ^= SIDE_TO_MOVE_KEY;
  }

  return hash;
}

export function getXORSideToMove() {
  return SIDE_TO_MOVE_KEY;
}

// Delta Zobrist Helper - Returns the key for a specific piece at a specific square.
// Used for O(1) incremental hash updates.
export function getZobristKey(pieceCode, squareIndex) {
  if (pieceCode === PIECE_NONE || pieceCode < 0 || pieceCode >= 64) return 0n;
  if (squareIndex < 0 || squareIndex >= SQUARE_COUNT) return 0n;
  return ZOBRIST_KEYS[pieceCode][squareIndex];
}

export function storeTT(hash, depth, score, flag, bestMove) {
  // Always store in Recent (MRU)
  if (ttRecent.size >= TT_RECENT_SIZE) {
    ttRecent.delete(ttRecent.keys().next().value); // Evict Oldest
  }
  ttRecent.set(hash, { depth, score, flag, bestMove });

  // Store in Deep if worthy
  if (depth >= DEEP_DEPTH_THRESHOLD) {
    const existing = ttDeep.get(hash);
    if (!existing || depth >= existing.depth) {
      if (ttDeep.size >= TT_DEEP_SIZE && !existing) {
        ttDeep.delete(ttDeep.keys().next().value); // Evict Oldest (FIFO for Deep?)
        // FIFO is bad for Deep. We want to keep BEST.
        // But Map iterates insertion order.
        // If we delete oldest inserted, that's FIFO.
        // Ideally: Evict based on utility?
        // For now, simple FIFO is acceptable for "Deep Bucket protection".
      }
      ttDeep.delete(hash); // Refresh position
      ttDeep.set(hash, { depth, score, flag, bestMove });
    }
  }
}

export function probeTT(hash, depth, alpha, beta) {
  const deepEntry = ttDeep.get(hash);
  const recentEntry = ttRecent.get(hash);

  // Prefer deeper entry
  let entry = recentEntry;
  if (deepEntry && (!recentEntry || deepEntry.depth > recentEntry.depth)) {
    entry = deepEntry;
  }

  if (!entry) return null;

  // Refresh MRU in both?
  if (deepEntry) {
    // Refresh Deep? No, Deep is quality-based.
    // If we access it, it's useful. Maybe refresh?
    // Let's refresh.
    ttDeep.delete(hash);
    ttDeep.set(hash, deepEntry);
  }
  if (recentEntry) {
    ttRecent.delete(hash);
    ttRecent.set(hash, recentEntry);
  }

  if (entry.depth >= depth) {
    if (entry.flag === TT_EXACT) {
      return entry.score;
    }
    if (entry.flag === TT_ALPHA && entry.score <= alpha) {
      return alpha;
    }
    if (entry.flag === TT_BETA && entry.score >= beta) {
      return beta;
    }
  }

  return null; // Hit, but depth too low. Return bestMove hint if caller asked?
  // Caller of probeTT usually gets value check.
  // We should separate "ProbeValue" and "ProbeMove".
  // For now, this returns score if cutoff found.
}

export function getTTMove(hash) {
  const deepEntry = ttDeep.get(hash);
  const recentEntry = ttRecent.get(hash);

  if (deepEntry && (!recentEntry || deepEntry.depth > recentEntry.depth)) {
    return deepEntry.bestMove;
  }
  if (recentEntry) return recentEntry.bestMove;

  return null;
}

export function clearTT() {
  ttDeep.clear();
  ttRecent.clear();
}

export function getTTSize() {
  return ttDeep.size + ttRecent.size;
}

export function setTTMaxSize(size) {
  TT_MAX_SIZE = size;
  TT_DEEP_SIZE = Math.floor(size * 0.4);
  TT_RECENT_SIZE = Math.ceil(size * 0.6);
}

export function getTTStats() {
  return {
    size: getTTSize(),
    maxSize: TT_MAX_SIZE,
    deepSize: ttDeep.size,
    recentSize: ttRecent.size
  };
}

// Compatibility Exports
export const testStoreTT = storeTT;
export const testProbeTT = probeTT;
export function updateZobristHash() { return BigInt(0); } // Stub for legacy import check


