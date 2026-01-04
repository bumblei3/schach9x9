import { BOARD_SIZE } from '../config.js';

// TT Entry types
export const TT_EXACT = 0; // Exact score
export const TT_ALPHA = 1; // Upper bound (fail-low)
export const TT_BETA = 2; // Lower bound (fail-high)

// Two-Tier Transposition Table
// ttDeep: Stores high-depth (valuable) positions. Replacement strategy: Depth-preferred.
// ttRecent: Stores recent positions. Replacement strategy: Always replace (MRU).
const ttDeep = new Map();
const ttRecent = new Map();

let TT_MAX_SIZE = 100000;
let TT_DEEP_SIZE = 40000; // 40% for deep entries
let TT_RECENT_SIZE = 60000; // 60% for recent entries

// Threshold to be considered "Deep"
const DEEP_DEPTH_THRESHOLD = 4;

let ttHits = 0;
let ttMisses = 0;

// Zobrist hashing table
const zobristTable = initializeZobrist();

export function getTTSize() {
  return ttDeep.size + ttRecent.size;
}

export function setTTMaxSize(size) {
  TT_MAX_SIZE = size;
  TT_DEEP_SIZE = Math.floor(size * 0.4);
  TT_RECENT_SIZE = Math.floor(size * 0.6);
}

export function clearTT() {
  ttDeep.clear();
  ttRecent.clear();
  ttHits = 0;
  ttMisses = 0;
}

export function getTTStats() {
  return {
    hits: ttHits,
    misses: ttMisses,
    deepSize: ttDeep.size,
    recentSize: ttRecent.size
  };
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
  const size = board.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
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

/**
 * Incrementally update Zobrist hash for a move
 */
export function updateZobristHash(hash, from, to, piece, capturedPiece = null, undoInfo = null) {
  let newHash = hash;

  // 1. Remove piece from 'from' square
  // If it was a promotion, the piece.type reflects the NEW type.
  // We need to use the OLD type for the 'from' square.
  const oldType = undoInfo && undoInfo.promoted ? undoInfo.oldType : piece.type;
  newHash ^= zobristTable[piece.color][oldType][from.r][from.c];

  // 2. Remove captured piece if any
  if (capturedPiece) {
    newHash ^= zobristTable[capturedPiece.color][capturedPiece.type][to.r][to.c];
  }

  // 3. Handle Special Moves
  if (undoInfo) {
    if (undoInfo.enPassantCaptured) {
      const { enPassantRow, enPassantCol, enPassantCaptured } = undoInfo;
      // Remove captured pawn (it's not on the 'to' square)
      newHash ^=
        zobristTable[enPassantCaptured.color][enPassantCaptured.type][enPassantRow][enPassantCol];
    } else if (undoInfo.castling) {
      const { rook, rookFrom, rookTo } = undoInfo.castling;
      // Move rook: XOR from old position, XOR to new position
      newHash ^= zobristTable[piece.color][rook.type][rookFrom.r][rookFrom.c];
      newHash ^= zobristTable[piece.color][rook.type][rookTo.r][rookTo.c];
    } else if (undoInfo.promoted) {
      // Place promoted piece on 'to' square
      newHash ^= zobristTable[piece.color][piece.type][to.r][to.c];
      // Flip side to move and return
      newHash ^= zobristTable.sideToMove;
      return newHash;
    }
  }

  // 4. Place piece on 'to' square (if not already handled in promotion)
  if (!undoInfo || !undoInfo.promoted) {
    newHash ^= zobristTable[piece.color][piece.type][to.r][to.c];
  }

  // 5. Flip side to move
  newHash ^= zobristTable.sideToMove;

  return newHash;
}

export function getZobristTable() {
  return zobristTable;
}

export function getXORSideToMove() {
  return zobristTable.sideToMove;
}

/**
 * Store position in transposition table
 */
/**
 * Store position in transposition table
 */
export function storeTT(hash, depth, score, flag, bestMove) {
  const entry = {
    depth,
    score,
    flag,
    bestMove,
  };

  // 1. Store in Recent Table (Always Replace strategy)
  // This ensures we always have the latest path, avoiding cycles/stale data in short term
  if (ttRecent.has(hash)) {
    ttRecent.delete(hash); // Refresh MRU
  }
  ttRecent.set(hash, entry);

  // Evict if Recent full
  if (ttRecent.size > TT_RECENT_SIZE) {
    const oldestKey = ttRecent.keys().next().value;
    ttRecent.delete(oldestKey);
  }

  // 2. Store in Deep Table (Depth-Preferred strategy)
  // Only if depth is significant
  if (depth >= DEEP_DEPTH_THRESHOLD) {
    const existingDeep = ttDeep.get(hash);

    // Only replace if new depth is equal or better
    if (!existingDeep || depth >= existingDeep.depth) {
      if (existingDeep) {
        ttDeep.delete(hash); // Refresh MRU
      }
      ttDeep.set(hash, entry);

      // Evict if Deep full
      if (ttDeep.size > TT_DEEP_SIZE) {
        const oldestKey = ttDeep.keys().next().value;
        ttDeep.delete(oldestKey);
      }
    }
  }
}

/**
 * Probe transposition table
 */
export function probeTT(hash, depth, alpha, beta) {
  const deepEntry = ttDeep.get(hash);
  const recentEntry = ttRecent.get(hash);

  // Choose the best entry (highest depth)
  let entry = null;
  if (deepEntry && recentEntry) {
    entry = deepEntry.depth >= recentEntry.depth ? deepEntry : recentEntry;
  } else {
    entry = deepEntry || recentEntry;
  }

  if (!entry) {
    ttMisses++;
    return null;
  }

  // Refresh MRU in their respective tables
  if (deepEntry) {
    ttDeep.delete(hash);
    ttDeep.set(hash, deepEntry);
  }
  if (recentEntry) {
    ttRecent.delete(hash);
    ttRecent.set(hash, recentEntry);
  }

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
