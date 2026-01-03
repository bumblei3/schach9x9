import { describe, test, expect } from '@jest/globals';
import * as AIEngine from '../js/aiEngine.js';
import { Game } from '../js/gameEngine.js';

describe('AIEngine Integration', () => {
    let game;

    beforeEach(() => {
        game = new Game(15, 'classic');
    });

    test('analyzePosition re-export functionality', () => {
        const board = Array(9)
            .fill(null)
            .map(() => Array(9).fill(null));
        board[7][4] = { type: 'k', color: 'white' };
        board[1][4] = { type: 'k', color: 'black' };
        const result = AIEngine.analyzePosition(board, 'white', 1);
        expect(result).toBeDefined();
        // The return object from analyzePosition in Search.js is { score, depth, nodes, pv, bestMove }
        expect(result.score).toBeDefined();
    });

    test('getBestMove re-export functionality', () => {
        const board = Array(9)
            .fill(null)
            .map(() => Array(9).fill(null));
        board[7][4] = { type: 'k', color: 'white' };
        board[1][4] = { type: 'k', color: 'black' };
        const result = AIEngine.getBestMove(board, 'white', 1, 'hard', 1);
        console.log('Result of getBestMove:', result);
        expect(result).toBeDefined();
        expect(result.from).toBeDefined();
    });

    test('evaluatePosition re-export functionality', () => {
        const score = AIEngine.evaluatePosition(game.board, 'white');
        expect(typeof score).toBe('number');
    });

    test('extractPV re-export functionality', () => {
        AIEngine.getBestMove(game.board, 'white', 2, 'hard', 1);
        const pv = AIEngine.extractPV(game.board, 'white', 2);
        expect(Array.isArray(pv)).toBe(true);
    });
});
