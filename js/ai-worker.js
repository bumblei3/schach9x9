/**
 * Web Worker for Chess 9x9 AI Calculations
 * Prevents UI freezing during minimax search
 */

import { logger } from './logger.js';
import {
  getBestMoveDetailed,
  analyzePosition,
  evaluatePosition,
  setOpeningBook,
  setProgressCallback,
} from './aiEngine.js';

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
        const { board, color, depth, difficulty, moveNumber, config, lastMove, timeLimit } = data;
        logger.debug(
          `[AI Worker] getBestMove started - color:${color} depth:${depth} difficulty:${difficulty} timeLimit:${timeLimit}ms`
        );

        // Setup progress callback
        setProgressCallback(progress => {
          self.postMessage({ type: 'progress', data: progress });
        });

        try {
          const bestMove = getBestMoveDetailed(
            board,
            color,
            depth,
            difficulty,
            moveNumber,
            config,
            lastMove,
            timeLimit
          );
          self.postMessage({ type: 'bestMove', data: bestMove });
        } catch (error) {
          logger.error('[AI Worker] getBestMove failed:', error);
          self.postMessage({ type: 'bestMove', data: null });
        }
        break;
      }

      case 'evaluatePosition': {
        const { board: evalBoard, forColor } = data;
        const score = evaluatePosition(evalBoard, forColor);
        self.postMessage({ type: 'positionScore', data: score });
        break;
      }

      case 'analyze': {
        const { board, color, depth = 3, topMovesCount = 5 } = data;

        // Setup progress callback
        setProgressCallback(progress => {
          self.postMessage({ type: 'progress', data: progress });
        });

        // Use the new deep analysis function
        const analysis = analyzePosition(board, color, depth, topMovesCount);

        self.postMessage({
          type: 'analysis',
          data: analysis,
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
