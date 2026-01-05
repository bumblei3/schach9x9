/**
 * Tests for Smart Time Management
 */

import { jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../../js/logger.js', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const { getBestMove, resetNodesEvaluated, resetActiveConfig } = await import(
    '../../js/ai/Search.js'
);
const { clearTT } = await import('../../js/ai/TranspositionTable.js');

function createEmptyBoard() {
    return Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
}

describe('Smart Time Management', () => {
    beforeEach(() => {
        resetNodesEvaluated();
        clearTT();
    });

    test('should respect strict hard limit', () => {
        // Setup a complex position where search would normally go deep
        // Two Queens and many pieces
        const board = createEmptyBoard();
        board[0][0] = { type: 'k', color: 'black' };
        board[8][8] = { type: 'k', color: 'white' };
        board[4][4] = { type: 'q', color: 'white' };
        board[4][5] = { type: 'q', color: 'black' };
        board[2][2] = { type: 'r', color: 'white' };
        board[6][6] = { type: 'r', color: 'black' };

        const startTime = Date.now();
        const timeLimit = 100; // 100ms hard limit

        // Request deep search (depth 20) with small time limit
        getBestMove(board, 'white', 20, 'expert', 1, null, null, timeLimit);

        const duration = Date.now() - startTime;

        // Should stop roughly around 100ms (allow some margin for setup/overhead)
        // The check is inside ID loop, so might overshoot slightly if one depth takes long
        expect(duration).toBeLessThan(300); // 3x margin just in case of environment lag
    });

    test('should use soft limit if stable', () => {
        // Setup a position with ONE obvious move (King escape from check)
        // This should stabilize quickly. Soft limit logic should trigger.
        const board = createEmptyBoard();
        board[0][0] = { type: 'k', color: 'black' };
        board[8][4] = { type: 'k', color: 'white' };
        // White King in check by Rook
        board[8][0] = { type: 'r', color: 'black' };

        // Only one escape or few escapes.
        // Search should stabilize on the best escape instantly.

        const startTime = Date.now();
        const timeLimit = 500;
        // Soft limit ~300ms.

        getBestMove(board, 'white', 20, 'expert', 1, null, null, timeLimit);

        const duration = Date.now() - startTime;

        // Should stop way before 500ms (typically < 300ms if stable)
        // Actually if soft limit is 300ms, and it stabilizes at depth 1, 2, 3...
        // It might run UNTIL 300ms and then stop because it's stable.
        // So duration should be >= softLimit? 
        // Not necessarily. If it hits depth 20 before softLimit, it stops.
        // But depth 20 is deep.
        // So it should run until softLimit (300ms) and then break because stable.
        // So duration should be around 300ms, not 500ms.

        // Let's expect it to be less than full timeLimit * 0.9 (since hard limit safety buffer is 0.9)
        // If it extended to hard limit, it would be close to 500.
        expect(duration).toBeLessThan(timeLimit * 0.9);
    });
});
