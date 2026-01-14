/**
 * wasmBridge Tests
 * Coverage target: 70% -> 85%+
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  ensureWasmInitialized,
  getBestMoveWasm,
  getWasmNodesEvaluated,
  resetWasmNodesEvaluated,
} from '../../js/ai/wasmBridge.js';

// Mock logger
vi.mock('../../js/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the wasm module
vi.mock('../../engine-wasm/pkg/engine_wasm.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  get_best_move_wasm: vi.fn(() =>
    JSON.stringify([{ from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, promotion: null }, 50, 1000])
  ),
}));

describe('wasmBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureWasmInitialized()', () => {
    test('should initialize wasm module', async () => {
      const result = await ensureWasmInitialized();
      expect(result).toBe(true);
    });

    test('should return cached result on subsequent calls', async () => {
      await ensureWasmInitialized();
      const result = await ensureWasmInitialized();
      expect(result).toBe(true);
    });
  });

  describe('getBestMoveWasm()', () => {
    test('should return best move in correct format', async () => {
      const board = Array(81).fill(0);
      const result = await getBestMoveWasm(board, 'white', 4, 'NORMAL', 2000);

      expect(result).toBeDefined();
      expect(result.move).toHaveProperty('from');
      expect(result.move).toHaveProperty('to');
      expect(result.score).toBe(50);
    });

    test('should pass personality and elo to wasm', async () => {
      const board = Array(81).fill(0);
      await getBestMoveWasm(board, 'white', 6, 'AGGRESSIVE', 1500);

      const wasmModule = await import('../../engine-wasm/pkg/engine_wasm.js');
      expect(wasmModule.get_best_move_wasm).toHaveBeenCalledWith(
        board,
        'white',
        6,
        'AGGRESSIVE',
        1500
      );
    });
  });

  describe('getWasmNodesEvaluated()', () => {
    test('should return node count after search', async () => {
      const board = Array(81).fill(0);
      await getBestMoveWasm(board, 'white', 4);

      const nodes = getWasmNodesEvaluated();
      expect(nodes).toBe(1000);
    });
  });

  describe('resetWasmNodesEvaluated()', () => {
    test('should reset node count to zero', async () => {
      const board = Array(81).fill(0);
      await getBestMoveWasm(board, 'white', 4);
      expect(getWasmNodesEvaluated()).toBe(1000);

      resetWasmNodesEvaluated();
      expect(getWasmNodesEvaluated()).toBe(0);
    });
  });
});
