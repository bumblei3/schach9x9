/**
 * Bridge for WebAssembly Chess 9x9 Engine
 */

import init, { get_best_move_wasm } from '../../engine-wasm/pkg/engine_wasm.js';
import { logger } from '../logger.js';

let wasmInitialized = false;
let initializing = false;
let nodesEvaluated = 0;

/**
 * Ensures the Wasm module is initialized.
 */
export async function ensureWasmInitialized() {
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

    // Check if we are in Node.js to use filesystem instead of fetch
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const url = await import('node:url');

      const __filename = url.fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const wasmPath = path.resolve(__dirname, '../../engine-wasm/pkg/engine_wasm_bg.wasm');

      const wasmBuffer = await fs.readFile(wasmPath);
      await init(wasmBuffer);
    } else {
      // Standard wasm-bindgen init for browser
      await init();
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
 * @param {Array} boardIntArray - Flattened board array (Int8)
 * @param {string} turnColor - 'white' or 'black'
 * @param {number} depth - Search depth
 * @param {string} personality - AI personality
 * @returns {Object|null} { move, score }
 */
export async function getBestMoveWasm(boardIntArray, turnColor, depth, personality = 'NORMAL') {
  const initialized = await ensureWasmInitialized();
  if (!initialized) return null;

  try {
    const boardJson = JSON.stringify(Array.from(boardIntArray));
    const resultJson = get_best_move_wasm(boardJson, turnColor, depth, personality);
    const [bestMove, score, nodes] = JSON.parse(resultJson);

    nodesEvaluated = nodes || 0;

    if (!bestMove) return { move: null, score };

    // Convert Wasm move format to engine format
    return {
      move: {
        from: bestMove.from,
        to: bestMove.to,
        promotion: bestMove.promotion ? mapIntToPiece(bestMove.promotion) : undefined,
      },
      score,
    };
  } catch (error) {
    logger.error('[WasmBridge] getBestMoveWasm call failed:', error);
    return null;
  }
}

/**
 * Returns nodes evaluated in the last Wasm search.
 */
export function getWasmNodesEvaluated() {
  return nodesEvaluated;
}

/**
 * Resets nodes evaluated count.
 */
export function resetWasmNodesEvaluated() {
  nodesEvaluated = 0;
}

function mapIntToPiece(val) {
  const map = {
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
