/**
 * Bridge for WebAssembly Chess 9x9 Engine
 */

import { logger } from '../logger.js';

// Dynamic import for WASM module
let wasmModule: typeof import('../../engine-wasm/pkg/engine_wasm.js') | null = null;
let initPromise: Promise<boolean> | null = null;
let nodesEvaluated = 0;

/**
 * Ensures the Wasm module is initialized.
 */
export async function ensureWasmInitialized(): Promise<boolean> {
  if (wasmModule) return true;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamic import of WASM module
      const module = await import('../../engine-wasm/pkg/engine_wasm.js');

      // Check if we're in Node.js
      const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

      if (isNode) {
        // In Node.js, we need to pass the WASM file buffer
        const fs = await import('fs');
        const path = await import('path');
        const url = await import('url');

        const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
        const wasmPath = path.join(__dirname, '../../engine-wasm/pkg/engine_wasm_bg.wasm');
        const wasmBuffer = fs.readFileSync(wasmPath);

        await module.default(wasmBuffer);
      } else {
        // In browser, default init works
        await module.default();
      }

      wasmModule = module;
      logger.info('[WasmBridge] WASM engine initialized successfully');
      return true;
    } catch (err) {
      logger.error('[WasmBridge] Failed to initialize WASM engine:', err);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Calls the Wasm best move search.
 */
export async function getBestMoveWasm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  boardIntArray: any,
  turnColor: string,
  depth: number,
  personality: string = 'NORMAL',
  elo: number = 2500
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const initialized = await ensureWasmInitialized();
  if (!initialized || !wasmModule) {
    return null;
  }

  try {
    // Convert to Int8Array if needed
    const boardBytes = boardIntArray instanceof Int8Array
      ? boardIntArray
      : new Int8Array(boardIntArray);

    const resultJson = wasmModule.get_best_move_wasm(
      boardBytes,
      turnColor,
      depth,
      personality,
      elo
    );

    const [move, score, nodes] = JSON.parse(resultJson);
    nodesEvaluated = nodes || 0;

    // At depth 0 (eval-only), move will be null
    if (!move && depth > 0) {
      return null;
    }

    // Convert move format from WASM to JS
    return {
      move: move ? {
        from: { r: Math.floor(move.from / 9), c: move.from % 9 },
        to: { r: Math.floor(move.to / 9), c: move.to % 9 },
        promotion: move.promotion ? mapIntToPiece(move.promotion) : undefined,
      } : null,
      score,
      nodes,
    };
  } catch (err) {
    logger.error('[WasmBridge] WASM search failed:', err);
    return null;
  }
}

export function getWasmNodesEvaluated(): number {
  return nodesEvaluated;
}

export function resetWasmNodesEvaluated(): void {
  nodesEvaluated = 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIntToPiece(val: number): string {
  const map: Record<number, string> = {
    1: 'p',
    2: 'n',
    3: 'b',
    4: 'r',
    5: 'q',
    7: 'a',
    8: 'c',
    9: 'e',
  };
  return map[val] || 'q';
}

// Keep export for compatibility
export { mapIntToPiece };
