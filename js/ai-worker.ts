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

self.onmessage = async function (e: MessageEvent) {
    try {
        const { type, data } = e.data;

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
                const { board, color, depth, config, _timeLimit } = data;
                (logger as any).debug(
                    `[AI Worker] getBestMove started - color:${color} depth:${depth} timeLimit:${_timeLimit}ms`
                );
                // Setup progress callback
                setProgressCallback((progress: any) => {
                    (self as any).postMessage({ type: 'progress', data: progress });
                });

                try {
                    const timeParams = {
                        elo: config?.elo,
                        personality: config?.personality,
                        maxDepth: depth
                    };
                    const bestMove = await getBestMoveDetailed(
                        board,
                        color,
                        depth,
                        timeParams
                    );
                    (self as any).postMessage({ type: 'bestMove', data: bestMove });
                } catch (error) {
                    (logger as any).error('[AI Worker] getBestMove failed:', error);
                    (self as any).postMessage({ type: 'bestMove', data: null });
                }
                break;
            }

            case 'evaluatePosition': {
                const { board: evalBoard, forColor } = data;
                const score = await evaluatePosition(evalBoard, forColor);
                (self as any).postMessage({ type: 'positionScore', data: score });
                break;
            }

            case 'analyze': {
                const { board, color } = data;

                setProgressCallback(progress => {
                    (self as any).postMessage({ type: 'progress', data: progress });
                });
                // Use the new deep analysis function
                const analysis = analyzePosition(board, color); // Removed unsupported args depth, topMovesCount for now

                (self as any).postMessage({
                    type: 'analysis',
                    data: analysis,
                });
                break;
            }

            default: {
                (logger as any).warn('Unknown message type:', type);
            }
        }
    } catch (error) {
        (logger as any).error('[AI Worker] Error handling message:', error);
    }
};
