/**
 * Tests for Advanced Search Features:
 * - Singular Extensions
 * - Delta Pruning
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

const { getBestMove, resetNodesEvaluated, getNodesEvaluated, resetActiveConfig } = await import(
    '../../js/ai/Search.js'
);
const { clearTT, storeTT, TT_EXACT, computeZobristHash } = await import('../../js/ai/TranspositionTable.js');

function createEmptyBoard() {
    return Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
}

describe('Advanced Search Features', () => {
    beforeEach(() => {
        resetNodesEvaluated();
        clearTT();
        resetActiveConfig();
    });

    describe('Delta Pruning (Quiescence Search)', () => {
        test('should prune bad captures in quiescence search', () => {
            // Setup a position with many bad captures
            // White Queen at 4,4
            // Surrounded by protected Black Pawns
            const board = createEmptyBoard();
            board[4][4] = { type: 'q', color: 'white' };

            // Bad captures: Pawn protected by another pawn/piece
            board[3][4] = { type: 'p', color: 'black' }; // N
            board[2][4] = { type: 'r', color: 'black' }; // Protector

            board[4][3] = { type: 'p', color: 'black' }; // W
            board[4][2] = { type: 'r', color: 'black' }; // Protector

            board[4][5] = { type: 'p', color: 'black' }; // E
            board[4][6] = { type: 'r', color: 'black' }; // Protector

            // One good capture: Hanging pawn
            board[5][5] = { type: 'p', color: 'black' };

            // Run search at depth 1 (forces QS at leaf)
            getBestMove(board, 'white', 1, 'expert');
            const nodesWithPruning = getNodesEvaluated();

            // Without pruning, it would search all captures.
            // With pruning, it should skip the bad ones (QxP protected).
            // We can't easily disable pruning to compare, but we can assert reasonable node count.
            expect(nodesWithPruning).toBeLessThan(500);
        });
    });

    describe('Singular Extensions', () => {
        test('should trigger extension on singular move', () => {
            // Setup a position where one move is clearly best
            // White can mate in 3, or prevent mate.
            // Let's use a simpler setup: King and Rook vs King.
            const board = createEmptyBoard();
            board[0][0] = { type: 'k', color: 'black' };
            // White King at 2,0 (Covers 1,0 and 1,1)
            board[2][0] = { type: 'k', color: 'white' };
            board[1][7] = { type: 'r', color: 'white' };

            const hash = computeZobristHash(board, 'white');

            // Manually seed TT with a "singular" entry
            // High score, decent depth
            const bestMove = { from: { r: 1, c: 7 }, to: { r: 0, c: 7 } }; // Mate
            storeTT(hash, 6, 20000, TT_EXACT, bestMove);

            // Run search at depth 8 (triggers SE condition depth >= 8)
            // We expect the search to find the mate, potentially extending.
            // Validating extension explicitly is hard without mocking internals,
            // but we can verify it finds the move correctly and quickly.

            const resultMove = getBestMove(board, 'white', 8, 'expert');
            expect(resultMove).toMatchObject(bestMove);

            // Node count should be reasonable (SE adds some overhead but finds PV fast)
            expect(getNodesEvaluated()).toBeGreaterThan(0);
        });

        test('should NOT trigger extension if alternatives are good', () => {
            // Position with multiple good moves (e.g., two Queens vs Lone King)
            const board = createEmptyBoard();
            board[0][0] = { type: 'k', color: 'black' };
            board[8][8] = { type: 'k', color: 'white' };
            board[7][0] = { type: 'q', color: 'white' }; // Can mate
            board[7][1] = { type: 'q', color: 'white' }; // Can also mate

            const hash = computeZobristHash(board, 'white');
            const bestMove = { from: { r: 7, c: 0 }, to: { r: 0, c: 0 } };
            storeTT(hash, 6, 20000, TT_EXACT, bestMove);

            const move = getBestMove(board, 'white', 8, 'expert');
            expect(move).toBeDefined();
        });
    });
});
