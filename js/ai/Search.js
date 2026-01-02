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
let currentDepth = 0;
let bestMoveSoFar = null;
let lastProgressUpdate = 0;

/**
 * Send progress update to UI
 */
function sendProgress(maxDepth) {
  const now = Date.now();
  if (now - lastProgressUpdate > 100) {
    const progressData = {
      type: 'progress',
      depth: currentDepth,
      maxDepth: maxDepth,
      nodes: nodesEvaluated,
      bestMove: bestMoveSoFar,
    };

    if (progressCallback) {
      progressCallback(progressData);
    } else if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage(progressData);
    }
    lastProgressUpdate = now;
  }
}

/**
 * Main AI function to find the best move
 */
export function getBestMove(board, color, depth, difficulty) {
  nodesEvaluated = 0;
  currentDepth = 0;
  bestMoveSoFar = null;
  lastProgressUpdate = Date.now();

  // 1. Opening Book
  const bookMove = queryOpeningBook(board);
  if (bookMove) {
    logger.info(
      `[AI Worker] Opening book move found: ${bookMove.from.r},${bookMove.from.c} -> ${bookMove.to.r},${bookMove.to.c}`
    );
    return bookMove;
  }

  const moves = getAllLegalMoves(board, color);
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
    for (let d = 1; d <= maxDepth; d++) {
      currentDepth = d;
      let currentBestMove = null;
      let currentBestScore = -Infinity;
      let alpha = -Infinity;
      const beta = Infinity;

      // PVS at Root
      for (let i = 0; i < orderedMoves.length; i++) {
        const move = orderedMoves[i];
        const undoInfo = makeMove(board, move);
        const opponentColor = color === 'white' ? 'black' : 'white';
        const nextHash = computeZobristHash(board, opponentColor);

        let score;
        if (i === 0) {
          score = -minimax(board, d - 1, -beta, -alpha, opponentColor, color, nextHash);
        } else {
          score = -minimax(board, d - 1, -(alpha + 1), -alpha, opponentColor, color, nextHash);
          if (score > alpha && score < beta) {
            score = -minimax(board, d - 1, -beta, -alpha, opponentColor, color, nextHash);
          }
        }

        undoMove(board, undoInfo);

        if (score > currentBestScore) {
          currentBestScore = score;
          currentBestMove = move;
        }
        alpha = Math.max(alpha, currentBestScore);
        if (alpha >= beta) break;
      }

      bestMove = currentBestMove || bestMove;
      bestScore = currentBestScore;
      bestMoveSoFar = bestMove;
      sendProgress(maxDepth);

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

    // Cleanup
    if (bestMove && bestMove._score !== undefined) delete bestMove._score;
    return bestMove;
  } catch (error) {
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

  if (nodesEvaluated % 1000 === 0) sendProgress(currentDepth);

  // TT Probe
  const ttEntry = probeTT(hash, depth, alpha, beta);
  if (ttEntry && ttEntry.score !== undefined) return ttEntry.score;

  if (depth <= 0) {
    return quiescenceSearch(board, alpha, beta, turnColor, aiColor);
  }

  const moves = getAllLegalMoves(board, turnColor);
  if (moves.length === 0) {
    if (isInCheck(board, turnColor)) {
      return -10000 - depth; // Mate (favor closer mates)
    }
    return 0; // Stalemate
  }

  const orderedMoves = orderMoves(board, moves, ttEntry ? ttEntry.bestMove : null, depth);
  let bestScore = -Infinity;
  let bestMove = null;
  let flag = TT_ALPHA;

  const opponentColor = turnColor === 'white' ? 'black' : 'white';

  for (let i = 0; i < orderedMoves.length; i++) {
    const move = orderedMoves[i];
    const undoInfo = makeMove(board, move);
    const nextHash = computeZobristHash(board, opponentColor);

    let score;
    if (i === 0) {
      score = -minimax(board, depth - 1, -beta, -alpha, opponentColor, aiColor, nextHash);
    } else {
      // PVS Null Window Search
      score = -minimax(board, depth - 1, -(alpha + 1), -alpha, opponentColor, aiColor, nextHash);
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
  const score = evaluatePosition(board, turnColor);

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
    pv.push(move);
    undoStack.push(makeMove(board, move));
    currentColor = currentColor === 'white' ? 'black' : 'white';
  }

  while (undoStack.length > 0) {
    undoMove(board, undoStack.pop());
  }
  return pv;
}
