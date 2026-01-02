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
  getZobristTable,
  getTTStats,
} from './TranspositionTable.js';
import { orderMoves, addKillerMove, updateHistory, clearKillerMoves } from './MoveOrdering.js';

// Get Zobrist table for incremental hashing
const zobristTable = getZobristTable();

// Progress tracking
let nodesEvaluated = 0;
let currentDepth = 0;
let bestMoveSoFar = null;
let lastProgressUpdate = 0;
let onProgressCallback = null;

export function setProgressCallback(callback) {
  onProgressCallback = callback;
}

export function getNodesEvaluated() {
  return nodesEvaluated;
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
 * Get best move using minimax algorithm with iterative deepening
 */
export function getBestMove(board, color, depth, difficulty, moveNumber = 0) {
  try {
    // Check opening book first (only for first 10 moves)
    const bookMove = queryOpeningBook(board, moveNumber);
    if (bookMove) {
      return bookMove;
    }
    // Reset progress tracking
    nodesEvaluated = 0;
    currentDepth = 0;
    bestMoveSoFar = null;
    lastProgressUpdate = Date.now();

    clearKillerMoves();

    const moves = getAllLegalMoves(board, color);

    if (moves.length === 0) {
      return null;
    }

    // Difficulty-based behavior
    if (difficulty === 'beginner') {
      const randomChance = Math.random();
      if (randomChance < 0.85) {
        return moves[Math.floor(Math.random() * moves.length)];
      } else if (randomChance < 0.95) {
        const scoredMoves = moves.map(move => {
          const undo = makeMove(board, move);
          const score = evaluatePosition(board, color);
          undoMove(board, undo);
          return { move, score };
        });
        scoredMoves.sort((a, b) => a.score - b.score);
        const worstMoves = scoredMoves.slice(0, Math.max(1, Math.floor(moves.length * 0.3)));
        return worstMoves[Math.floor(Math.random() * worstMoves.length)].move;
      }
      depth = 1;
    } else if (difficulty === 'easy') {
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

    const useIterativeDeepening = difficulty === 'hard' || difficulty === 'expert';
    const startDepth = useIterativeDeepening ? 1 : depth;
    let previousIterationScore = 0;

    for (let currentSearchDepth = startDepth; currentSearchDepth <= depth; currentSearchDepth++) {
      currentDepth = currentSearchDepth;

      let bestScore = -Infinity;
      let iterationBestMove = moves[0];

      sendProgress(depth);

      const ttBestMove = currentSearchDepth > startDepth ? bestMove : null;
      const orderedMoves = orderMoves(board, moves, ttBestMove, currentSearchDepth);

      const rootHash = computeZobristHash(board, color);

      let alpha = -Infinity;
      let beta = Infinity;

      let windowSize = 40;
      if (currentSearchDepth > startDepth && Math.abs(previousIterationScore) < 5000) {
        alpha = previousIterationScore - windowSize;
        beta = previousIterationScore + windowSize;
      }

      // Root Search Loop
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let currentAlpha = alpha;
        let currentBestScore = -Infinity;
        let currentBestMove = moves[0];

        for (let i = 0; i < orderedMoves.length; i++) {
          const move = orderedMoves[i];
          let score;

          if (i === 0) {
            score = minimax(
              board,
              move,
              currentSearchDepth - 1,
              false,
              currentAlpha,
              beta,
              color,
              rootHash
            );
          } else {
            score = minimax(
              board,
              move,
              currentSearchDepth - 1,
              false,
              currentAlpha,
              currentAlpha + 1,
              color,
              rootHash
            );
            if (score > currentAlpha && score < beta) {
              score = minimax(
                board,
                move,
                currentSearchDepth - 1,
                false,
                currentAlpha,
                beta,
                color,
                rootHash
              );
            }
          }

          if (score > currentBestScore) {
            currentBestScore = score;
            currentBestMove = move;
          }
          if (score > currentAlpha) {
            currentAlpha = score;
          }
          if (score >= beta) break;
        }

        if (currentBestScore <= alpha) {
          alpha -= windowSize;
          windowSize *= 2;
          continue;
        }
        if (currentBestScore >= beta) {
          beta += windowSize;
          windowSize *= 2;
          continue;
        }

        bestScore = currentBestScore;
        iterationBestMove = currentBestMove;
        break;
      }

      previousIterationScore = bestScore;
      bestMove = iterationBestMove;
      bestMoveSoFar = bestMove;
      sendProgress(depth);
    }

    // Log TT statistics
    const stats = getTTStats();
    const ttTotal = stats.hits + stats.misses;
    const hitRate = ttTotal > 0 ? ((stats.hits / ttTotal) * 100).toFixed(1) : 0;
    logger.info(
      `[AI Worker] TT Hit Rate: ${hitRate}% (${stats.hits}/${ttTotal}), Nodes: ${nodesEvaluated}`
    );

    if (bestMove && bestMove._score !== undefined) {
      delete bestMove._score;
    }

    return bestMove;
  } catch (error) {
    logger.error('[AI Worker] Error in getBestMove:', error);
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
 * Check if the side has major pieces
 */
function hasMajorPieces(board, color) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
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
  nodesEvaluated++;

  if (nodesEvaluated % 100 === 0) {
    const now = Date.now();
    if (now - lastProgressUpdate >= 100) {
      sendProgress(currentDepth);
    }
  }

  const fromPiece = move ? board[move.from.r][move.from.c] : null;
  const capturedPiece = move ? board[move.to.r][move.to.c] : null;

  // INCREMENTAL HASH UPDATE
  let hash = parentHash;

  // 1. Toggle side to move
  hash ^= zobristTable.sideToMove;

  if (move) {
    if (fromPiece) {
      hash ^= zobristTable[fromPiece.color][fromPiece.type][move.from.r][move.from.c];
    }
    if (fromPiece) {
      hash ^= zobristTable[fromPiece.color][fromPiece.type][move.to.r][move.to.c];
    }
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

    if (depth >= 3 && move !== null && !isInCheck(board, color) && hasMajorPieces(board, color)) {
      const R = 2;
      const nullScore = minimax(
        board,
        null,
        depth - 1 - R,
        !isMaximizing,
        alpha,
        beta,
        aiColor,
        hash
      );

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
      score = isMaximizing ? -10000 : 10000;
      flag = TT_EXACT;
    } else if (isMaximizing) {
      score = -Infinity;
      const ttBestMove = ttEntry ? ttEntry.bestMove : null;
      const orderedMoves = orderMoves(board, moves, ttBestMove, depth);

      for (let i = 0; i < orderedMoves.length; i++) {
        const nextMove = orderedMoves[i];
        let moveScore;
        const isCapture = board[nextMove.to.r][nextMove.to.c] !== null;

        if (i === 0) {
          moveScore = minimax(board, nextMove, depth - 1, false, alpha, beta, aiColor, hash);
        } else {
          // PVS / LMR search
          let reduction = 0;
          if (depth >= 3 && i >= 4 && !isCapture && !isInCheck(board, color)) {
            reduction = 1;
            if (i >= 12) reduction = 2;
          }

          moveScore = minimax(
            board,
            nextMove,
            depth - 1 - reduction,
            false,
            alpha,
            alpha + 1,
            aiColor,
            hash
          );

          if (moveScore > alpha && reduction > 0) {
            moveScore = minimax(board, nextMove, depth - 1, false, alpha, alpha + 1, aiColor, hash);
          }
          if (moveScore > alpha && moveScore < beta) {
            moveScore = minimax(board, nextMove, depth - 1, false, alpha, beta, aiColor, hash);
          }
        }

        if (moveScore > score) {
          score = moveScore;
          bestMove = nextMove;
        }
        alpha = Math.max(alpha, score);
        if (beta <= alpha) {
          if (!capturedPiece) addKillerMove(depth, nextMove);
          updateHistory(fromPiece, nextMove, depth);
          flag = TT_BETA;
          break;
        }
      }
      if (flag !== TT_BETA) flag = TT_EXACT;
    } else {
      score = Infinity;
      const ttBestMove = ttEntry ? ttEntry.bestMove : null;
      const orderedMoves = orderMoves(board, moves, ttBestMove, depth);

      for (let i = 0; i < orderedMoves.length; i++) {
        const nextMove = orderedMoves[i];
        let moveScore;
        const isCapture = board[nextMove.to.r][nextMove.to.c] !== null;

        if (i === 0) {
          moveScore = minimax(board, nextMove, depth - 1, true, alpha, beta, aiColor, hash);
        } else {
          // PVS / LMR search
          let reduction = 0;
          if (depth >= 3 && i >= 4 && !isCapture && !isInCheck(board, color)) {
            reduction = 1;
            if (i >= 12) reduction = 2;
          }

          moveScore = minimax(
            board,
            nextMove,
            depth - 1 - reduction,
            true,
            beta - 1,
            beta,
            aiColor,
            hash
          );

          if (moveScore < beta && reduction > 0) {
            moveScore = minimax(board, nextMove, depth - 1, true, beta - 1, beta, aiColor, hash);
          }
          if (moveScore < beta && moveScore > alpha) {
            moveScore = minimax(board, nextMove, depth - 1, true, alpha, beta, aiColor, hash);
          }
        }

        if (moveScore < score) {
          score = moveScore;
          bestMove = nextMove;
        }
        beta = Math.min(beta, score);
        if (beta <= alpha) {
          if (!capturedPiece) addKillerMove(depth, nextMove);
          updateHistory(fromPiece, nextMove, depth);
          flag = TT_BETA;
          break;
        }
      }
      if (flag !== TT_BETA) flag = TT_EXACT;
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
