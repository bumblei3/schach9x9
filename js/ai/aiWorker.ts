/**
 * Web Worker for Chess 9x9 AI Calculations
 * Prevents UI freezing during minimax search
 */

import { logger } from '../logger.js';
import {
  getBestMoveDetailed,
  getTopMoves,
  analyzePosition,
  evaluatePosition,
  setOpeningBook,
  setProgressCallback,
} from '../aiEngine.js';

self.onmessage = async function (e: MessageEvent) {
  try {
    const { type, data, id } = e.data;

    switch (type) {
      case 'loadBook': {
        if (!data || !data.book) {
          (logger as any).warn('[AI Worker] loadBook called without book data');
          break;
        }
        setOpeningBook(data.book);
        (logger as any).info('[AI Worker] Opening book loaded:', data.book.metadata);
        break;
      }

      case 'getBestMove': {
        const { board, color, depth, config, personality, moveNumber } = data;

        // Setup progress callback
        setProgressCallback((progress: any) => {
          (self as any).postMessage({ type: 'progress', id, data: progress });
        });

        try {
          const timeParams = {
            elo: config?.elo,
            personality: personality || config?.personality,
            maxDepth: depth,
          };
          const result = await getBestMoveDetailed(board, color, depth, timeParams, moveNumber);
          (self as any).postMessage({ type: 'bestMove', id, data: result });
        } catch (error) {
          (logger as any).error('[AI Worker] getBestMove failed:', error);
          (self as any).postMessage({ type: 'bestMove', id, data: null });
        }
        break;
      }

      case 'evaluatePosition': {
        const { board: evalBoard, forColor } = data;
        const score = await evaluatePosition(evalBoard, forColor);
        (self as any).postMessage({ type: 'positionScore', id, data: score });
        break;
      }

      case 'getTopMoves': {
        const { board, color, count, depth, maxTimeMs, moveNumber } = data;
        try {
          const topMoves = await getTopMoves(board, color, count, depth, maxTimeMs, moveNumber);
          (self as any).postMessage({ type: 'topMoves', id, data: topMoves });
        } catch (error) {
          (logger as any).error('[AI Worker] getTopMoves failed:', error);
          (self as any).postMessage({ type: 'topMoves', id, data: [] });
        }
        break;
      }

      case 'analyze': {
        const { board, color } = data;

        setProgressCallback(progress => {
          (self as any).postMessage({ type: 'progress', id, data: progress });
        });
        // Use the new deep analysis function
        const analysis = analyzePosition(board, color); // Removed unsupported args depth, topMovesCount for now

        (self as any).postMessage({
          type: 'analysis',
          id,
          data: analysis,
        });
        break;
      }

      case 'search': {
        const { board, color, depth, personality } = data;
        // setProgressCallback((progress: any) => {
        //   (self as any).postMessage({ type: 'progress', id, data: progress });
        // });

        try {
          const timeParams = {
            personality,
            maxDepth: depth,
          };
          const result = await getBestMoveDetailed(board, color, depth, timeParams);
          // Send back as 'bestMove' to match what AIController.getHint expects
          // result contains { bestMove, score, pv, ... }
          (self as any).postMessage({ type: 'bestMove', id, ...result });
        } catch (error) {
          (logger as any).error('[AI Worker] search failed:', error);
          (self as any).postMessage({ type: 'bestMove', id, bestMove: null });
        }
        break;
      }

      default: {
        // Compatible with old protocol just in case? 'SEARCH'
        if (type === 'SEARCH') {
          // Adapter for legacy messages if any
          const { board, turnColor, depth, personality, elo } = e.data.payload;
          const timeParams = {
            elo: elo,
            personality: personality,
            maxDepth: depth,
          };
          const bestMove = await getBestMoveDetailed(board, turnColor, depth, timeParams);
          (self as any).postMessage({
            type: 'SEARCH_RESULT',
            id: e.data.id,
            payload: bestMove,
          });
          return;
        }
        (logger as any).warn('Unknown message type:', type);
      }
    }
  } catch (error) {
    (logger as any).error('[AI Worker] Error handling message:', error);
  }
};
