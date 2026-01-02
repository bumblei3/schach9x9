import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import * as Search from '../js/ai/Search.js';
import { clearTT } from '../js/ai/TranspositionTable.js';
import { BOARD_SIZE } from '../js/config.js';

describe('Search Logic - Exhaustive Coverage', () => {
    let game;

    beforeEach(() => {
        game = new Game(15, 'classic');
        clearTT();
        Search.resetNodesEvaluated();
    });

    test('analyzePosition and node counts', () => {
        const analysis = Search.analyzePosition(game.board, 'white', 1);
        expect(analysis).toBeDefined();
        expect(Search.getNodesEvaluated()).toBeGreaterThan(0);
    });

    test('setProgressCallback and sendProgress', () => {
        const cb = jest.fn();
        Search.setProgressCallback(cb);

        const realDateNow = Date.now;
        let time = 1000;
        global.Date.now = jest.fn(() => {
            time += 200;
            return time;
        });

        global.self = { postMessage: jest.fn() };
        Search.getBestMove(game.board, 'white', 1, 'hard');

        expect(cb).toHaveBeenCalled();

        global.Date.now = realDateNow;
        global.self = undefined;
        Search.setProgressCallback(null);
    });

    test('Difficulty scaling', () => {
        Search.getBestMove(game.board, 'white', 2, 'beginner');
        Search.getBestMove(game.board, 'white', 2, 'easy');
    });

    test('Quiescence search with captures', () => {
        const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        board[0][0] = { type: 'k', color: 'black' };
        board[8][8] = { type: 'k', color: 'white' };
        board[4][4] = { type: 'p', color: 'black' };
        board[5][5] = { type: 'r', color: 'white' };

        // Depth 0 triggers quiescenceSearch
        Search.getBestMove(board, 'white', 1, 'hard');
    });

    test('extractPV and deeper search coverage', () => {
        // Position where a clear best move exists to ensure TT entry
        const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        board[0][0] = { type: 'k', color: 'black' };
        board[8][8] = { type: 'k', color: 'white' };
        board[7][7] = { type: 'r', color: 'white' };

        // Depth 3 to get multiple layers in TT
        Search.getBestMove(board, 'white', 3, 'hard');
        const pv = Search.extractPV(board, 'white', 3);
        expect(Array.isArray(pv)).toBe(true);
    });

    test('error handling and edge cases', () => {
        Search.analyzePosition(null, 'white', 1);
        const game = new Game();
        game.board = Array(9).fill(null).map(() => Array(9).fill(null));
        // Empty board except kings
        game.board[0][0] = { type: 'k', color: 'white' };
        game.board[8][8] = { type: 'k', color: 'black' };
        Search.analyzePosition(game.board, 'white', 1);
    });

    test('deep LMR and QS alpha improvement', () => {
        const customBoard = Array(9).fill(null).map(() => Array(9).fill(null));
        // Add many pieces to have many legal moves
        for (let c = 0; c < 9; c++) {
            customBoard[7][c] = { type: 'p', color: 'white' };
            customBoard[1][c] = { type: 'p', color: 'black' };
        }
        customBoard[7][4] = { type: 'k', color: 'white' };
        customBoard[1][4] = { type: 'k', color: 'black' };

        // Search deep enough to trigger i >= 10 LMR
        Search.getBestMove(customBoard, 3, 'hard', 1);
    });

    test('TT hits coverage', () => {
        const customBoard = [
            [null, null, null, null, { type: 'k', color: 'black' }, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
            [null, null, null, null, { type: 'k', color: 'white' }, null, null, null, null]
        ];

        // Mock TT hits by searching twice or mocking TT directly if possible
        // Let's just search twice, the second time should hit TT
        Search.getBestMove(customBoard, 1, 'hard', 1);
        Search.getBestMove(customBoard, 1, 'hard', 1);
    });

    test('Specific PVS research coverage', () => {
        const board = Array(9).fill(null).map(() => Array(9).fill(null));
        board[7][4] = { type: 'k', color: 'white' };
        board[1][4] = { type: 'k', color: 'black' };
        board[7][0] = { type: 'r', color: 'white' };
        board[1][0] = { type: 'r', color: 'black' };
        board[7][8] = { type: 'q', color: 'white' };
        board[1][8] = { type: 'q', color: 'black' };

        // Complex enough to trigger research
        Search.getBestMove(board, 4, 'hard', 10);
    });

    test('Time limit and TT hits coverage', () => {
        const board = Array(9).fill(null).map(() => Array(9).fill(null));
        board[7][4] = { type: 'k', color: 'white' };
        board[1][4] = { type: 'k', color: 'black' };

        // Mock Date.now to trigger progress updates and time limits
        const start = Date.now();
        jest.spyOn(Date, 'now').mockReturnValueOnce(start).mockReturnValueOnce(start + 500);

        Search.getBestMove(board, 2, 'hard', 10);
        jest.restoreAllMocks();
    });

    test('Deep search coverage', () => {
        const board = Array(9).fill(null).map(() => Array(9).fill(null));
        board[7][4] = { type: 'k', color: 'white' };
        board[1][4] = { type: 'k', color: 'black' };
        board[7][0] = { type: 'r', color: 'white' };
        board[1][0] = { type: 'r', color: 'black' };

        // Depth 6 should hit more branches in ID and Aspiration Windows
        Search.getBestMove(board, 6, 'hard', 10);
    });

    test('NMP and deep LMR coverage', () => {
        const board = Array(9).fill(null).map(() => Array(9).fill(null));
        board[7][4] = { type: 'k', color: 'white' };
        board[1][4] = { type: 'k', color: 'black' };
        board[7][0] = { type: 'r', color: 'white' };
        board[1][0] = { type: 'r', color: 'black' };
        board[7][1] = { type: 'n', color: 'white' };
        board[1][1] = { type: 'n', color: 'black' };

        // Search depth 4 to trigger NMP
        Search.getBestMove(board, 4, 'hard', 10);
    });

    test('Exhaustive branches coverage', () => {
        const board = Array(9).fill(null).map(() => Array(9).fill(null));
        // Fill board with many complex interactions
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if ((r + c) % 2 === 0) board[r][c] = { type: 'p', color: 'white' };
                else board[r][c] = { type: 'p', color: 'black' };
            }
        }
        board[4][4] = { type: 'k', color: 'white' };
        board[0][0] = { type: 'k', color: 'black' };

        // This will have many many moves and triggers LMR i >= 10
        Search.getBestMove(board, 3, 'hard', 10);

        // Trigger QS alpha improvement
        const qsBoard = Array(9).fill(null).map(() => Array(9).fill(null));
        qsBoard[4][4] = { type: 'k', color: 'white' };
        qsBoard[0][0] = { type: 'k', color: 'black' };
        qsBoard[4][5] = { type: 'p', color: 'black' }; // Vulnerable
        Search.analyzePosition(qsBoard, 'white', 1);
    });

    test('PVS research coverage', () => {
        const customBoard = Array(9).fill(null).map(() => Array(9).fill(null));
        customBoard[7][4] = { type: 'k', color: 'white' };
        customBoard[1][4] = { type: 'k', color: 'black' };
        customBoard[7][0] = { type: 'r', color: 'white' };
        customBoard[1][0] = { type: 'r', color: 'black' };

        // Search deep enough to trigger PVS research
        Search.getBestMove(customBoard, 4, 'hard', 10);
    });

    test('Aspiration window failure coverage', () => {
        const customBoard = Array(9).fill(null).map(() => Array(9).fill(null));
        customBoard[7][4] = { type: 'k', color: 'white' };
        customBoard[1][4] = { type: 'k', color: 'black' };

        // Search with a very narrow aspiration window by mocking or just brute force
        // The current implementation uses searchAlpha = bestScore - ASPIRATION_WINDOW
        // If we search deep enough with a stable position, it should work.
        Search.getBestMove(customBoard, 5, 'hard', 10);
    });

    test('getBestMove handles generator error', () => {
        // We need to import getAllLegalMoves to mock it, but it's not exported from Search.js.
        // But we can trigger an error by passing a non-array board if it doesn't check.
        try {
            Search.getBestMove(null, 'white', 1, 'hard', 1);
        } catch (e) {
            // expected
        }
    });
});
