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

// Map avoids CodeQL js/remote-property-injection (object index from message id).
const workerHeartbeats = new Map<string | number, number>();

/** Only accept finite numbers or short plain strings as correlation ids. */
function sanitizeWorkerId(raw: unknown): string | number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= 64 && /^[\w.-]+$/.test(raw)) {
    return raw;
  }
  return undefined;
}

function touchHeartbeat(id: string | number | undefined): void {
  if (id === undefined) return;
  workerHeartbeats.set(id, Date.now());
}

self.onmessage = async function (e: MessageEvent) {
  try {
    // Dedicated workers only receive from their creating document (same origin).
    // Still reject unexpected origins when the browser sets e.origin.
    if (e.origin && e.origin !== self.location.origin) {
      logger.warn('[AI Worker] Rejected message from unexpected origin:', e.origin);
      return;
    }

    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    const type = (msg as { type?: unknown }).type;
    const data = (msg as { data?: unknown }).data as Record<string, unknown> | undefined;
    const id = sanitizeWorkerId((msg as { id?: unknown }).id);

    if (typeof type !== 'string') {
      logger.warn('[AI Worker] Message missing string type');
      return;
    }

    switch (type) {
      case 'loadBook': {
        if (!data || !data.book) {
          logger.warn('[AI Worker] loadBook called without book data');
          break;
        }
        setOpeningBook(data.book as Parameters<typeof setOpeningBook>[0]);
        logger.info(
          '[AI Worker] Opening book loaded:',
          (data.book as { metadata?: unknown }).metadata
        );
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
        const { board, color, depth, config, personality, moveNumber } = (data ?? {}) as {
          board: Parameters<typeof getBestMoveDetailed>[0];
          color: Parameters<typeof getBestMoveDetailed>[1];
          depth: number;
          config?: { elo?: number; personality?: string };
          personality?: string;
          moveNumber?: number;
        };

        touchHeartbeat(id);

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
        if (!data) break;
        const evalBoard = data.board as Parameters<typeof evaluatePosition>[0];
        const forColor = data.forColor as Parameters<typeof evaluatePosition>[1];
        const score = await evaluatePosition(evalBoard, forColor);
        workerSelf.postMessage({ type: 'positionScore', id, data: score });
        break;
      }

      case 'getTopMoves': {
        if (!data) break;
        try {
          const topMoves = await getTopMoves(
            data.board as Parameters<typeof getTopMoves>[0],
            data.color as Parameters<typeof getTopMoves>[1],
            data.count as number | undefined,
            data.depth as number | undefined,
            data.maxTimeMs as number | undefined,
            data.moveNumber as number | undefined
          );
          workerSelf.postMessage({ type: 'topMoves', id, data: topMoves });
        } catch (error) {
          logger.error('[AI Worker] getTopMoves failed:', error);
          workerSelf.postMessage({ type: 'topMoves', id, data: [] });
        }
        break;
      }

      case 'analyze': {
        if (!data) break;
        const board = data.board as Parameters<typeof getTopMoves>[0];
        const color = data.color as Parameters<typeof getTopMoves>[1];
        const depth = typeof data.depth === 'number' ? data.depth : 4;
        const topMovesCount = typeof data.topMovesCount === 'number' ? data.topMovesCount : 3;

        setProgressCallback(progress => {
          workerSelf.postMessage({ type: 'progress', id, data: progress });
        });

        // NOTE: use the TIME-BOUNDED getTopMoves (maxTimeMs below) for the
        // ranked candidates AND the overall score (best move's score). Do NOT
        // call getBestMoveDetailed(board, color, depth, {}) here — an empty
        // timeParams means an UNBOUNDED search, and at analysis depth (12 for
        // the live overlay) that hangs on a 9x9 board and the worker never
        // posts a result back (live analysis never populates).
        const topMoves = await getTopMoves(board, color, topMovesCount, depth, 8000, 0);

        const best = topMoves[0];
        workerSelf.postMessage({
          type: 'analysis',
          id,
          data: {
            score: best?.score ?? 0,
            depth: best?.depth ?? depth,
            nodes: best?.nodes ?? 0,
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
        if (!data) break;
        const board = data.board as Parameters<typeof getBestMoveDetailed>[0];
        const color = data.color as Parameters<typeof getBestMoveDetailed>[1];
        const depth = data.depth as number;
        const personality = data.personality as string | undefined;

        touchHeartbeat(id);

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
          const payload = (msg as { payload?: Record<string, unknown> }).payload;
          if (!payload) break;
          const board = payload.board as Parameters<typeof getBestMoveDetailed>[0];
          const turnColor = payload.turnColor as Parameters<typeof getBestMoveDetailed>[1];
          const depth = payload.depth as number;
          const timeParams = {
            elo: payload.elo as number | undefined,
            personality: payload.personality as string | undefined,
            maxDepth: depth,
          };
          const bestMove = await getBestMoveDetailed(board, turnColor, depth, timeParams);
          workerSelf.postMessage({
            type: 'SEARCH_RESULT',
            id,
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
