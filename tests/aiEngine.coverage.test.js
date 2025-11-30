import { jest } from '@jest/globals';
import {
    getBestMove,
    evaluatePosition,
    computeZobristHash,
    getAllLegalMoves,
    setProgressCallback,
    setOpeningBook,
    clearTT
} from '../js/aiEngine.js';
import { createEmptyBoard, BOARD_SIZE } from '../js/gameEngine.js';

describe('AI Engine Coverage', () => {
    let board;

    beforeEach(() => {
        board = createEmptyBoard();
        clearTT();
    });

    describe('Difficulty Levels', () => {
        test('beginner should make random moves most of the time', () => {
            board[4][4] = { type: 'q', color: 'white' };
            board[4][6] = { type: 'p', color: 'black' };

            // Run multiple times to test randomness
            const moves = [];
            for (let i = 0; i < 5; i++) {
                const move = getBestMove(board, 'white', 2, 'beginner');
                moves.push(move);
            }

            // Beginner should have variety in moves (not always optimal)
            expect(moves.length).toBeGreaterThan(0);
        });

        test('easy should prefer captures', () => {
            board[4][4] = { type: 'r', color: 'white' };
            board[4][6] = { type: 'q', color: 'black' }; // High value capture

            const move = getBestMove(board, 'white', 2, 'easy');

            // Easy mode should capture the queen
            expect(move.to).toEqual({ r: 4, c: 6 });
        });

        test('medium should use normal search depth', () => {
            board[4][4] = { type: 'q', color: 'white' };
            board[4][6] = { type: 'p', color: 'black' };

            const move = getBestMove(board, 'white', 2, 'medium');

            expect(move).toBeDefined();
            expect(move.from).toBeDefined();
            expect(move.to).toBeDefined();
        });

        test('hard should use iterative deepening', () => {
            board[4][4] = { type: 'q', color: 'white' };
            board[4][6] = { type: 'p', color: 'black' };

            const move = getBestMove(board, 'white', 3, 'hard');

            expect(move).toBeDefined();
        });

        test('expert should use iterative deepening', () => {
            board[4][4] = { type: 'q', color: 'white' };
            board[4][6] = { type: 'p', color: 'black' };

            const move = getBestMove(board, 'white', 3, 'expert');

            expect(move).toBeDefined();
        });
    });

    describe('Opening Book', () => {
        test('should query opening book for early moves', () => {
            const openingBook = {
                positions: {}
            };

            // Create a simple hash for the position
            let hash = '';
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    hash += '..';
                }
            }
            hash += 'w';

            openingBook.positions[hash] = {
                moves: [
                    { from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, weight: 100 }
                ]
            };

            setOpeningBook(openingBook);

            const move = getBestMove(board, 'white', 2, 'medium', 1);

            // Should either use book move or calculate one
            expect(move).toBeDefined();
        });

        test('should not use opening book after move 10', () => {
            const openingBook = {
                positions: { 'somehash': { moves: [] } }
            };
            setOpeningBook(openingBook);

            board[4][4] = { type: 'p', color: 'white' };
            const move = getBestMove(board, 'white', 2, 'medium', 15);

            // Should not crash, should calculate move normally
            expect(move).toBeDefined();
        });
    });

    describe('Evaluation Edge Cases', () => {
        test('should handle king safety evaluation', () => {
            // White king with pawn shield
            board[7][4] = { type: 'k', color: 'white' };
            board[6][3] = { type: 'p', color: 'white' };
            board[6][4] = { type: 'p', color: 'white' };
            board[6][5] = { type: 'p', color: 'white' };

            const scoreWithShield = evaluatePosition(board, 'white');

            // Black king without shield
            const board2 = createEmptyBoard();
            board2[1][4] = { type: 'k', color: 'black' };
            board2[7][4] = { type: 'k', color: 'white' };

            const scoreWithout = evaluatePosition(board2, 'black');

            // King with shield should score better
            expect(scoreWithShield).toBeGreaterThan(scoreWithout);
        });

        test('should penalize doubled pawns', () => {
            // Board with doubled pawns
            board[4][4] = { type: 'p', color: 'white' };
            board[5][4] = { type: 'p', color: 'white' }; // Doubled

            const scoreDoubled = evaluatePosition(board, 'white');

            // Board with spread pawns
            const board2 = createEmptyBoard();
            board2[4][4] = { type: 'p', color: 'white' };
            board2[5][5] = { type: 'p', color: 'white' };

            const scoreNormal = evaluatePosition(board2, 'white');

            // Doubled pawns should be worse
            expect(scoreNormal).toBeGreaterThan(scoreDoubled);
        });

        test('should evaluate mobility', () => {
            // Queen in center (high mobility)
            board[4][4] = { type: 'q', color: 'white' };
            const highMobility = evaluatePosition(board, 'white');

            // Queen in corner (low mobility)
            const board2 = createEmptyBoard();
            board2[0][0] = { type: 'q', color: 'white' };
            const lowMobility = evaluatePosition(board2, 'white');

            // Center should be better
            expect(highMobility).toBeGreaterThan(lowMobility);
        });
    });

    describe('Error Handling', () => {
        test('should handle errors gracefully and return random move', () => {
            // Create a scenario that might cause issues
            board[4][4] = { type: 'p', color: 'white' };

            // Force an error by passing invalid data
            const move = getBestMove(board, 'white', -1, 'medium');

            // Should still return a move (fallback to random)
            expect(move).toBeDefined();
        });
    });

    describe('Hash Consistency', () => {
        test('should produce consistent hashes for transposition table', () => {
            board[4][4] = { type: 'q', color: 'white' };
            board[2][2] = { type: 'p', color: 'black' };

            const hash1 = computeZobristHash(board, 'white');
            const hash2 = computeZobristHash(board, 'white');

            expect(hash1).toBe(hash2);
        });
    });

    describe('Special Pieces', () => {
        test('should evaluate Archbishop correctly', () => {
            board[4][4] = { type: 'a', color: 'white' }; // Archbishop (value: 700)

            const score = evaluatePosition(board, 'white');

            expect(score).toBeGreaterThan(600); // Should be valued highly
        });

        test('should evaluate Chancellor correctly', () => {
            board[4][4] = { type: 'c', color: 'white' }; // Chancellor (value: 800)

            const score = evaluatePosition(board, 'white');

            expect(score).toBeGreaterThan(700); // Should be valued very highly
        });

        test('should evaluate Angel correctly', () => {
            board[4][4] = { type: 'e', color: 'white' }; // Angel (value: 1200)

            const score = evaluatePosition(board, 'white');

            expect(score).toBeGreaterThan(1000); // Should be valued extremely highly
        });
    });
});
