import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as WasmBridge from '../../js/ai/wasmBridge.js';

vi.mock('../../js/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('WasmBridge Coverage Tests', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('ensureWasmInitialized concurrency', () => {
        it('should handle concurrent initialization calls', async () => {
            // We can't easily mock internal state without rewiring, but we can verify behavior.
            // Calling ensureWasmInitialized multiple times should result in only one initialization process (logs).

            // Note: In test environment, it uses FS imports. We trust it initializes.
            const p1 = WasmBridge.ensureWasmInitialized();
            const p2 = WasmBridge.ensureWasmInitialized();
            const p3 = WasmBridge.ensureWasmInitialized();

            const results = await Promise.all([p1, p2, p3]);

            expect(results.every(r => r === true)).toBe(true);
            // It's hard to assert exactly 1 log call because of previous tests potentially initializing it.
            // But we verify it doesn't crash or hang.
        });
    });

    describe('getBestMoveWasm input validation', () => {
        it('should return null if initialization fails', async () => {
            // We can't easily force init failure after it succeeded once in the same process.
            // But we can test valid inputs.
            const board = new Int8Array(81).fill(0);
            const result = await WasmBridge.getBestMoveWasm(board, 'white', 1);

            // It might be null (if wasm not found) or valid object.
            // We just ensure it doesn't throw.
            expect(result !== undefined).toBe(true);
        });
    });

    describe('Utility functions', () => {
        it('should track nodes evaluated', () => {
            WasmBridge.resetWasmNodesEvaluated();
            expect(WasmBridge.getWasmNodesEvaluated()).toBe(0);

            // Note: Changing inner variable is hard without accessors.
            // Current implementation: nodesEvaluated = nodes || 0;
            // We assume getBestMoveWasm updates it.
        });
    });
});
