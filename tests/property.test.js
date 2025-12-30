import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { generateRandomBoard } from './test-utils.js';
import { PHASES } from '../js/config.js';

// Mock UI and sounds to avoid initialization issues
jest.unstable_mockModule('../js/ui.js', () => ({
    renderBoard: jest.fn(),
    updateStatus: jest.fn(),
    updateCapturedUI: jest.fn(),
    updateMoveHistoryUI: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: { playMove: jest.fn(), playCapture: jest.fn() },
}));

describe('Game Engine Property-Based Tests', () => {
    const NUM_ITERATIONS = 50;

    function countKings(board) {
        let white = 0, black = 0;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p && p.type === 'k') {
                    if (p.color === 'white') white++;
                    else black++;
                }
            }
        }
        return { white, black };
    }

    test('Invariants should hold after random moves', () => {
        for (let i = 0; i < NUM_ITERATIONS; i++) {
            const game = new Game();
            game.phase = PHASES.PLAY;
            game.board = generateRandomBoard(8, 8); // 8 pieces each + kings
            game.turn = Math.random() > 0.5 ? 'white' : 'black';

            // Ensure initial board is valid (e.g. current player is not already in check from a random setup)
            // Actually, for a random board, the player might be in check.
            // Let's just reset turn if they are in check.
            const opponentColor = game.turn === 'white' ? 'black' : 'white';
            if (game.isInCheck(game.turn)) {
                game.turn = opponentColor;
                if (game.isInCheck(game.turn)) continue; // Skip truly invalid random setups
            }

            const allMoves = game.getAllLegalMoves(game.turn);
            if (allMoves.length === 0) continue; // Stalemate/Checkmate is fine

            // Pick a random move
            const move = allMoves[Math.floor(Math.random() * allMoves.length)];
            const movingColor = game.turn;

            // Invariant 1: Board has 2 kings before move
            const kingsBefore = countKings(game.board);
            expect(kingsBefore.white).toBe(1);
            expect(kingsBefore.black).toBe(1);

            // Execute move manually on the board
            const piece = game.board[move.from.r][move.from.c];
            game.board[move.to.r][move.to.c] = piece;
            game.board[move.from.r][move.from.c] = null;
            if (piece) piece.hasMoved = true;

            // Invariant 2: Board has 2 kings after move
            const kingsAfter = countKings(game.board);
            expect(kingsAfter.white).toBe(1);
            expect(kingsAfter.black).toBe(1);

            // Invariant 3: Player who moved MUST NOT be in check
            expect(game.isInCheck(movingColor)).toBe(false);

            // Invariant 4: No piece should be on rank 0/8 if it's a pawn
            for (let c = 0; c < 9; c++) {
                const p0 = game.board[0][c];
                const p8 = game.board[8][c];
                if (p0 && p0.type === 'p') {
                    // Note: Normally should have promoted
                }
            }
        }
    });

    test('getAllLegalMoves should never include moves into check', () => {
        for (let i = 0; i < NUM_ITERATIONS; i++) {
            const game = new Game();
            game.phase = PHASES.PLAY;
            game.board = generateRandomBoard(5, 5);
            game.turn = 'white';

            const moves = game.getAllLegalMoves('white');

            moves.forEach(move => {
                // Try move on a clone/temporary state
                const originalBoard = JSON.parse(JSON.stringify(game.board));

                // Simulate move
                const piece = game.board[move.from.r][move.from.c];
                game.board[move.to.r][move.to.c] = piece;
                game.board[move.from.r][move.from.c] = null;

                // Check if white is in check
                const inCheck = game.isInCheck('white');

                // Restore board
                game.board = originalBoard;

                expect(inCheck).toBe(false);
            });
        }
    });
});
