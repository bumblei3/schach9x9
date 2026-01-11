/**
 * Web Worker for AI Engine
 * Handles heavy Wasm search operations off the main thread.
 */

import { getBestMoveWasm } from './wasmBridge.js';

// Simple logger for worker
const workerLogger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (...args: any[]) => console.log('[AiWorker]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error('[AiWorker]', ...args),
};

interface SearchPayload {
  board: number[] | Int8Array;
  turnColor: string;
  depth: number;
  personality: string;
  elo: number;
}

interface WorkerMessageData {
  type: string;
  payload?: SearchPayload;
  id?: string;
}

self.onmessage = async (e: MessageEvent<WorkerMessageData>) => {
  const { type, payload, id } = e.data;

  if (type === 'SEARCH' && payload) {
    const { board, turnColor, depth, personality, elo } = payload;

    try {
      const start = performance.now();
      const result = await getBestMoveWasm(board, turnColor, depth, personality, elo);
      const duration = performance.now() - start;

      postMessage({
        type: 'SEARCH_RESULT',
        id,
        payload: result,
        meta: { duration },
      });
    } catch (err: any) {
      workerLogger.error('Search failed', err);
      postMessage({
        type: 'SEARCH_ERROR',
        id,
        error: err.toString(),
      });
    }
  }
};

workerLogger.info('Worker initialized');
