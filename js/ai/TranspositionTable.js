import { BOARD_SIZE } from '../config.js';

// TT Entry types
export const TT_EXACT = 0; // Exact score
export const TT_ALPHA = 1; // Upper bound (fail-low)
export const TT_BETA = 2; // Lower bound (fail-high)

// Transposition Table (cache for evaluated positions)
const transpositionTable = new Map();
let TT_MAX_SIZE = 100000; // Maximum entries to prevent memory overflow
let ttHits = 0;
let ttMisses = 0;

// Zobrist hashing table
const zobristTable = initializeZobrist();

export function getTTSize() {
  return transpositionTable.size;
}

export function setTTMaxSize(size) {
  TT_MAX_SIZE = size;
}

export function clearTT() {
  transpositionTable.clear();
  ttHits = 0;
  ttMisses = 0;
}

export function getTTStats() {
  return { hits: ttHits, misses: ttMisses, size: transpositionTable.size };
}

/**
 * Initialize Zobrist hashing table
 * Each piece type, color, and position gets a random 32-bit number
 */
function initializeZobrist() {
  const table = {};
  const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e'];
  const colors = ['white', 'black'];

  // Simple pseudo-random number generator (seeded for consistency)
  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (const color of colors) {
    table[color] = {};
    for (const type of pieceTypes) {
      table[color][type] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        table[color][type][r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          // Generate random 32-bit integer
          table[color][type][r][c] = Math.floor(random() * 0xffffffff);
        }
      }
    }
  }

  // Side to move (white/black)
  table.sideToMove = Math.floor(random() * 0xffffffff);

  return table;
}

/**
 * Compute Zobrist hash for a board position
 */
export function computeZobristHash(board, colorToMove) {
  let hash = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece) {
        hash ^= zobristTable[piece.color][piece.type][r][c];
      }
    }
  }

  // Include side to move
  if (colorToMove === 'white') {
    hash ^= zobristTable.sideToMove;
  }

  return hash;
}

export function getZobristTable() {
  return zobristTable;
}

/**
 * Store position in transposition table
 */
export function storeTT(hash, depth, score, flag, bestMove) {
  const existing = transpositionTable.get(hash);

  // Depth-preferred replacement: only replace if the new entry is searched at least as deep
  if (existing && existing.depth > depth) {
    return;
  }

  // Clear oldest entry if table is full (LRU eviction via Map insertion order)
  if (!existing && transpositionTable.size >= TT_MAX_SIZE) {
    const oldestKey = transpositionTable.keys().next().value;
    transpositionTable.delete(oldestKey);
  }

  // Update entry (re-setting moves it to MRU position in Map)
  if (existing) {
    transpositionTable.delete(hash);
  }

  transpositionTable.set(hash, {
    depth,
    score,
    flag,
    bestMove,
  });
}

/**
 * Probe transposition table
 */
export function probeTT(hash, depth, alpha, beta) {
  const entry = transpositionTable.get(hash);

  if (!entry) {
    ttMisses++;
    return null;
  }

  // Update entry position to MRU
  transpositionTable.delete(hash);
  transpositionTable.set(hash, entry);

  ttHits++;

  // Always return the bestMove found so far as a hint for move ordering,
  // even if the depth is insufficient for a score cutoff.
  const result = { bestMove: entry.bestMove };

  // Only use score if it was searched to at least the same depth
  if (entry.depth >= depth) {
    if (entry.flag === TT_EXACT) {
      result.score = entry.score;
    } else if (entry.flag === TT_ALPHA && entry.score <= alpha) {
      result.score = alpha;
    } else if (entry.flag === TT_BETA && entry.score >= beta) {
      result.score = beta;
    }
  }

  return result;
}

// Export for testing
export function testStoreTT(hash, depth, score, flag, bestMove) {
  storeTT(hash, depth, score, flag, bestMove);
}

export function testProbeTT(hash, depth, alpha, beta) {
  return probeTT(hash, depth, alpha, beta);
}
