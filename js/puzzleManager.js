import { BOARD_SIZE } from './config.js';
import { PuzzleGenerator } from './puzzleGenerator.js';

export class PuzzleManager {
    constructor() {
        this.puzzles = [
            {
                id: 'mate-in-1-001',
                title: 'Puzzle 1: Der Gnadenstoß',
                description: 'Weiß zieht und setzt in 1 Zug matt.',
                difficulty: 'Einfach',
                // White King at 2,2 (index 20); Black King at 0,2 (index 2); White Rook at 1,7 (index 16)
                // Index 0-1: .. .. (2)
                // Index 2: bk
                // Index 3-15: (13 squares)
                // Index 16: wr
                // Index 17-19: (3 squares)
                // Index 20: wk
                setupStr: '....bk..........................wr......wk..................................................................................................................w',
                solution: [
                    { from: { r: 1, c: 7 }, to: { r: 0, c: 7 } }
                ]
            },
            {
                id: 'mate-in-2-001',
                title: 'Puzzle 2: Taktischer Schlag',
                description: 'Weiß am Zug. Matt in 2.',
                difficulty: 'Mittel',
                // Black King at 0,4 (index 4); White King at 2,4 (index 22); Rook at 6,4 (index 58); Rook at 2,4? Wait, Rooks at 6,4 and 2,4 was the old description.
                // Let's use: King at 0,4 (B), 2,4 (W). Rooks at 6,4 and 2,0.
                // Index 4: bk
                // Index 22: wk
                // Index 58: wr
                // Index 18: wr (2,0)
                setupStr: '........bk....................wr......wk..........................................................wr........................................................w',
                solution: [
                    { from: { r: 6, c: 4 }, to: { r: 1, c: 4 } },
                    { from: { r: 2, c: 0 }, to: { r: 0, c: 0 } } // Adjust solution to match
                ]
            },
            {
                id: 'mate-in-1-arch',
                title: 'Puzzle 3: Die Kraft des Erzbischofs',
                description: 'Weiß zieht. Setze matt mit dem Erzbischof.',
                difficulty: 'Mittel',
                // White King at 2,3 (index 21); Archbishop at 2,2 (index 20); Black King at 0,3 (index 3)
                setupStr: '......bk........................awkb........................................................................................................................w',
                solution: [
                    { from: { r: 2, c: 2 }, to: { r: 1, c: 4 } }
                ]
            }
        ];

        this.currentPuzzleIndex = 0;
    }

    getPuzzle(id) {
        return this.puzzles.find(p => p.id === id);
    }

    loadPuzzle(game, index = 0) {
        if (index < 0 || index >= this.puzzles.length) return false;

        this.currentPuzzleIndex = index;
        const puzzle = this.puzzles[index];

        // Reset game to a clean state
        game.phase = 'play';
        game.mode = 'puzzle';
        game.points = 0;
        game.capturedPieces = { white: [], black: [] };
        game.moveHistory = [];
        game.puzzleState = {
            active: true,
            currentMoveIndex: 0,
            puzzleId: puzzle.id,
            solved: false
        };

        // Apply setup from string or function
        if (puzzle.setupStr) {
            const { board, turn } = PuzzleGenerator.stringToBoard(puzzle.setupStr);
            game.board = board;
            game.turn = turn;
        } else if (puzzle.setup) {
            puzzle.setup(game);
        }

        return puzzle;
    }

    checkMove(game, move) {
        if (!game.puzzleState || !game.puzzleState.active) return false;

        const puzzle = this.puzzles[this.currentPuzzleIndex];
        const expectedMove = puzzle.solution[game.puzzleState.currentMoveIndex];

        // Simple coordinate check
        const isCorrectParams =
            move.from.r === expectedMove.from.r &&
            move.from.c === expectedMove.from.c &&
            move.to.r === expectedMove.to.r &&
            move.to.c === expectedMove.to.c;

        if (isCorrectParams) {
            game.puzzleState.currentMoveIndex++;
            if (game.puzzleState.currentMoveIndex >= puzzle.solution.length) {
                game.puzzleState.solved = true;
                game.puzzleState.active = false;
                return 'solved';
            }
            return 'continue';
        } else {
            return 'wrong';
        }
    }

    nextPuzzle(game) {
        const nextIndex = this.currentPuzzleIndex + 1;
        if (nextIndex < this.puzzles.length) {
            return this.loadPuzzle(game, nextIndex);
        }
        return null;
    }

    /**
     * Dynamically generates a puzzle from a game state
     */
    generateAndLoad(game, depth = 2) {
        const solution = PuzzleGenerator.findMateSequence(game.board, game.turn, depth);
        if (!solution) return null;

        const puzzle = {
            id: 'gen-' + Date.now(),
            title: 'Generiertes Puzzle',
            description: `Setze matt in ${depth} Zügen.`,
            difficulty: depth === 1 ? 'Einfach' : 'Mittel',
            setupStr: PuzzleGenerator.boardToString(game.board, game.turn),
            solution: solution.filter((_, i) => i % 2 === 0) // Only our moves
        };

        // Add to list and load
        this.puzzles.push(puzzle);
        return this.loadPuzzle(game, this.puzzles.length - 1);
    }
}

export const puzzleManager = new PuzzleManager();
