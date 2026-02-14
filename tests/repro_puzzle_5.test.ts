import { describe, expect, test } from 'vitest';
import { PuzzleManager } from '../js/puzzleManager';
import { Game } from '../js/gameEngine';
import { PuzzleGenerator } from '../js/puzzleGenerator';
import { RulesEngine } from '../js/RulesEngine';

describe('Puzzle 5 Logic Verification', () => {
    const manager = new PuzzleManager();
    const puzzle5 = manager.getPuzzle('double-rook-mate');

    test('Puzzle 5 defined', () => {
        expect(puzzle5).toBeDefined();
    });

    test('Puzzle 5 Black Move Ambiguity', () => {
        if (!puzzle5 || !puzzle5.setupStr) throw new Error('Puzzle 5 missing');

        // Setup Board
        const game = new Game();
        const { board, turn } = PuzzleGenerator.stringToBoard(puzzle5.setupStr);
        game.board = board as any;
        game.turn = turn;

        // Apply Move 1 (White)
        const move1 = puzzle5.solution[0]; // { from: {r:2, c:0}, to: {r:1, c:0} }
        const r = move1.from.r;
        const c = move1.from.c;
        const piece = game.board[r][c];

        expect(piece?.type).toBe('r'); // Should be rook
        expect(piece?.color).toBe('white');

        // Execute Move 1
        game.board[move1.to.r][move1.to.c] = piece;
        game.board[r][c] = null;
        game.turn = 'black';

        // Check Black Responses
        const rules = new RulesEngine(game as any);
        const blackMoves = rules.getAllLegalMoves('black');

        // Expected Move from Solution
        const expectedResponse = puzzle5.solution[1];

        // Check if expected matches one of valid moves
        const matchesRequest = blackMoves.some(m =>
            m.from.r === expectedResponse.from.r &&
            m.from.c === expectedResponse.from.c &&
            m.to.r === expectedResponse.to.r &&
            m.to.c === expectedResponse.to.c
        );
        expect(matchesRequest).toBe(true);

        console.log('Valid Black Moves:', blackMoves.length);
        blackMoves.forEach(m => console.log(`From: ${m.from.r},${m.from.c} To: ${m.to.r},${m.to.c}`));

        // Check if there are OTHER valid moves
        // If there are, the AI might pick them and fail the strict solution check
        const alternatives = blackMoves.filter(m =>
            !(m.to.r === expectedResponse.to.r && m.to.c === expectedResponse.to.c)
        );

        // This expectation will FAIL if there are alternatives, CONFIRMING the bug
        expect(alternatives.length).toBe(0);
    });
});
