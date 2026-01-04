import { logger } from '../logger.js';
import { queryOpeningBook } from './OpeningBook.js';
import {
  getAllLegalMoves,
  makeMove,
  undoMove,
  getAllCaptureMoves,
  isInCheck,
} from './MoveGenerator.js';
import { evaluatePosition } from './Evaluation.js';
import {
  computeZobristHash,
  updateZobristHash,
  getXORSideToMove,
  storeTT,
  probeTT,
  TT_EXACT,
  TT_ALPHA,
  TT_BETA,
} from './TranspositionTable.js';
import { orderMoves, addKillerMove, updateHistory } from './MoveOrdering.js';

// Progress tracking
export let nodesEvaluated = 0;
export function getNodesEvaluated() {
  return nodesEvaluated;
}
export function resetNodesEvaluated() {
  nodesEvaluated = 0;
}
let progressCallback = null;
export function setProgressCallback(cb) {
  progressCallback = cb;
}
/**
 * Reset active personality config
 */
export function resetActiveConfig() {
  activeConfig = null;
}
// Active personality config
let activeConfig = null;

let currentDepth = 0;
let bestMoveSoFar = null;
let lastProgressUpdate = 0;
let searchEndTime = Infinity;

/**
 * Send progress update to UI
 */
function sendProgress(maxDepth, force = false) {
  const now = Date.now();
  if (force || now - lastProgressUpdate > 100) {
    const progressData = {
      type: 'progress',
      depth: currentDepth,
      maxDepth: maxDepth,
      nodes: nodesEvaluated,
      bestMove: bestMoveSoFar,
    };

    if (progressCallback) {
      progressCallback(progressData);
    } else if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
      try {
        // In Web Workers, postMessage takes 1 argument. 
        // In JSDOM/Window, it may require 2.
        self.postMessage(progressData);
      } catch (e) {
        // Silently fail if postMessage fails (e.g. in test environments)
      }
    }
    lastProgressUpdate = now;
  }
}

/**
 * @typedef {Object} Move
 * @property {Object} from - {r, c}
 * @property {Object} to - {r, c}
 * @property {number} [score] - Evaluation score
 */

/**
 * Main AI function to find the best move
 * @param {Array<Array<Object>>} board - The game board
 * @param {string} color - 'white' or 'black'
 * @param {number} depth - Search depth
 * @param {string} difficulty - Difficulty level
 * @param {number} moveNumber - Move number
 * @param {Object} [config] - Personality configuration
 * @param {Object} [lastMove] - Last move for En Passant
 * @param {number} [timeLimit] - Time limit in ms (default 0 = infinite)
 * @returns {Move|null} Best move found
 */
export function getBestMove(
  board,
  color,
  depth,
  difficulty,
  moveNumber,
  config = null,
  lastMove = null,
  timeLimit = 0
) {
  activeConfig = config;
  nodesEvaluated = 0;
  currentDepth = 0;
  bestMoveSoFar = null;
  lastProgressUpdate = Date.now();
  searchEndTime = timeLimit > 0 ? Date.now() + timeLimit : Infinity;

  // 1. Opening Book
  const bookMove = queryOpeningBook(board);
  if (bookMove) {
    logger.info(
      `[AI Worker] Opening book move found: ${bookMove.from.r},${bookMove.from.c} -> ${bookMove.to.r},${bookMove.to.c}`
    );
    return bookMove;
  }

  const moves = getAllLegalMoves(board, color, lastMove);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // Difficulty-based depth limit
  let maxDepth = depth;
  if (difficulty === 'beginner') maxDepth = Math.min(depth, 1);
  else if (difficulty === 'easy') maxDepth = Math.min(depth, 2);

  let bestMove = moves[0];
  let bestScore = -Infinity;

  const orderedMoves = orderMoves(board, moves, null, 0);

  try {
    // ITERATIVE DEEPENING
    const WINDOW_SIZE = 50;
    const initialRootHash = computeZobristHash(board, color);

    for (let d = 1; d <= maxDepth; d++) {
      currentDepth = d;
      let currentBestMoveForDepth = null;
      let currentBestScoreForDepth = -Infinity;

      let searchAlpha = -Infinity;
      let searchBeta = Infinity;

      // ASPIRATION WINDOW
      if (d > 1) {
        searchAlpha = bestScore - WINDOW_SIZE;
        searchBeta = bestScore + WINDOW_SIZE;
      }

      for (; ;) {
        let alpha = searchAlpha;
        const beta = searchBeta;
        currentBestScoreForDepth = -Infinity;

        // PVS at Root
        for (let i = 0; i < orderedMoves.length; i++) {
          const move = orderedMoves[i];
          const piece = board[move.from.r][move.from.c];
          const undoInfo = makeMove(board, move);
          const opponentColor = color === 'white' ? 'black' : 'white';

          // Incremental Hash Update
          const nextHashVal = updateZobristHash(
            initialRootHash,
            move.from,
            move.to,
            piece,
            board[move.to.r][move.to.c],
            undoInfo
          );

          let score;
          if (i === 0) {
            score = -minimax(board, d - 1, -beta, -alpha, opponentColor, color, nextHashVal);
          } else {
            score = -minimax(board, d - 1, -(alpha + 1), -alpha, opponentColor, color, nextHashVal);
            if (score > alpha && score < beta) {
              score = -minimax(board, d - 1, -beta, -alpha, opponentColor, color, nextHashVal);
            }
          }

          move._score = score; // Store score for difficulty adjustment

          undoMove(board, undoInfo);

          if (score > currentBestScoreForDepth) {
            currentBestScoreForDepth = score;
            currentBestMoveForDepth = move;
          }
          alpha = Math.max(alpha, currentBestScoreForDepth);
          if (alpha >= beta) break;
        }

        // If search returned a value outside the window, widen it and search again
        if (currentBestScoreForDepth <= searchAlpha || currentBestScoreForDepth >= searchBeta) {
          searchAlpha = -Infinity;
          searchBeta = Infinity;
          continue;
        }
        break;
      }

      bestMove = currentBestMoveForDepth || bestMove;
      bestScore = currentBestScoreForDepth;
      bestMoveSoFar = bestMove;

      // Store best move in TT for PV extraction
      storeTT(initialRootHash, d, bestScore, TT_EXACT, bestMove);

      sendProgress(maxDepth, d === maxDepth);

      // Re-order moves: put best move first
      if (bestMove) {
        const index = orderedMoves.indexOf(bestMove);
        if (index > 0) {
          orderedMoves.splice(index, 1);
          orderedMoves.unshift(bestMove);
        }
      }

      // If we found a mate, no need to search deeper
      if (Math.abs(bestScore) > 9000) break;
    }

    // Adjust difficulty for beginner at the end of search
    if (difficulty === 'beginner' && orderedMoves.length > 1) {
      // Sort available moves by score descending
      const validMoves = orderedMoves
        .filter(m => m._score !== undefined)
        .sort((a, b) => b._score - a._score);

      if (validMoves.length > 0) {
        // Pick from top 50% or top 5, whichever is larger
        // This makes the AI less precise
        const count = Math.max(5, Math.ceil(validMoves.length * 0.5));
        // Ensure we don't exceed length
        const safeCount = Math.min(count, validMoves.length);

        const candidates = validMoves.slice(0, safeCount);
        let selectedMove = candidates[Math.floor(Math.random() * candidates.length)];

        // 25% chance to blunder (pick any legal move)
        if (Math.random() < 0.25) {
          selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
          logger.info('[AI] Beginner: Blunder roll passed. Picking random move.');
        }

        logger.info(
          `[AI] Beginner: Picked move with score ${selectedMove._score} (Best was ${validMoves[0]._score})`
        );

        // Clean up scores
        orderedMoves.forEach(m => {
          if (m._score !== undefined) delete m._score;
        });
        return selectedMove;
      }
    }

    // Cleanup
    if (bestMove && bestMove._score !== undefined) delete bestMove._score;
    orderedMoves.forEach(m => {
      if (m._score !== undefined) delete m._score;
    }); // Cleanup all

    // Attach PV
    if (bestMove) {
      bestMove.pv = extractPV(board, color, currentDepth);
    }
    return bestMove;
  } catch (error) {
    if (error.message === 'TimeOut') {
      logger.info(`[AI] Search timed out at depth ${currentDepth}. Returning best move.`);
      const result = bestMoveSoFar || moves[0];
      if (result) {
        result.pv = extractPV(board, color, currentDepth);
      }
      return result;
    }
    logger.error('[AI Worker] Error in getBestMove:', error);
    return moves[0];
  }
}

/**
 * Minimax with Alpha-Beta, PVS, and TT
 * This version uses a NegaMax style for cleaner code
 */
function minimax(board, depth, alpha, beta, turnColor, aiColor, hash) {
  nodesEvaluated++;

  if (nodesEvaluated % 1000 === 0) {
    sendProgress(currentDepth);
    if (Date.now() > searchEndTime) throw new Error('TimeOut');
  }

  // TT Probe
  const ttEntry = probeTT(hash, depth, alpha, beta);
  if (ttEntry && ttEntry.score !== undefined) return ttEntry.score;

  const inCheck = isInCheck(board, turnColor);

  // CHECK EXTENSIONS: Extend search if in check
  if (inCheck && depth < currentDepth + 2) {
    depth++;
  }

  if (depth <= 0 && !inCheck) {
    return quiescenceSearch(board, alpha, beta, turnColor, aiColor);
  }

  const moves = getAllLegalMoves(board, turnColor);
  if (moves.length === 0) {
    if (inCheck) {
      return -10000 - depth; // Mate (favor closer mates)
    }
    return 0; // Stalemate
  }

  if (depth <= 0) {
    return quiescenceSearch(board, alpha, beta, turnColor, aiColor);
  }

  const opponentColor = turnColor === 'white' ? 'black' : 'white';

  // STATIC NULL MOVE PRUNING (Reverse Futility Pruning)
  if (depth <= 3 && !inCheck && Math.abs(beta) < 9000) {
    const staticEval = evaluatePosition(board, turnColor, activeConfig);
    const margin = 120 * depth;
    if (staticEval - margin >= beta) return beta;
  }

  // NULL MOVE PRUNING
  if (depth >= 3 && !inCheck && Math.abs(beta) < 9000) {
    const R = 2 + Math.floor(depth / 6); // Dynamic reduction
    // Flip side to move for null move
    const nextHash = hash ^ getXORSideToMove();

    const score = -minimax(
      board,
      depth - 1 - R,
      -beta,
      -beta + 1,
      opponentColor,
      aiColor,
      nextHash
    );
    if (score >= beta) return beta;
  }

  const orderedMoves = orderMoves(board, moves, ttEntry ? ttEntry.bestMove : null, depth);
  let bestScore = -Infinity;
  let bestMove = null;
  let flag = TT_ALPHA;

  for (let i = 0; i < orderedMoves.length; i++) {
    const move = orderedMoves[i];
    const piece = board[move.from.r][move.from.c];
    const capturedPiece = board[move.to.r][move.to.c];
    const undoInfo = makeMove(board, move);
    const nextHash = updateZobristHash(hash, move.from, move.to, piece, capturedPiece, undoInfo);

    let score;
    if (i === 0) {
      score = -minimax(board, depth - 1, -beta, -alpha, opponentColor, aiColor, nextHash);
    } else {
      // LATE MOVE REDUCTION (LMR)
      let reduction = 0;
      const isCapture = board[move.to.r][move.to.c] !== null;

      // LATE MOVE REDUCTION
      if (depth >= 3 && i >= 3 && !isCapture && !inCheck && Math.abs(alpha) < 9000) {
        reduction = Math.floor(1 + (Math.log(depth) * Math.log(i)) / 2.0);
        reduction = Math.min(depth - 1, reduction); // Don't reduce to 0
      }

      // PVS Null Window Search
      score = -minimax(
        board,
        depth - 1 - reduction,
        -(alpha + 1),
        -alpha,
        opponentColor,
        aiColor,
        nextHash
      );

      // Re-search if reduced move was better than alpha
      if (reduction > 0 && score > alpha) {
        score = -minimax(board, depth - 1, -(alpha + 1), -alpha, opponentColor, aiColor, nextHash);
      }

      if (score > alpha && score < beta) {
        score = -minimax(board, depth - 1, -beta, -alpha, opponentColor, aiColor, nextHash);
      }
    }

    undoMove(board, undoInfo);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    alpha = Math.max(alpha, bestScore);
    if (alpha >= beta) {
      flag = TT_BETA;
      if (board[move.to.r][move.to.c] === null) addKillerMove(depth, move);
      updateHistory(board[move.from.r][move.from.c], move, depth);
      break;
    }
  }

  if (flag !== TT_BETA) flag = TT_EXACT;
  storeTT(hash, depth, bestScore, flag, bestMove);

  return bestScore;
}

/**
 * Quiescence Search
 */
function quiescenceSearch(board, alpha, beta, turnColor, aiColor) {
  nodesEvaluated++;

  // Evaluation from perspective of turnColor
  const score = evaluatePosition(board, turnColor, activeConfig);

  if (score >= beta) return beta;
  if (alpha < score) alpha = score;

  const captures = getAllCaptureMoves(board, turnColor);
  const orderedCaptures = orderMoves(board, captures, null, 0);

  for (const move of orderedCaptures) {
    const undoInfo = makeMove(board, move);
    const opponentColor = turnColor === 'white' ? 'black' : 'white';
    const captureScore = -quiescenceSearch(board, -beta, -alpha, opponentColor, aiColor);
    undoMove(board, undoInfo);

    if (captureScore >= beta) return beta;
    if (captureScore > alpha) alpha = captureScore;
  }

  return alpha;
}

/**
 * Analyze position for UI
 */
export function analyzePosition(board, color, depth) {
  try {
    nodesEvaluated = 0;
    const moves = getAllLegalMoves(board, color);
    if (moves.length === 0) return { score: 0, topMoves: [] };

    const results = moves.map(move => {
      const undoInfo = makeMove(board, move);
      const opponentColor = color === 'white' ? 'black' : 'white';
      const nextHash = computeZobristHash(board, opponentColor);

      // Search from opponent's perspective and negate
      const score = -minimax(board, depth - 1, -Infinity, Infinity, opponentColor, color, nextHash);
      undoMove(board, undoInfo);
      return { move, score };
    });

    results.sort((a, b) => b.score - a.score);
    return {
      score: results[0].score,
      topMoves: results.slice(0, 5),
    };
  } catch (e) {
    if (e.message === 'TimeOut') {
      logger.warn('[Search] Analysis timed out');
      return { score: 0, topMoves: [] };
    }
    logger.error('[Search] Error analyzing position:', e);
    return { score: 0, topMoves: [] };
  }
}

/**
 * Extract PV (Principal Variation)
 */
export function extractPV(board, color, depth) {
  const pv = [];
  const undoStack = [];
  let currentColor = color;

  for (let i = 0; i < depth && i < 10; i++) {
    const hash = computeZobristHash(board, currentColor);
    const entry = probeTT(hash, 0, -Infinity, Infinity);
    if (!entry || !entry.bestMove) break;

    const move = entry.bestMove;
    // Clone move to avoid circular references (if bestMove attempts to include its own PV)
    pv.push({ from: move.from, to: move.to, promotion: move.promotion });
    undoStack.push(makeMove(board, move));
    currentColor = currentColor === 'white' ? 'black' : 'white';
  }

  while (undoStack.length > 0) {
    undoMove(board, undoStack.pop());
  }
  return pv;
}
