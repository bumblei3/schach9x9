/**
 * Web Worker for Chess 9x9 AI Calculations
 * Prevents UI freezing during minimax search
 */

import { logger } from './logger.js';
import { getBestMove, evaluatePosition, setOpeningBook, setProgressCallback } from './aiEngine.js';

// Main message handler
self.onmessage = function (e) {
  try {
    const { type, data } = e.data;

    switch (type) {
    case 'loadBook': {
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

    default: {
      logger.warn('Unknown message type:', type);
    }
    }
  } catch (error) {
    logger.error('[AI Worker] Error handling message:', error);
  }
};
