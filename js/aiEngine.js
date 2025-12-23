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
  const existing = transpositionTable.get(hash);

  // Depth-preferred replacement: only replace if the new entry is searched at least as deep
  if (existing && existing.depth > depth) {
    // We could potentially update the bestMove even if shallower, but usually deeper is better
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
function probeTT(hash, depth, alpha, beta) {
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
    let previousIterationScore = 0;

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

      let alpha = -Infinity;
      let beta = Infinity;

      // ASPIRATION WINDOWS
      // Only use aspiration windows if we have a previous score (depth > 1)
      if (currentSearchDepth > startDepth && Math.abs(previousIterationScore) < 5000) { // Don't use window if mate score
        alpha = previousIterationScore - 50; // Window size 50
        beta = previousIterationScore + 50;
      }

      // Root Search Loop
      // We might need to re-search if we fail low or high
      while (true) {
        let currentAlpha = alpha;
        let currentBestScore = -Infinity;
        let currentBestMove = moves[0];

        for (const move of orderedMoves) {
          const score = minimax(
            board,
            move,
            currentSearchDepth - 1,
            false,
            currentAlpha,
            beta,
            color,
            rootHash
          );

          if (score > currentBestScore) {
            currentBestScore = score;
            currentBestMove = move;
          }
          // Update alpha for PVS/Alpha-Beta at root
          if (score > currentAlpha) {
            currentAlpha = score;
          }
        }

        // Check for Fail Low (score <= alpha)
        if (currentBestScore <= alpha) {
          alpha = -Infinity;
          continue; // Re-search with full open alpha
        }
        // Check for Fail High (score >= beta)
        if (currentBestScore >= beta) {
          beta = Infinity;
          continue; // Re-search with full open beta
        }

        // Success - within window
        bestScore = currentBestScore;
        iterationBestMove = currentBestMove;
        break;
      }

      previousIterationScore = bestScore;

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

    // Strip the score property used for move ordering before returning
    if (bestMove && bestMove._score !== undefined) {
      delete bestMove._score;
    }

    return bestMove;
  } catch (error) {
    logger.error('[AI Worker] Error in getBestMove:', error);
    // Fallback: return a random legal move
    const moves = getAllLegalMoves(board, color);
    if (moves.length > 0) {
      const move = moves[Math.floor(Math.random() * moves.length)];
      if (move._score !== undefined) delete move._score;
      return move;
    }
    return null;
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
const MAX_PLY = 64; // Max depth
const undoStack = new Array(MAX_PLY).fill(null).map(() => ({
  capturedPiece: null,
  oldHasMoved: false,
  move: null
}));

/**
 * Apply a move to the board and return undo information
 */
/**
 * Apply a move to the board and return undo information
 */
function makeMove(board, move) {
  if (move === null) return null;

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
  if (undoInfo === null) return;

  const { move, capturedPiece, oldHasMoved } = undoInfo;
  const piece = board[move.to.r][move.to.c];

  if (piece) {
    piece.hasMoved = oldHasMoved;
  }

  board[move.from.r][move.from.c] = piece;
  board[move.to.r][move.to.c] = capturedPiece;
}

/**
 * Check if the side has major pieces (to avoid Zugzwang in endgames)
 */
function hasMajorPieces(board, color) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        if (piece.type !== 'p' && piece.type !== 'k') {
          return true;
        }
      }
    }
  }
  return false;
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

  const fromPiece = move ? board[move.from.r][move.from.c] : null; // Get piece from original board
  const capturedPiece = move ? board[move.to.r][move.to.c] : null; // Get captured piece from original board

  // INCREMENTAL HASH UPDATE
  let hash = parentHash;

  // 1. Toggle side to move
  hash ^= zobristTable.sideToMove;

  if (move) {
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
    // NULL MOVE PRUNING
    const color = isMaximizing ? aiColor : aiColor === 'white' ? 'black' : 'white';

    // Conditions: depth >= 3, not a null move itself, not in check, has pieces
    if (depth >= 3 && move !== null && !isInCheck(board, color) && hasMajorPieces(board, color)) {
      const R = 2;
      // Search with reduced depth, passing null to skip move application
      // Passing null means we pass the turn to the other side (!isMaximizing)
      const nullScore = minimax(board, null, depth - 1 - R, !isMaximizing, alpha, beta, aiColor, hash);

      if (isMaximizing) {
        if (nullScore >= beta) {
          undoMove(board, undoInfo);
          return beta; // Cutoff
        }
      } else {
        if (nullScore <= alpha) {
          undoMove(board, undoInfo);
          return alpha; // Cutoff
        }
      }
    }

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

      for (let i = 0; i < orderedMoves.length; i++) {
        const nextMove = orderedMoves[i];
        let moveScore;

        // LATE MOVE REDUCTION (LMR)
        // If depth is high enough, and we search later moves, and it's not a capture (heuristically)
        // Note: We check capture by looking at the target square on the board
        const isCapture = board[nextMove.to.r][nextMove.to.c] !== null;

        if (depth >= 3 && i >= 4 && !isCapture) {
          // Reduce depth by 1 (effective depth - 2)
          moveScore = minimax(board, nextMove, depth - 2, false, alpha, beta, aiColor, hash);

          // If the move turns out to be good (beats alpha), re-search at full depth
          if (moveScore > alpha) {
            moveScore = minimax(board, nextMove, depth - 1, false, alpha, beta, aiColor, hash);
          }
        } else {
          // Normal search
          moveScore = minimax(board, nextMove, depth - 1, false, alpha, beta, aiColor, hash);
        }

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

      for (let i = 0; i < orderedMoves.length; i++) {
        const nextMove = orderedMoves[i];
        let moveScore;

        // LATE MOVE REDUCTION (LMR)
        const isCapture = board[nextMove.to.r][nextMove.to.c] !== null;

        if (depth >= 3 && i >= 4 && !isCapture) {
          moveScore = minimax(board, nextMove, depth - 2, true, alpha, beta, aiColor, hash);

          if (moveScore < beta) { // For minimizing, "good" means < beta (potentially updating beta)
            moveScore = minimax(board, nextMove, depth - 1, true, alpha, beta, aiColor, hash);
          }
        } else {
          moveScore = minimax(board, nextMove, depth - 1, true, alpha, beta, aiColor, hash);
        }

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
const pawnColumnsWhite = new Int8Array(BOARD_SIZE);
const pawnColumnsBlack = new Int8Array(BOARD_SIZE);

export function evaluatePosition(board, forColor) {
  let score = 0;
  // Reset static arrays
  pawnColumnsWhite.fill(0);
  pawnColumnsBlack.fill(0);

  // Single pass board iteration
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const pieceValue = PIECE_VALUES[piece.type] || 0;
      const positionBonus = getPositionBonus(r, c, piece.type);
      let totalValue = pieceValue + positionBonus;

      // King Safety
      if (piece.type === 'k') {
        totalValue += evaluateKingSafety(board, r, c, piece.color);
      }

      // Mobility bonus
      if (piece.type !== 'p' && piece.type !== 'k') {
        const mobility = countMobility(board, r, c, piece);
        totalValue += mobility * 2;
      }

      // Record pawn for structure eval
      if (piece.type === 'p') {
        if (piece.color === 'white') {
          pawnColumnsWhite[c]++;
        } else {
          pawnColumnsBlack[c]++;
        }
      }

      if (piece.color === forColor) {
        score += totalValue;
      } else {
        score -= totalValue;
      }
    }
  }

  // Apply pawn structure penalties efficiently
  for (let c = 0; c < BOARD_SIZE; c++) {
    // White
    if (pawnColumnsWhite[c] > 1) {
      const penalty = (pawnColumnsWhite[c] - 1) * 10;
      if (forColor === 'white') score -= penalty; else score += penalty;
    }
    // Black
    if (pawnColumnsBlack[c] > 1) {
      const penalty = (pawnColumnsBlack[c] - 1) * 10;
      if (forColor === 'black') score -= penalty; else score += penalty;
    }
  }

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
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    let score = 0;
    const fromPiece = board[move.from.r][move.from.c];
    if (!fromPiece) continue;

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
    } else {
      // 3. Killer moves (non-capture moves that caused beta cutoffs)
      const killers = killerMoves.get(depth);
      if (killers) {
        // Optimized check for MAX_KILLER_MOVES = 2
        const k0 = killers[0];
        if (k0 && move.from.r === k0.from.r && move.from.c === k0.from.c && move.to.r === k0.to.r && move.to.c === k0.to.c) {
          score += 900;
        } else {
          const k1 = killers[1];
          if (k1 && move.from.r === k1.from.r && move.from.c === k1.from.c && move.to.r === k1.to.r && move.to.c === k1.to.c) {
            score += 800;
          }
        }
      }

      // 4. History heuristic
      if (historyTable[fromPiece.type]) {
        const historyValue = historyTable[fromPiece.type][move.from.r][move.from.c][move.to.r][move.to.c];
        if (historyValue > 0) {
          score += historyValue / 100;
        }
      }
    }

    move._score = score;
  }

  // Sort by score (highest first)
  moves.sort((a, b) => (b._score || 0) - (a._score || 0));

  return moves;
}

/**
 * Get all legal moves for a color (validating checks)
 */
export function getAllLegalMoves(board, color) {
  const moves = [];
  const kingPos = findKing(board, color);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const pieceMoves = getPseudoLegalMoves(board, r, c, piece);

        // Filter out moves that leave king in check
        for (let i = 0; i < pieceMoves.length; i++) {
          const move = pieceMoves[i];
          // Apply move temporarily
          const fromPiece = board[move.from.r][move.from.c];
          const targetPiece = board[move.to.r][move.to.c];
          board[move.to.r][move.to.c] = fromPiece;
          board[move.from.r][move.from.c] = null;

          // If king moves, pass the new position
          const currentKingPos = fromPiece.type === 'k' ? { r: move.to.r, c: move.to.c } : kingPos;

          if (!isInCheck(board, color, currentKingPos)) {
            moves.push(move);
          }

          // Undo move
          board[move.from.r][move.from.c] = fromPiece;
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
/**
 * Check if a color is in check
 */
export function isInCheck(board, color, knownKingPos) {
  const kingPos = knownKingPos || findKing(board, color);
  if (!kingPos) return false;

  const opponentColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, kingPos.r, kingPos.c, opponentColor);
}

/**
 * Find the king for a specific color
 */
function findKing(board, color) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        return { r, c };
      }
    }
  }
  return null;
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
 * Static lookup tables for move generation
 */
const PIECE_SLIDING_DIRS = {
  b: DIAGONAL_DIRS,
  r: ORTHOGONAL_DIRS,
  q: [...DIAGONAL_DIRS, ...ORTHOGONAL_DIRS],
  a: DIAGONAL_DIRS,
  c: ORTHOGONAL_DIRS,
  e: [...DIAGONAL_DIRS, ...ORTHOGONAL_DIRS]
};

const PIECE_STEPPING_DIRS = {
  n: KNIGHT_MOVES, // Knight
  k: KING_DIRS,    // King
  a: KNIGHT_MOVES, // Archbishop (N+B)
  c: KNIGHT_MOVES, // Chancellor (N+R)
  e: KNIGHT_MOVES  // Angel (Q+N)
};

/**
 * Check if a square is attacked by a specific color
 */
const PIECE_ATTACKS_DIAGONALLY = { b: true, q: true, a: true, e: true };
const PIECE_ATTACKS_ORTHOGONALLY = { r: true, q: true, c: true, e: true };

/**
 * Check if a square is attacked by a specific color
 */
function isSquareAttacked(board, r, c, attackerColor) {
  // 1. Pawn attacks
  const pawnRow = attackerColor === 'white' ? 1 : -1;
  const pr = r + pawnRow;
  if (pr >= 0 && pr < BOARD_SIZE) {
    if (c > 0) {
      const piece = board[pr][c - 1];
      if (piece && piece.type === 'p' && piece.color === attackerColor) return true;
    }
    if (c < BOARD_SIZE - 1) {
      const piece = board[pr][c + 1];
      if (piece && piece.type === 'p' && piece.color === attackerColor) return true;
    }
  }

  // 2. Knight attacks (Knight, Archbishop, Chancellor, Angel)
  // Use unrolled loop for speed
  for (let i = 0; i < 8; i++) {
    const move = KNIGHT_MOVES[i];
    const nr = r + move[0];
    const nc = c + move[1];
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      const piece = board[nr][nc];
      if (piece && piece.color === attackerColor) {
        const t = piece.type;
        if (t === 'n' || t === 'a' || t === 'c' || t === 'e') return true;
      }
    }
  }

  // 3. Sliding pieces (Bishop/Rook/Queen/Archbishop/Chancellor/Angel)
  // and King attack (distance 1)

  // Diagonal
  for (let i = 0; i < 4; i++) {
    const dir = DIAGONAL_DIRS[i];
    let nr = r + dir[0];
    let nc = c + dir[1];

    // King check
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor) {
          if (piece.type === 'k' || PIECE_ATTACKS_DIAGONALLY[piece.type]) return true;
        }
      } else {
        // Sliding
        nr += dir[0];
        nc += dir[1];
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const nextPiece = board[nr][nc];
          if (nextPiece) {
            if (nextPiece.color === attackerColor && PIECE_ATTACKS_DIAGONALLY[nextPiece.type]) return true;
            break;
          }
          nr += dir[0];
          nc += dir[1];
        }
      }
    }
  }

  // Orthogonal
  for (let i = 0; i < 4; i++) {
    const dir = ORTHOGONAL_DIRS[i];
    let nr = r + dir[0];
    let nc = c + dir[1];

    // King check
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor) {
          if (piece.type === 'k' || PIECE_ATTACKS_ORTHOGONALLY[piece.type]) return true;
        }
      } else {
        // Sliding
        nr += dir[0];
        nc += dir[1];
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const nextPiece = board[nr][nc];
          if (nextPiece) {
            if (nextPiece.color === attackerColor && PIECE_ATTACKS_ORTHOGONALLY[nextPiece.type]) return true;
            break;
          }
          nr += dir[0];
          nc += dir[1];
        }
      }
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
    // Stepping moves (Knight, King, and stepping components of hybrids)
    const steppingDirs = PIECE_STEPPING_DIRS[piece.type];
    if (steppingDirs) {
      for (let i = 0; i < steppingDirs.length; i++) {
        const [dr, dc] = steppingDirs[i];
        const nr = r + dr, nc = c + dc;
        if (isInside(nr, nc)) {
          if (isEnemy(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          } else if (!onlyCaptures && isEmpty(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          }
        }
      }
    }

    // Sliding moves (Bishop, Rook, Queen, and sliding components of hybrids)
    const slidingDirs = PIECE_SLIDING_DIRS[piece.type];
    if (slidingDirs) {
      for (let i = 0; i < slidingDirs.length; i++) {
        const [dr, dc] = slidingDirs[i];
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

  // Stepping moves (Knight etc)
  const steppingDirs = PIECE_STEPPING_DIRS[piece.type];
  if (steppingDirs) {
    for (let i = 0; i < steppingDirs.length; i++) {
      const [dr, dc] = steppingDirs[i];
      const nr = r + dr, nc = c + dc;
      if (isInside(nr, nc) && (isEmpty(nr, nc) || isEnemy(nr, nc))) {
        count++;
      }
    }
  }

  // Sliding moves
  const slidingDirs = PIECE_SLIDING_DIRS[piece.type];
  if (slidingDirs) {
    for (let i = 0; i < slidingDirs.length; i++) {
      const [dr, dc] = slidingDirs[i];
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
