/**
 * Tests for AI Improvements:
 * - SEE (Static Exchange Evaluation)
 * - Connected Rooks
 * - Knight/Bishop Outposts
 * - Tempo Bonus
 * - Futility Pruning efficiency
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

const { see } = await import('../../js/ai/MoveGenerator.js');
const { evaluatePosition } = await import('../../js/ai/Evaluation.js');
const { getBestMove, resetNodesEvaluated, getNodesEvaluated, resetActiveConfig } = await import(
    '../../js/ai/Search.js'
);
const { clearTT } = await import('../../js/ai/TranspositionTable.js');

function createEmptyBoard() {
    return Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
}

describe('SEE (Static Exchange Evaluation)', () => {
    test('should return positive for winning captures (PxQ)', () => {
        const board = createEmptyBoard();
        board[4][4] = { type: 'p', color: 'white' };
        board[3][5] = { type: 'q', color: 'black' };

        const seeScore = see(board, { r: 4, c: 4 }, { r: 3, c: 5 });
        expect(seeScore).toBeGreaterThan(700); // Queen value - pawn value
    });

    test('should return positive for equal captures (NxN)', () => {
        const board = createEmptyBoard();
        board[4][4] = { type: 'n', color: 'white' };
        board[2][3] = { type: 'n', color: 'black' };

        const seeScore = see(board, { r: 4, c: 4 }, { r: 2, c: 3 });
        expect(seeScore).toBeGreaterThanOrEqual(0);
    });

    test('should return negative for losing captures (QxP defended by rook)', () => {
        const board = createEmptyBoard();
        board[4][4] = { type: 'q', color: 'white' };
        board[3][4] = { type: 'p', color: 'black' };
        board[3][0] = { type: 'r', color: 'black' }; // Defends 3,4 on same rank

        const seeScore = see(board, { r: 4, c: 4 }, { r: 3, c: 4 });
        expect(seeScore).toBeLessThan(200); // Lose queen for pawn + rook recapture
    });

    test('should detect undefended pieces', () => {
        const board = createEmptyBoard();
        board[4][4] = { type: 'n', color: 'white' };
        board[2][3] = { type: 'r', color: 'black' }; // Hanging rook

        const seeScore = see(board, { r: 4, c: 4 }, { r: 2, c: 3 });
        expect(seeScore).toBeGreaterThan(100); // Win rook for knight
    });

    test('should handle defended by multiple pieces', () => {
        const board = createEmptyBoard();
        board[7][4] = { type: 'r', color: 'white' };
        board[3][4] = { type: 'p', color: 'black' };
        board[2][4] = { type: 'r', color: 'black' }; // Slider defender
        board[4][5] = { type: 'p', color: 'black' }; // Pawn can't defend 3,4 diagonally

        const seeScore = see(board, { r: 7, c: 4 }, { r: 3, c: 4 });
        // Rook takes pawn, Rook recaptures = lose the exchange
        expect(seeScore).toBeLessThan(200);
    });

    test('should return 0 for non-capture', () => {
        const board = createEmptyBoard();
        board[4][4] = { type: 'n', color: 'white' };

        const seeScore = see(board, { r: 4, c: 4 }, { r: 2, c: 3 });
        expect(seeScore).toBe(0);
    });
});

describe('Connected Rooks Bonus', () => {
    test('should give bonus for rooks on same file', () => {
        const boardConnected = createEmptyBoard();
        boardConnected[1][4] = { type: 'r', color: 'white' };
        boardConnected[7][4] = { type: 'r', color: 'white' }; // Same file

        const boardSeparate = createEmptyBoard();
        boardSeparate[1][4] = { type: 'r', color: 'white' };
        boardSeparate[7][6] = { type: 'r', color: 'white' }; // Different file

        const scoreConnected = evaluatePosition(boardConnected, 'white');
        const scoreSeparate = evaluatePosition(boardSeparate, 'white');

        expect(scoreConnected).toBeGreaterThan(scoreSeparate);
    });

    test('should give bonus for rooks on same rank', () => {
        const boardConnected = createEmptyBoard();
        boardConnected[4][1] = { type: 'r', color: 'white' };
        boardConnected[4][7] = { type: 'r', color: 'white' }; // Same rank

        const boardSeparate = createEmptyBoard();
        boardSeparate[4][1] = { type: 'r', color: 'white' };
        boardSeparate[6][7] = { type: 'r', color: 'white' }; // Different rank

        const scoreConnected = evaluatePosition(boardConnected, 'white');
        const scoreSeparate = evaluatePosition(boardSeparate, 'white');

        expect(scoreConnected).toBeGreaterThan(scoreSeparate);
    });

    test('should NOT give bonus if piece between rooks', () => {
        const boardBlocked = createEmptyBoard();
        boardBlocked[1][4] = { type: 'r', color: 'white' };
        boardBlocked[4][4] = { type: 'p', color: 'white' }; // Piece between
        boardBlocked[7][4] = { type: 'r', color: 'white' };

        const boardClear = createEmptyBoard();
        boardClear[1][4] = { type: 'r', color: 'white' };
        boardClear[7][4] = { type: 'r', color: 'white' };
        boardClear[4][0] = { type: 'p', color: 'white' }; // Same material, different position

        const scoreBlocked = evaluatePosition(boardBlocked, 'white');
        const scoreClear = evaluatePosition(boardClear, 'white');

        expect(scoreClear).toBeGreaterThan(scoreBlocked);
    });

    test('should work for black rooks too', () => {
        const boardConnected = createEmptyBoard();
        boardConnected[1][4] = { type: 'r', color: 'black' };
        boardConnected[7][4] = { type: 'r', color: 'black' };

        const boardSeparate = createEmptyBoard();
        boardSeparate[1][4] = { type: 'r', color: 'black' };
        boardSeparate[7][6] = { type: 'r', color: 'black' };

        const scoreConnected = evaluatePosition(boardConnected, 'black');
        const scoreSeparate = evaluatePosition(boardSeparate, 'black');

        expect(scoreConnected).toBeGreaterThan(scoreSeparate);
    });
});

describe('Knight/Bishop Outpost Bonus', () => {
    test('should give bonus for knight on outpost', () => {
        // Knight on forward central square, protected by pawn
        const boardOutpost = createEmptyBoard();
        boardOutpost[3][4] = { type: 'n', color: 'white' }; // Forward, central
        boardOutpost[4][3] = { type: 'p', color: 'white' }; // Protects knight

        const boardNoOutpost = createEmptyBoard();
        boardNoOutpost[3][4] = { type: 'n', color: 'white' };
        boardNoOutpost[7][0] = { type: 'p', color: 'white' }; // Pawn far away

        const scoreOutpost = evaluatePosition(boardOutpost, 'white');
        const scoreNoOutpost = evaluatePosition(boardNoOutpost, 'white');

        expect(scoreOutpost).toBeGreaterThan(scoreNoOutpost);
    });

    test('should give bonus for bishop on outpost', () => {
        const boardOutpost = createEmptyBoard();
        boardOutpost[3][5] = { type: 'b', color: 'white' };
        boardOutpost[4][4] = { type: 'p', color: 'white' }; // Protects

        const boardNoOutpost = createEmptyBoard();
        boardNoOutpost[3][5] = { type: 'b', color: 'white' };
        boardNoOutpost[7][0] = { type: 'p', color: 'white' }; // Not protecting

        const scoreOutpost = evaluatePosition(boardOutpost, 'white');
        const scoreNoOutpost = evaluatePosition(boardNoOutpost, 'white');

        expect(scoreOutpost).toBeGreaterThan(scoreNoOutpost);
    });

    test('should not give outpost bonus if attackable by enemy pawn', () => {
        // Knight on potential outpost, but enemy pawn can attack
        const boardAttackable = createEmptyBoard();
        boardAttackable[3][4] = { type: 'n', color: 'white' };
        boardAttackable[4][3] = { type: 'p', color: 'white' }; // Protects
        boardAttackable[3][3] = { type: 'p', color: 'black' }; // Enemy pawn on adjacent file

        const boardSafe = createEmptyBoard();
        boardSafe[3][4] = { type: 'n', color: 'white' };
        boardSafe[4][3] = { type: 'p', color: 'white' };
        // No enemy pawns on adjacent files

        const scoreAttackable = evaluatePosition(boardAttackable, 'white');
        const scoreSafe = evaluatePosition(boardSafe, 'white');

        expect(scoreSafe).toBeGreaterThan(scoreAttackable);
    });
});

describe('Tempo Bonus', () => {
    test('should give advantage to side to move', () => {
        const board = createEmptyBoard();
        board[4][4] = { type: 'n', color: 'white' };
        board[4][5] = { type: 'n', color: 'black' };

        const scoreWhite = evaluatePosition(board, 'white');
        const scoreBlack = evaluatePosition(board, 'black');

        // Scores should differ by about 10 due to tempo
        expect(scoreWhite - scoreBlack).toBeGreaterThan(5);
    });

    test('empty board should have tempo bonus', () => {
        const board = createEmptyBoard();
        const score = evaluatePosition(board, 'white');
        expect(score).toBe(5); // Tempo bonus for endgame only (10/2)
    });
});

describe('Futility Pruning Efficiency', () => {
    beforeEach(() => {
        resetNodesEvaluated();
        clearTT();
        resetActiveConfig();
    });

    test('should evaluate fewer nodes with futility pruning', () => {
        // Position where futility pruning helps
        const board = createEmptyBoard();
        board[8][4] = { type: 'k', color: 'white' };
        board[0][4] = { type: 'k', color: 'black' };
        board[7][4] = { type: 'p', color: 'white' };
        board[7][3] = { type: 'p', color: 'white' };
        board[7][5] = { type: 'p', color: 'white' };
        board[1][4] = { type: 'p', color: 'black' };
        board[1][3] = { type: 'p', color: 'black' };
        board[1][5] = { type: 'p', color: 'black' };

        // Get move
        getBestMove(board, 'white', 3, 'medium');
        const nodesEvaluated = getNodesEvaluated();

        // Should evaluate a reasonable number of nodes
        // With futility pruning, should be less than brute force
        expect(nodesEvaluated).toBeLessThan(10000);
    });

    test('should still find best move with pruning enabled', () => {
        // Position with clear best move - hanging queen
        const board = createEmptyBoard();
        board[8][4] = { type: 'k', color: 'white' };
        board[0][0] = { type: 'k', color: 'black' };
        board[4][4] = { type: 'r', color: 'white' };
        board[4][7] = { type: 'q', color: 'black' }; // Hanging queen on rook's rank

        const move = getBestMove(board, 'white', 3, 'medium');

        expect(move).toBeDefined();
        expect(move.to).toEqual({ r: 4, c: 7 }); // Should capture queen
    });
});

describe('SEE-based Move Ordering', () => {
    beforeEach(() => {
        resetNodesEvaluated();
        clearTT();
        resetActiveConfig();
    });

    test('should prioritize good captures', () => {
        const board = createEmptyBoard();
        board[8][4] = { type: 'k', color: 'white' };
        board[0][0] = { type: 'k', color: 'black' }; // Away from action
        board[4][4] = { type: 'r', color: 'white' };
        board[4][1] = { type: 'p', color: 'black' }; // Low value on rook's rank
        board[4][7] = { type: 'q', color: 'black' }; // High value on rook's rank

        const move = getBestMove(board, 'white', 2, 'expert');

        // Should prefer capturing the queen (higher SEE score)
        expect(move.to).toEqual({ r: 4, c: 7 });
    });

    test('should avoid bad captures', () => {
        const board = createEmptyBoard();
        board[8][4] = { type: 'k', color: 'white' };
        board[0][0] = { type: 'k', color: 'black' };
        board[4][4] = { type: 'q', color: 'white' }; // Our queen
        board[3][4] = { type: 'p', color: 'black' }; // Pawn
        board[3][0] = { type: 'r', color: 'black' }; // Defends pawn on same rank
        board[4][7] = { type: 'n', color: 'black' }; // Alternative target

        const move = getBestMove(board, 'white', 3, 'expert');

        // Should NOT sacrifice queen for defended pawn
        // Should take free knight or make a safe move
        expect(move.to.r !== 3 || move.to.c !== 4).toBe(true);
    });
});
