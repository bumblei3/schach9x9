/**
 * Web Worker for Chess 9x9 AI Calculations
 * Prevents UI freezing during minimax search
 */

import { logger } from './logger.js';
import { getBestMove, evaluatePosition, setOpeningBook, setProgressCallback, getAllLegalMoves } from './aiEngine.js';

// Helper to get moves from board (wrapper for consistency)
function getAllLegalMovesFromBoard(board, color) {
  return getAllLegalMoves(board, color);
}

// Main message handler
self.onmessage = function (e) {
  try {
    const { type, data } = e.data;

    switch (type) {
      case 'loadBook': {
        if (!data || !data.book) {
          logger.warn('[AI Worker] loadBook called without book data');
          break;
        }
        setOpeningBook(data.book);
        logger.info('[AI Worker] Opening book loaded:', data.book.metadata);
        break;
      }

      case 'getBestMove': {
        const { board, color, depth, difficulty, moveNumber } = data;

        // Setup progress callback
        setProgressCallback(progress => {
          self.postMessage({ type: 'progress', data: progress });
        });

        const bestMove = getBestMove(board, color, depth, difficulty, moveNumber);
        self.postMessage({ type: 'bestMove', data: bestMove });
        break;
      }

      case 'evaluatePosition': {
        const { board: evalBoard, forColor } = data;
        const score = evaluatePosition(evalBoard, forColor);
        self.postMessage({ type: 'positionScore', data: score });
        break;
      }

      case 'analyze': {
        const { board, color, depth, topMovesCount = 5 } = data;

        // Get position evaluation
        const score = evaluatePosition(board, color);

        // Get all legal moves and evaluate each
        const allMoves = getAllLegalMovesFromBoard(board, color);

        // Evaluate each move
        const movesWithScores = allMoves.map(move => {
          // Simulate move
          const boardCopy = JSON.parse(JSON.stringify(board));
          const piece = boardCopy[move.from.r][move.from.c];
          boardCopy[move.to.r][move.to.c] = piece;
          boardCopy[move.from.r][move.from.c] = null;

          // Evaluate resulting position
          const moveScore = evaluatePosition(boardCopy, color);

          return {
            from: move.from,
            to: move.to,
            score: moveScore
          };
        });

        // Sort moves by score (descending for current player)
        movesWithScores.sort((a, b) => b.score - a.score);

        // Get top N moves
        const topMoves = movesWithScores.slice(0, topMovesCount);

        self.postMessage({
          type: 'analysis',
          data: {
            score,
            topMoves
          }
        });
        break;
      }

      default: {
        logger.warn('Unknown message type:', type);
      }
    }
  } catch (error) {
    logger.error('[AI Worker] Error handling message:', error);
  }
};
