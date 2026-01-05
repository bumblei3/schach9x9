/**
 * Web Worker for AI Engine
 * Handles heavy Wasm search operations off the main thread.
 */

import { getBestMoveWasm } from './wasmBridge.js';

// Simple logger for worker
const workerLogger = {
    info: (...args) => console.log('[AiWorker]', ...args),
    error: (...args) => console.error('[AiWorker]', ...args),
};

self.onmessage = async (e) => {
    const { type, payload, id } = e.data;

    if (type === 'SEARCH') {
        const { board, turnColor, depth, personality, elo } = payload;

        try {
            const start = performance.now();
            const result = await getBestMoveWasm(board, turnColor, depth, personality, elo);
            const duration = performance.now() - start;

            postMessage({
                type: 'SEARCH_RESULT',
                id,
                payload: result,
                meta: { duration }
            });
        } catch (err) {
            workerLogger.error('Search failed', err);
            postMessage({
                type: 'SEARCH_ERROR',
                id,
                error: err.toString()
            });
        }
    }
};

workerLogger.info('Worker initialized');
