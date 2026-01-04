import { jest } from '@jest/globals';
import {
    computeZobristHash,
    updateZobristHash,
    storeTT,
    probeTT,
    clearTT,
    getZobristTable,
    TT_EXACT,
    getXORSideToMove,
} from '../../js/ai/TranspositionTable.js';
import { BOARD_SIZE } from '../../js/config.js';

describe('Zobrist Hashing Verification', () => {
    let board;

    beforeEach(() => {
        board = Array(BOARD_SIZE)
            .fill(null)
            .map(() => Array(BOARD_SIZE).fill(null));
        clearTT();
    });

    test('updateZobristHash matches computeZobristHash after simple move', () => {
        board[0][0] = { type: 'k', color: 'white' };
        const hash1 = computeZobristHash(board, 'white');

        // Move King to 0,1
        board[0][0] = null;
        board[0][1] = { type: 'k', color: 'white' };
        const hash2 = computeZobristHash(board, 'black');

        // Incremental update
        const incrementalHash = updateZobristHash(
            hash1,
            { r: 0, c: 0 },
            { r: 0, c: 1 },
            { type: 'k', color: 'white' },
            null,
            null
        );

        expect(incrementalHash.toString()).toBe(hash2.toString());
    });

    test('updateZobristHash matches after capture', () => {
        board[0][0] = { type: 'r', color: 'white' };
        board[0][1] = { type: 'p', color: 'black' };
        const hash1 = computeZobristHash(board, 'white');

        // Capture
        board[0][0] = null;
        board[0][1] = { type: 'r', color: 'white' };
        const hash2 = computeZobristHash(board, 'black');

        const incrementalHash = updateZobristHash(
            hash1,
            { r: 0, c: 0 },
            { r: 0, c: 1 },
            { type: 'r', color: 'white' },
            { type: 'p', color: 'black' },
            null
        );

        expect(incrementalHash.toString()).toBe(hash2.toString());
    });

    test('updateZobristHash matches after En Passant', () => {
        // Setup En Passant scenario
        board[3][3] = { type: 'p', color: 'white' };
        board[3][4] = { type: 'p', color: 'black' };
        const hash1 = computeZobristHash(board, 'white');

        // White captures EP: Moves to 2,4, removes Black pawn at 3,4
        board[3][3] = null;
        board[2][4] = { type: 'p', color: 'white' };
        board[3][4] = null;
        const hash2 = computeZobristHash(board, 'black');

        const undoInfo = {
            enPassantRow: 3,
            enPassantCol: 4,
            enPassantCaptured: { type: 'p', color: 'black' }
        };

        const incrementalHash = updateZobristHash(
            hash1,
            { r: 3, c: 3 },
            { r: 2, c: 4 },
            { type: 'p', color: 'white' },
            null,
            undoInfo
        );

        expect(incrementalHash.toString()).toBe(hash2.toString());
    });

    test('updateZobristHash matches after Castling', () => {
        board[0][4] = { type: 'k', color: 'black' };
        board[0][0] = { type: 'r', color: 'black' };
        const hash1 = computeZobristHash(board, 'black');

        // Castle Queenside
        board[0][4] = null;
        board[0][2] = { type: 'k', color: 'black' };
        board[0][0] = null;
        board[0][3] = { type: 'r', color: 'black' };
        const hash2 = computeZobristHash(board, 'white');

        const undoInfo = {
            castling: {
                rook: { type: 'r', color: 'black' },
                rookFrom: { r: 0, c: 0 },
                rookTo: { r: 0, c: 3 }
            }
        };

        const incrementalHash = updateZobristHash(
            hash1,
            { r: 0, c: 4 },
            { r: 0, c: 2 },
            { type: 'k', color: 'black' },
            null,
            undoInfo
        );

        expect(incrementalHash.toString()).toBe(hash2.toString());
    });

    test('updateZobristHash matches after promotion', () => {
        board[1][0] = { type: 'p', color: 'white' };
        const hash1 = computeZobristHash(board, 'white');

        // Promote
        board[1][0] = null;
        board[0][0] = { type: 'e', color: 'white' };
        const hash2 = computeZobristHash(board, 'black');

        const undoInfo = {
            promoted: true,
            oldType: 'p'
        };

        const incrementalHash = updateZobristHash(
            hash1,
            { r: 1, c: 0 },
            { r: 0, c: 0 },
            { type: 'e', color: 'white' }, // Piece is now Angel
            null,
            undoInfo
        );

        expect(incrementalHash.toString()).toBe(hash2.toString());
    });

    test('getXORSideToMove should return side to move hash', () => {
        const sideHash = getXORSideToMove();
        expect(typeof sideHash).toBe('number');
    });
});
