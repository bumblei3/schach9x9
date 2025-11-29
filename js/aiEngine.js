/**
 * Core AI Logic for Schach 9x9
 * Extracted from ai-worker.js for better testing and modularity
 */

import { logger } from './logger.js';
import { BOARD_SIZE, AI_PIECE_VALUES as PIECE_VALUES } from './config.js';

// Position bonus tables (simplified, center control)
const POSITION_BONUS = {
  center: 10,
  extended_center: 5,
  edge: -5,
};

// ========================================
// TRANSPOSITION TABLE & ZOBRIST HASHING
// ========================================

// Zobrist random numbers for hashing
// Initialize Zobrist hashing table
const zobristTable = initializeZobrist();

// Killer Moves: Moves that caused beta cutoffs at each depth
// Format: killerMoves[depth] = [move1, move2]
const killerMoves = new Map();
const MAX_KILLER_MOVES = 2; // Store top 2 killer moves per depth

// History Heuristic: Track which moves have been good historically
// Format: historyTable[piece.type][ from.r][from.c][to.r][to.c] = score
const historyTable = {};

// Initialize history table
function initHistoryTable() {
  const types = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e'];
  for (const type of types) {
    historyTable[type] = [];
    for (let fr = 0; fr < BOARD_SIZE; fr++) {
      historyTable[type][fr] = [];
      for (let fc = 0; fc < BOARD_SIZE; fc++) {
        historyTable[type][fr][fc] = [];
        for (let tr = 0; tr < BOARD_SIZE; tr++) {
          historyTable[type][fr][fc][tr] = new Array(BOARD_SIZE).fill(0);
        }
      }
    }
  }
}
initHistoryTable();

// Clear killer moves and history (between moves)
function clearKillerMoves() {
  killerMoves.clear();
}

function clearHistory() {
  initHistoryTable();
}

// Transposition Table (cache for evaluated positions)
const transpositionTable = new Map();
let TT_MAX_SIZE = 100000; // Maximum entries to prevent memory overflow
let ttHits = 0;
let ttMisses = 0;

export function getTTSize() {
  return transpositionTable.size;
}

export function setTTMaxSize(size) {
  TT_MAX_SIZE = size;
}

export function clearTT() {
  transpositionTable.clear();
}

// Export for testing
export function testStoreTT(hash, depth, score, flag, bestMove) {
  storeTT(hash, depth, score, flag, bestMove);
}

export function testProbeTT(hash, depth, alpha, beta) {
  return probeTT(hash, depth, alpha, beta);
}

// TT Entry types
const TT_EXACT = 0; // Exact score
const TT_ALPHA = 1; // Upper bound (fail-low)
const TT_BETA = 2; // Lower bound (fail-high)

/**
 * Add a killer move for a specific depth
 */
function addKillerMove(depth, move) {
  if (!killerMoves.has(depth)) {
    killerMoves.set(depth, []);
  }

  const killers = killerMoves.get(depth);

  // Check if move already exists in killers
  const exists = killers.some(
    k =>
      k &&
      k.from.r === move.from.r &&
      k.from.c === move.from.c &&
      k.to.r === move.to.r &&
      k.to.c === move.to.c
  );

  if (!exists) {
    // Add to front and keep only top MAX_KILLER_MOVES
    killers.unshift(move);
    if (killers.length > MAX_KILLER_MOVES) {
      killers.pop();
    }
  }
}

/**
 * Update history heuristic for a good move
 */
function updateHistory(piece, move, depth) {
  if (!piece || !historyTable[piece.type]) return;

  // Increase history score based on depth (deeper = more valuable)
  const bonus = depth * depth; // Quadratic bonus
  historyTable[piece.type][move.from.r][move.from.c][move.to.r][move.to.c] += bonus;

  // Cap history values to prevent overflow
  const maxHistory = 10000;
  if (historyTable[piece.type][move.from.r][move.from.c][move.to.r][move.to.c] > maxHistory) {
    historyTable[piece.type][move.from.r][move.from.c][move.to.r][move.to.c] = maxHistory;
  }
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

/**
 * Store position in transposition table
 */
function storeTT(hash, depth, score, flag, bestMove) {
  // Clear old entries if table is full (LRU eviction)
  if (transpositionTable.size >= TT_MAX_SIZE && !transpositionTable.has(hash)) {
    // Delete the oldest entry (first key in Map)
    const oldestKey = transpositionTable.keys().next().value;
    transpositionTable.delete(oldestKey);
  }

  // If the entry already exists, delete it first to update its position to MRU
  if (transpositionTable.has(hash)) {
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
function probeTT(hash, depth, alpha, beta) {
  const entry = transpositionTable.get(hash);

  if (!entry) {
    ttMisses++;
    return null;
  }

  // Only use entry if it was searched to at least the same depth
  if (entry.depth < depth) {
    ttMisses++;
    return null;
  }

  // LRU: Move accessed entry to the end (mark as recently used)
  // We delete and re-set it to update insertion order
  transpositionTable.delete(hash);
  transpositionTable.set(hash, entry);

  ttHits++;

  // Check if we can directly use this score
  if (entry.flag === TT_EXACT) {
    return { score: entry.score, bestMove: entry.bestMove };
  }
  if (entry.flag === TT_ALPHA && entry.score <= alpha) {
    return { score: alpha, bestMove: entry.bestMove };
  }
  if (entry.flag === TT_BETA && entry.score >= beta) {
    return { score: beta, bestMove: entry.bestMove };
  }

  // Can't use score, but we can use the best move for move ordering
  return { bestMove: entry.bestMove };
}

// Progress tracking
let nodesEvaluated = 0;
let currentDepth = 0;
let bestMoveSoFar = null;
let lastProgressUpdate = 0;
let onProgressCallback = null;

export function setProgressCallback(callback) {
  onProgressCallback = callback;
}

// ========================================
// OPENING BOOK
// ========================================

// Opening book (loaded from main thread)
let openingBook = null;

export function setOpeningBook(book) {
  openingBook = book;
}

/**
 * Query opening book for a move
 * Returns a move or null if position not in book
 */
function queryOpeningBook(board, moveNumber) {
  if (!openingBook || !openingBook.positions) {
    return null;
  }

  // Only use book for first 10 moves
  if (moveNumber >= 10) {
    return null;
  }

  const hash = getBoardStringHash(board, moveNumber % 2 === 0 ? 'white' : 'black');

  if (!openingBook.positions[hash]) {
    return null;
  }

  const position = openingBook.positions[hash];
  const moves = position.moves;

  if (!moves || moves.length === 0) {
    return null;
  }

  // Weighted random selection
  const totalWeight = moves.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;

  for (const move of moves) {
    random -= move.weight;
    if (random <= 0) {
      logger.debug(
        `[Opening Book] Selected: ${move.from.r},${move.from.c} -> ${move.to.r},${move.to.c} (${move.weight}%)`
      );
      return { from: move.from, to: move.to };
    }
  }

  // Fallback to first move
  return { from: moves[0].from, to: moves[0].to };
}

/**
 * Generate a simple string hash for the board (must match trainer)
 */
function getBoardStringHash(board, turn) {
  let hash = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      hash += piece ? `${piece.color[0]}${piece.type}` : '..';
    }
  }
  hash += turn[0];
  return hash;
}

/**
 * Get best move using minimax algorithm with iterative deepening
 */
export function getBestMove(board, color, depth, difficulty, moveNumber = 0) {
  try {
    // Check opening book first (only for first 8 moves)
    const bookMove = queryOpeningBook(board, moveNumber);
    if (bookMove) {
      return bookMove;
    }
    // Reset progress tracking
    nodesEvaluated = 0;
    currentDepth = 0;
    bestMoveSoFar = null;
    lastProgressUpdate = Date.now();

    const moves = getAllLegalMoves(board, color);

    if (moves.length === 0) {
      return null;
    }

    // Difficulty-based behavior
    if (difficulty === 'beginner') {
      // Beginner: Very weak, makes many random moves and occasional blunders
      const randomChance = Math.random();

      if (randomChance < 0.85) {
        // 85% completely random move
        return moves[Math.floor(Math.random() * moves.length)];
      } else if (randomChance < 0.95) {
        // 10% chance to deliberately pick a worse move (blunder)
        // Evaluate all moves and pick one with lower score
        const scoredMoves = moves.map(move => ({
          move,
          score: Math.random() - 0.5 // Random score to add variation
        }));
        // Sort by score ascending (worse moves first)
        scoredMoves.sort((a, b) => a.score - b.score);
        // Pick from bottom 30% of moves
        const worstMoves = scoredMoves.slice(0, Math.max(1, Math.floor(moves.length * 0.3)));
        return worstMoves[Math.floor(Math.random() * worstMoves.length)].move;
      }
      // Only 5% use shallow search (depth 1)
      depth = 1;
    } else if (difficulty === 'easy') {
      // Easy: Random with strong capture preference, depth 2
      const captures = moves.filter(
        m => board[m.to.r][m.to.c] && board[m.to.r][m.to.c].color !== color
      );
      if (captures.length > 0 && Math.random() > 0.3) {
        return captures[Math.floor(Math.random() * captures.length)];
      }
      depth = 2;
    }

    // For medium and above: Use iterative deepening
    let bestMove = moves[0];
    bestMoveSoFar = bestMove;

    // Iterative deepening: search from depth 1 up to target depth
    const useIterativeDeepening = difficulty === 'hard' || difficulty === 'expert';
    const startDepth = useIterativeDeepening ? 1 : depth;

    for (let currentSearchDepth = startDepth; currentSearchDepth <= depth; currentSearchDepth++) {
      currentDepth = currentSearchDepth;

      let bestScore = -Infinity;
      let iterationBestMove = moves[0];

      // Send progress info
      sendProgress(depth);

      // Order moves (TT best move is not available at root, so pass null first iteration)
      // But use previous iteration's best move for subsequent iterations
      const ttBestMove = currentSearchDepth > startDepth ? bestMove : null;
      const orderedMoves = orderMoves(board, moves, ttBestMove);

      // Compute initial hash for the root position
      const rootHash = computeZobristHash(board, color);

      for (const move of orderedMoves) {
        // Pass rootHash to minimax, which will incrementally update it for the move
        const score = minimax(
          board,
          move,
          currentSearchDepth - 1,
          false,
          -Infinity,
          Infinity,
          color,
          rootHash
        );
        if (score > bestScore) {
          bestScore = score;
          iterationBestMove = move;
        }
      }

      // Update best move found so far
      bestMove = iterationBestMove;
      bestMoveSoFar = bestMove;

      // Send progress update after completing this depth
      sendProgress(depth);
    }

    // Log TT statistics
    const ttTotal = ttHits + ttMisses;
    const hitRate = ttTotal > 0 ? ((ttHits / ttTotal) * 100).toFixed(1) : 0;
    logger.info(
      `[AI Worker] TT Hit Rate: ${hitRate}% (${ttHits}/${ttTotal}), Nodes: ${nodesEvaluated}`
    );

    return bestMove;
  } catch (error) {
    logger.error('[AI Worker] Error in getBestMove:', error);
    // Fallback: return a random legal move
    const moves = getAllLegalMoves(board, color);
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
  }
}

/**
 * Send progress update to main thread
 */
function sendProgress(maxDepth) {
  if (!onProgressCallback) return;

  const now = Date.now();
  // Throttle updates to every 100ms
  if (now - lastProgressUpdate < 100) return;

  lastProgressUpdate = now;
  onProgressCallback({
    depth: currentDepth,
    maxDepth: maxDepth,
    nodes: nodesEvaluated,
    bestMove: bestMoveSoFar,
  });
}

/**
 * Minimax algorithm with alpha-beta pruning and transposition table
 */
/**
 * Apply a move to the board and return undo information
 */
function makeMove(board, move) {
  const fromPiece = board[move.from.r][move.from.c];
  const capturedPiece = board[move.to.r][move.to.c];

  const undoInfo = {
    capturedPiece,
    oldHasMoved: fromPiece ? fromPiece.hasMoved : false,
    move
  };

  board[move.to.r][move.to.c] = fromPiece;
  board[move.from.r][move.from.c] = null;

  if (fromPiece) {
    fromPiece.hasMoved = true;
  }

  return undoInfo;
}

/**
 * Undo a move
 */
function undoMove(board, undoInfo) {
  const { move, capturedPiece, oldHasMoved } = undoInfo;
  const piece = board[move.to.r][move.to.c];

  if (piece) {
    piece.hasMoved = oldHasMoved;
  }

  board[move.from.r][move.from.c] = piece;
  board[move.to.r][move.to.c] = capturedPiece;
}

/**
 * Minimax algorithm with alpha-beta pruning and transposition table
 */
function minimax(board, move, depth, isMaximizing, alpha, beta, aiColor, parentHash) {
  // Track evaluated nodes
  nodesEvaluated++;

  // Send progress update periodically
  if (nodesEvaluated % 100 === 0) {
    const now = Date.now();
    if (now - lastProgressUpdate >= 100) {
      sendProgress(currentDepth);
    }
  }

  const fromPiece = board[move.from.r][move.from.c]; // Get piece from original board
  const capturedPiece = board[move.to.r][move.to.c]; // Get captured piece from original board

  // INCREMENTAL HASH UPDATE
  let hash = parentHash;

  // 1. Toggle side to move
  hash ^= zobristTable.sideToMove;

  // 2. Remove moving piece from source
  if (fromPiece) {
    hash ^= zobristTable[fromPiece.color][fromPiece.type][move.from.r][move.from.c];
  }

  // 3. Add moving piece to destination
  if (fromPiece) {
    hash ^= zobristTable[fromPiece.color][fromPiece.type][move.to.r][move.to.c];
  }

  // 4. If capture, remove captured piece
  if (capturedPiece) {
    hash ^= zobristTable[capturedPiece.color][capturedPiece.type][move.to.r][move.to.c];
  }

  // Probe transposition table
  const ttEntry = probeTT(hash, depth, alpha, beta);
  if (ttEntry && ttEntry.score !== undefined) {
    return ttEntry.score;
  }

  // Apply move
  const undoInfo = makeMove(board, move);

  let score;
  let bestMove = null;
  let flag = TT_ALPHA; // Default: upper bound

  if (depth === 0) {
    // Use quiescence search at leaf nodes
    score = quiescenceSearch(board, alpha, beta, isMaximizing, aiColor);
    flag = TT_EXACT;
  } else {
    const color = isMaximizing ? aiColor : aiColor === 'white' ? 'black' : 'white';
    const moves = getAllLegalMoves(board, color);

    if (moves.length === 0) {
      // Game over
      score = isMaximizing ? -10000 : 10000;
      flag = TT_EXACT;
    } else if (isMaximizing) {
      score = -Infinity;
      // Order moves with TT best move hint and current depth
      const ttBestMove = ttEntry ? ttEntry.bestMove : null;
      const orderedMoves = orderMoves(board, moves, ttBestMove, depth);

      for (const nextMove of orderedMoves) {
        const moveScore = minimax(board, nextMove, depth - 1, false, alpha, beta, aiColor, hash);
        if (moveScore > score) {
          score = moveScore;
          bestMove = nextMove;
        }
        alpha = Math.max(alpha, score);
        if (beta <= alpha) {
          // Beta cutoff - store as killer move (if not a capture)
          if (!capturedPiece) {
            addKillerMove(depth, nextMove);
          }
          // Update history heuristic
          updateHistory(board[nextMove.from.r][nextMove.from.c], nextMove, depth);
          flag = TT_BETA; // Lower bound (fail-high)
          break;
        }
      }
      if (beta > alpha) {
        flag = TT_EXACT; // Exact score
      }
    } else {
      score = Infinity;
      // Order moves with TT best move hint and current depth
      const ttBestMove = ttEntry ? ttEntry.bestMove : null;
      const orderedMoves = orderMoves(board, moves, ttBestMove, depth);

      for (const nextMove of orderedMoves) {
        const moveScore = minimax(board, nextMove, depth - 1, true, alpha, beta, aiColor, hash);
        if (moveScore < score) {
          score = moveScore;
          bestMove = nextMove;
        }
        beta = Math.min(beta, score);
        if (beta <= alpha) {
          // Beta cutoff - store as killer move (if not a capture)
          if (!capturedPiece) {
            addKillerMove(depth, nextMove);
          }
          // Update history heuristic
          updateHistory(board[nextMove.from.r][nextMove.from.c], nextMove, depth);
          flag = TT_BETA; // Lower bound (fail-high)
          break;
        }
      }
      if (beta > alpha) {
        flag = TT_EXACT; // Exact score
      }
    }
  }

  // Undo move
  undoMove(board, undoInfo);

  // Store in transposition table
  storeTT(hash, depth, score, flag, bestMove);

  return score;
}

/**
 * Quiescence search to avoid horizon effect
 */
/**
 * Quiescence search to avoid horizon effect
 */
function quiescenceSearch(board, alpha, beta, isMaximizing, aiColor) {
  nodesEvaluated++;
  const standPat = evaluatePosition(board, aiColor);

  if (isMaximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }

  // Find all capture moves
  const color = isMaximizing ? aiColor : aiColor === 'white' ? 'black' : 'white';
  const captureMoves = getAllCaptureMoves(board, color);

  if (isMaximizing) {
    for (const move of captureMoves) {
      const undoInfo = makeMove(board, move);

      const score = quiescenceSearch(board, alpha, beta, false, aiColor);

      undoMove(board, undoInfo);

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    for (const move of captureMoves) {
      const undoInfo = makeMove(board, move);

      const score = quiescenceSearch(board, alpha, beta, true, aiColor);

      undoMove(board, undoInfo);

      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

/**
 * Evaluate board position with advanced heuristics
 */
export function evaluatePosition(board, forColor) {
  let score = 0;

  // Material and position score
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const pieceValue = PIECE_VALUES[piece.type] || 0;
      const positionBonus = getPositionBonus(r, c, piece.type);
      let totalValue = pieceValue + positionBonus;

      // King Safety: Bonus for pawns around king
      if (piece.type === 'k') {
        totalValue += evaluateKingSafety(board, r, c, piece.color);
      }

      // Mobility bonus (simplified - count pseudo-legal moves)
      if (piece.type !== 'p' && piece.type !== 'k') {
        const mobility = countMobility(board, r, c, piece);
        totalValue += mobility * 2; // Small bonus for mobility
      }

      if (piece.color === forColor) {
        score += totalValue;
      } else {
        score -= totalValue;
      }
    }
  }

  // Pawn structure evaluation
  score += evaluatePawnStructure(board, forColor);

  return score;
}

/**
 * Evaluate king safety based on surrounding pawns
 */
function evaluateKingSafety(board, kingR, kingC, kingColor) {
  let safety = 0;
  const pawnRow = kingColor === 'white' ? 1 : -1;

  // Check for pawn shield in front of king
  for (let dc = -1; dc <= 1; dc++) {
    const checkR = kingR + pawnRow;
    const checkC = kingC + dc;

    if (checkR >= 0 && checkR < BOARD_SIZE && checkC >= 0 && checkC < BOARD_SIZE) {
      const piece = board[checkR][checkC];
      if (piece && piece.type === 'p' && piece.color === kingColor) {
        safety += 15; // Bonus for pawn shield
      }
    }
  }

  return safety;
}

/**
 * Evaluate pawn structure (doubled pawns, isolated pawns)
 */
function evaluatePawnStructure(board, forColor) {
  let score = 0;
  const pawnColumns = { white: {}, black: {} };

  // Count pawns per column
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'p') {
        if (!pawnColumns[piece.color][c]) {
          pawnColumns[piece.color][c] = 0;
        }
        pawnColumns[piece.color][c]++;
      }
    }
  }

  // Penalize doubled pawns
  for (const color in pawnColumns) {
    for (const col in pawnColumns[color]) {
      if (pawnColumns[color][col] > 1) {
        const penalty = (pawnColumns[color][col] - 1) * 10;
        if (color === forColor) {
          score -= penalty;
        } else {
          score += penalty;
        }
      }
    }
  }

  return score;
}

/**
 * Get position bonus for piece placement
 */
function getPositionBonus(r, c, type) {
  // Center squares (3,3), (3,4), (3,5), (4,3), (4,4), (4,5), (5,3), (5,4), (5,5)
  const isCenterSquare = r >= 3 && r <= 5 && c >= 3 && c <= 5;
  const isExtendedCenter = r >= 2 && r <= 6 && c >= 2 && c <= 6;
  const isEdge = r === 0 || r === BOARD_SIZE - 1 || c === 0 || c === BOARD_SIZE - 1;

  if (type === 'k') return 0; // King doesn't care about center in midgame

  if (isCenterSquare) return POSITION_BONUS.center;
  if (isExtendedCenter) return POSITION_BONUS.extended_center;
  if (isEdge && (type === 'n' || type === 'b')) return POSITION_BONUS.edge;

  return 0;
}

/**
 * Order moves for better alpha-beta pruning
 * Priority: 1) TT best move, 2) Captures (MVV-LVA), 3) Killer moves, 4) History heuristic
 */
function orderMoves(board, moves, ttBestMove, depth = 0) {
  const scoredMoves = moves.map(move => {
    let score = 0;
    const fromPiece = board[move.from.r][move.from.c];

    // 1. TT move gets highest priority
    if (
      ttBestMove &&
      move.from.r === ttBestMove.from.r &&
      move.from.c === ttBestMove.from.c &&
      move.to.r === ttBestMove.to.r &&
      move.to.c === ttBestMove.to.c
    ) {
      score += 10000;
    }

    // 2. MVV-LVA: Most Valuable Victim - Least Valuable Attacker
    const targetPiece = board[move.to.r][move.to.c];
    if (targetPiece) {
      const victimValue = PIECE_VALUES[targetPiece.type] || 0;
      const attackerValue = PIECE_VALUES[fromPiece.type] || 0;
      score += victimValue * 10 - attackerValue / 10;
    }

    // 3. Killer moves (non-capture moves that caused beta cutoffs)
    const killers = killerMoves.get(depth) || [];
    for (let i = 0; i < killers.length; i++) {
      const killer = killers[i];
      if (
        killer &&
        move.from.r === killer.from.r &&
        move.from.c === killer.from.c &&
        move.to.r === killer.to.r &&
        move.to.c === killer.to.c
      ) {
        score += 900 - i * 100; // First killer gets 900, second gets 800
        break;
      }
    }

    // 4. History heuristic
    if (fromPiece && historyTable[fromPiece.type]) {
      const historyScore =
        historyTable[fromPiece.type][move.from.r][move.from.c][move.to.r][move.to.c] || 0;
      score += historyScore / 100; // Scale down history score
    }

    return { move, score };
  });

  // Sort by score (highest first)
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves.map(sm => sm.move);
}

/**
 * Get all legal moves for a color (validating checks)
 */
export function getAllLegalMoves(board, color) {
  const moves = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const pieceMoves = getPseudoLegalMoves(board, r, c, piece);

        // Filter out moves that leave king in check
        for (const move of pieceMoves) {
          // Apply move temporarily
          const targetPiece = board[move.to.r][move.to.c];
          board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
          board[move.from.r][move.from.c] = null;

          if (!isInCheck(board, color)) {
            moves.push(move);
          }

          // Undo move
          board[move.from.r][move.from.c] = board[move.to.r][move.to.c];
          board[move.to.r][move.to.c] = targetPiece;
        }
      }
    }
  }

  return moves;
}

/**
 * Check if a color is in check
 */
function isInCheck(board, color) {
  // Find King
  let kingPos = null;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        kingPos = { r, c };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return false; // Should not happen (king captured?)

  const opponentColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, kingPos.r, kingPos.c, opponentColor);
}

/**
 * Check if a square is attacked by a specific color
 */
const KNIGHT_MOVES = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const DIAGONAL_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHOGONAL_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const KING_DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

const ATTACK_DIRECTIONS = [
  { dr: -1, dc: -1, types: ['b', 'q', 'a', 'e'] }, // Diagonals
  { dr: -1, dc: 1, types: ['b', 'q', 'a', 'e'] },
  { dr: 1, dc: -1, types: ['b', 'q', 'a', 'e'] },
  { dr: 1, dc: 1, types: ['b', 'q', 'a', 'e'] },
  { dr: -1, dc: 0, types: ['r', 'q', 'c', 'e'] }, // Orthogonals
  { dr: 1, dc: 0, types: ['r', 'q', 'c', 'e'] },
  { dr: 0, dc: -1, types: ['r', 'q', 'c', 'e'] },
  { dr: 0, dc: 1, types: ['r', 'q', 'c', 'e'] },
];

/**
 * Check if a square is attacked by a specific color
 */
function isSquareAttacked(board, r, c, attackerColor) {
  const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

  // 1. Pawn attacks
  // If attacker is white, they attack from bottom (r+1). If black, from top (r-1).
  // We check if there is a pawn at (r+1, c±1) for white attacker, etc.
  const pawnRow = attackerColor === 'white' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = r + pawnRow;
    const pc = c + dc;
    if (isInside(pr, pc)) {
      const piece = board[pr][pc];
      if (piece && piece.color === attackerColor && piece.type === 'p') return true;
    }
  }

  // 2. Knight attacks
  for (const [dr, dc] of KNIGHT_MOVES) {
    const nr = r + dr;
    const nc = c + dc;
    if (isInside(nr, nc)) {
      const piece = board[nr][nc];
      if (
        piece &&
        piece.color === attackerColor &&
        (piece.type === 'n' || piece.type === 'a' || piece.type === 'c' || piece.type === 'e')
      ) {
        return true; // Knight, Archbishop, Chancellor, Angel
      }
    }
  }

  // 3. Sliding pieces (Bishop/Rook/Queen/Archbishop/Chancellor/Angel)
  for (const { dr, dc, types } of ATTACK_DIRECTIONS) {
    let nr = r + dr;
    let nc = c + dc;
    while (isInside(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor && types.includes(piece.type)) {
          return true;
        }
        if (
          piece.color === attackerColor &&
          piece.type === 'k' &&
          Math.abs(nr - r) <= 1 &&
          Math.abs(nc - c) <= 1
        ) {
          return true; // King attack
        }
        break; // Blocked
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

/**
 * Get pseudo-legal moves for a piece (ignoring check)
 */
/**
 * Get pseudo-legal moves for a piece (ignoring check)
 */
function getPseudoLegalMoves(board, r, c, piece, onlyCaptures = false) {
  const moves = [];
  const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  const isEnemy = (r, c) => board[r][c] && board[r][c].color !== piece.color;
  const isEmpty = (r, c) => !board[r][c];

  if (piece.type === 'p') {
    const forward = piece.color === 'white' ? -1 : 1;
    // Move 1
    if (!onlyCaptures && isInside(r + forward, c) && isEmpty(r + forward, c)) {
      moves.push({ from: { r, c }, to: { r: r + forward, c } });
      // Move 2 (if not moved)
      if (piece.hasMoved === false && isInside(r + forward * 2, c) && isEmpty(r + forward * 2, c)) {
        moves.push({ from: { r, c }, to: { r: r + forward * 2, c } });
      }
    }
    // Capture
    for (const dc of [-1, 1]) {
      if (isInside(r + forward, c + dc) && isEnemy(r + forward, c + dc)) {
        moves.push({ from: { r, c }, to: { r: r + forward, c: c + dc } });
      }
    }
  } else {
    // Other pieces
    const directions = [];
    if (['b', 'q', 'a', 'k', 'e'].includes(piece.type)) {
      directions.push(...DIAGONAL_DIRS);
    }
    if (['r', 'q', 'c', 'k', 'e'].includes(piece.type)) {
      directions.push(...ORTHOGONAL_DIRS);
    }

    // Knight jumps
    if (['n', 'a', 'c', 'e'].includes(piece.type)) {
      for (const [dr, dc] of KNIGHT_MOVES) {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc)) {
          if (isEnemy(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          } else if (!onlyCaptures && isEmpty(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          }
        }
      }
    }

    // Sliding moves
    if (['b', 'r', 'q', 'a', 'c', 'e'].includes(piece.type)) {
      const slidingDirs = [];
      if (['b', 'q', 'a', 'e'].includes(piece.type)) slidingDirs.push(...DIAGONAL_DIRS);
      if (['r', 'q', 'c', 'e'].includes(piece.type)) slidingDirs.push(...ORTHOGONAL_DIRS);

      for (const [dr, dc] of slidingDirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (isInside(nr, nc)) {
          if (isEmpty(nr, nc)) {
            if (!onlyCaptures) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            }
          } else {
            if (isEnemy(nr, nc)) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    // King single steps
    if (piece.type === 'k') {
      for (const [dr, dc] of KING_DIRS) {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc)) {
          if (isEnemy(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          } else if (!onlyCaptures && isEmpty(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          }
        }
      }
    }
  }

  return moves;
}

/**
 * Get all capture moves for a color (validating checks)
 */
function getAllCaptureMoves(board, color) {
  const moves = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const pieceMoves = getPseudoLegalMoves(board, r, c, piece, true); // onlyCaptures = true

        for (const move of pieceMoves) {
          const undoInfo = makeMove(board, move);

          if (!isInCheck(board, color)) {
            moves.push(move);
          }

          undoMove(board, undoInfo);
        }
      }
    }
  }

  return moves;
}



/**
 * Count pseudo-legal moves for mobility bonus (optimized, no object creation)
 */
function countMobility(board, r, c, piece) {
  let count = 0;
  const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  const isEnemy = (r, c) => board[r][c] && board[r][c].color !== piece.color;
  const isEmpty = (r, c) => !board[r][c];

  // Knight jumps (N, A, C, E)
  if (['n', 'a', 'c', 'e'].includes(piece.type)) {
    for (const [dr, dc] of KNIGHT_MOVES) {
      const nr = r + dr, nc = c + dc;
      if (isInside(nr, nc) && (isEmpty(nr, nc) || isEnemy(nr, nc))) {
        count++;
      }
    }
  }

  // Sliding moves
  if (['b', 'r', 'q', 'a', 'c', 'e'].includes(piece.type)) {
    const slidingDirs = [];
    if (['b', 'q', 'a', 'e'].includes(piece.type)) // Diagonals
      slidingDirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    if (['r', 'q', 'c', 'e'].includes(piece.type)) // Orthogonals
      slidingDirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

    for (const [dr, dc] of slidingDirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (isInside(nr, nc)) {
        if (isEmpty(nr, nc)) {
          count++;
        } else {
          if (isEnemy(nr, nc)) {
            count++;
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  return count;
}
