/**
 * Bridge for WebAssembly Chess 9x9 Engine
 */

import { logger } from '../logger.js';

let wasmInitialized = false;
let initializing = false;
let nodesEvaluated = 0;

/**
 * Ensures the Wasm module is initialized.
 */
export async function ensureWasmInitialized(): Promise<boolean> {
  if (wasmInitialized) return true;
  if (initializing) {
    // Wait for current initialization
    while (initializing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return wasmInitialized;
  }

  initializing = true;
  try {
    logger.info('[WasmBridge] Initializing Wasm AI Engine...');

    // Check if we are in Node.js (for tests) to use filesystem instead of fetch
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // @ts-ignore
      // Use non-static strings to fully hide from Vite's preload/analysis
      const fsName = ['node', 'fs/promises'].join(':');
      const pathName = ['node', 'path'].join(':');
      const urlName = ['node', 'url'].join(':');

      // @ts-ignore
      const fs = await import(/* @vite-ignore */ fsName);
      // @ts-ignore
      const path = await import(/* @vite-ignore */ pathName);
      // @ts-ignore
      const url = await import(/* @vite-ignore */ urlName);

      const __filename = url.fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const wasmPath = path.resolve(__dirname, '../../engine-wasm/pkg/engine_wasm_bg.wasm');

      const wasmBuffer = await fs.readFile(wasmPath);
      // @ts-ignore
      const wasmModule = await import('../../engine-wasm/pkg/engine_wasm.js');
      await wasmModule.default({ module_or_path: wasmBuffer });
    } else {
      // Standard wasm-bindgen init for browser (Vite/PWA)
      // @ts-ignore
      const wasmModule = await import('../../engine-wasm/pkg/engine_wasm.js');
      await wasmModule.default();
    }

    wasmInitialized = true;
    logger.info('[WasmBridge] Wasm AI Engine initialized successfully.');
  } catch (error) {
    logger.error('[WasmBridge] Failed to initialize Wasm AI Engine:', error);
    wasmInitialized = false;
  } finally {
    initializing = false;
  }
  return wasmInitialized;
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
  if (!initialized) return null;

  try {
    // @ts-ignore
    const wasmModule = await import('../../engine-wasm/pkg/engine_wasm.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultJson = (wasmModule.get_best_move_wasm as any)(
      boardIntArray,
      turnColor,
      depth,
      personality,
      elo
    );
    const [bestMove, score, nodes] = JSON.parse(resultJson);

    nodesEvaluated = nodes || 0;

    if (!bestMove) return { move: null, score };

    // Convert Wasm move format to engine format
    return {
      move: {
        from: bestMove.from,
        to: bestMove.to,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        promotion: bestMove.promotion ? mapIntToPiece(bestMove.promotion) : undefined,
      },
      score,
    };
  } catch (error) {
    logger.error('[WasmBridge] getBestMoveWasm call failed:', error);
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
