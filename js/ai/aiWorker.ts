/**
 * Web Worker for Chess 9x9 AI Calculations
 * Prevents UI freezing during minimax search
 */

import { logger } from '../logger.js';
import { setCurrentBoardShape, type BoardShape } from '../config.js';
import {
  getBestMoveDetailed,
  getTopMoves,
  evaluatePosition,
  setOpeningBook,
  setProgressCallback,
  type AIProgressData,
  type SearchResult,
} from '../aiEngine.js';

const workerSelf: Worker = self as unknown as Worker;

const workerHeartbeats: Record<string | number, number> = {};

self.onmessage = async function (e: MessageEvent) {
  try {
    const { type, data, id } = e.data;

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

      case 'setBoardShape': {
        const shape = data?.shape as BoardShape;
        if (shape) {
          setCurrentBoardShape(shape);
          logger.debug('[AI Worker] Board shape set to:', shape);
        }
        break;
      }

      case 'getBestMove': {
        const { board, color, depth, config, personality, moveNumber } = data;

        if (id !== undefined) workerHeartbeats[id] = Date.now();

        // Setup progress callback + heartbeat
        const heartbeatInterval = setInterval(() => {
          if (id !== undefined)
            workerSelf.postMessage({ type: 'heartbeat', id, data: { ts: Date.now() } });
        }, 1000);

        setProgressCallback((progress: AIProgressData) => {
          workerSelf.postMessage({ type: 'progress', id, data: progress });
        });

        try {
          const timeParams = {
            elo: config?.elo,
            personality: personality || config?.personality,
            maxDepth: depth,
          };
          const result = await getBestMoveDetailed(board, color, depth, timeParams, moveNumber);
          workerSelf.postMessage({ type: 'bestMove', id, data: result });
        } catch (error) {
          logger.error('[AI Worker] getBestMove failed:', error);
          workerSelf.postMessage({ type: 'bestMove', id, data: null });
        } finally {
          clearInterval(heartbeatInterval);
        }
        break;
      }

      case 'evaluatePosition': {
        const { board: evalBoard, forColor } = data;
        const score = await evaluatePosition(evalBoard, forColor);
        workerSelf.postMessage({ type: 'positionScore', id, data: score });
        break;
      }

      case 'getTopMoves': {
        const { board, color, count, depth, maxTimeMs, moveNumber } = data;
        try {
          const topMoves = await getTopMoves(board, color, count, depth, maxTimeMs, moveNumber);
          workerSelf.postMessage({ type: 'topMoves', id, data: topMoves });
        } catch (error) {
          logger.error('[AI Worker] getTopMoves failed:', error);
          workerSelf.postMessage({ type: 'topMoves', id, data: [] });
        }
        break;
      }

      case 'analyze': {
        const { board, color, depth = 4, topMovesCount = 3 } = data;

        setProgressCallback(progress => {
          workerSelf.postMessage({ type: 'progress', id, data: progress });
        });

        // Build an analysis result with BOTH an overall score (from a deep
        // search) and the ranked top candidate moves (what the UI expects).
        // analyzePosition() returns a SearchResult (score/pv) but the UI's
        // AnalysisUI.update() reads `topMoves[]`, so we fetch them explicitly.
        const search = await getBestMoveDetailed(board, color, depth, {});
        const topMoves = await getTopMoves(
          board,
          color,
          topMovesCount,
          depth,
          8000,
          0
        );

        workerSelf.postMessage({
          type: 'analysis',
          id,
          data: {
            score: search?.score ?? 0,
            depth: search?.depth ?? depth,
            nodes: search?.nodes ?? 0,
            topMoves: topMoves
              .filter((t: SearchResult) => t.move != null)
              .map((t: SearchResult) => ({
                move: t.move as { from: { r: number; c: number }; to: { r: number; c: number } },
                score: t.score,
                notation: `${t.move!.from.r},${t.move!.from.c}->${t.move!.to.r},${t.move!.to.c}`,
              })),
          },
        });
        break;
      }

      case 'search': {
        const { board, color, depth, personality } = data;

        if (id !== undefined) workerHeartbeats[id] = Date.now();

        const heartbeatInterval = setInterval(() => {
          if (id !== undefined)
            workerSelf.postMessage({ type: 'heartbeat', id, data: { ts: Date.now() } });
        }, 1000);

        try {
          const timeParams = {
            personality,
            maxDepth: depth,
          };
          const result = await getBestMoveDetailed(board, color, depth, timeParams);
          // Send back as 'bestMove' to match what AIController.getHint expects
          // result contains { bestMove, score, pv, ... }
          workerSelf.postMessage({ type: 'bestMove', id, ...result });
        } catch (error) {
          logger.error('[AI Worker] search failed:', error);
          workerSelf.postMessage({ type: 'bestMove', id, bestMove: null });
        } finally {
          clearInterval(heartbeatInterval);
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
          workerSelf.postMessage({
            type: 'SEARCH_RESULT',
            id: e.data.id,
            payload: bestMove,
          });
          return;
        }
        logger.warn('Unknown message type:', type);
      }
    }
  } catch (error) {
    logger.error('[AI Worker] Error handling message:', error);
  }
};
