import { jest } from '@jest/globals';
import { PuzzleManager } from '../js/puzzleManager.js';
import { Game } from '../js/gameEngine.js';
import { PHASES, BOARD_SIZE } from '../js/gameEngine.js';

describe('PuzzleMode', () => {
    let puzzleManager;
    let game;

    beforeEach(() => {
        puzzleManager = new PuzzleManager();
        game = new Game(15, 'classic');
    });

    test('should load a puzzle correctly', () => {
        const puzzle = puzzleManager.loadPuzzle(game, 0); // Load first puzzle

        expect(puzzle).toBeDefined();
        expect(game.mode).toBe('puzzle');
        expect(game.puzzleState.active).toBe(true);
        expect(game.puzzleState.currentMoveIndex).toBe(0);

        // Puzzle 1 setup: White King at e1 (8, 4), Queen at e8 (1, 4), Black King at e9 (0, 4)
        expect(game.board[8][4].type).toBe('k');
        expect(game.board[1][4].type).toBe('q');
        expect(game.board[0][4].type).toBe('k');
    });

    test('should validate correct move', () => {
        puzzleManager.loadPuzzle(game, 0); // Mate in 1

        // Correct move: Qe8-e9 (1,4 -> 0,4)
        const move = {
            from: { r: 1, c: 4 },
            to: { r: 0, c: 4 }
        };

        const result = puzzleManager.checkMove(game, move);
        expect(result).toBe('solved'); // Should be solved as it is mate in 1
        expect(game.puzzleState.solved).toBe(true);
    });

    test('should reject wrong move', () => {
        puzzleManager.loadPuzzle(game, 0);

        // Wrong move: Qe8-d8 (1,4 -> 0,3)
        const move = {
            from: { r: 1, c: 4 },
            to: { r: 0, c: 3 }
        };

        const result = puzzleManager.checkMove(game, move);
        expect(result).toBe('wrong');
        expect(game.puzzleState.solved).toBe(false);
    });

    test('should handle multi-step puzzles', () => {
        puzzleManager.loadPuzzle(game, 1); // Mate in 2

        // Move 1: R(6,4) -> R(1,4)
        const move1 = {
            from: { r: 6, c: 4 },
            to: { r: 1, c: 4 }
        };

        const result1 = puzzleManager.checkMove(game, move1);
        expect(result1).toBe('continue');
        expect(game.puzzleState.currentMoveIndex).toBe(1);

        // Move 2: R(2,4) -> R(0,4)
        const move2 = {
            from: { r: 2, c: 4 },
            to: { r: 0, c: 4 }
        };

        const result2 = puzzleManager.checkMove(game, move2);
        expect(result2).toBe('solved');
        expect(game.puzzleState.solved).toBe(true);
    });
});
