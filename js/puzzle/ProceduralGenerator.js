/**
 * Procedural Puzzle Generator
 * Generates random endgame positions and verifies they are valid puzzles.
 */
import { BOARD_SIZE } from '../config.js';
import { PuzzleGenerator } from '../puzzleGenerator.js';

export class ProceduralGenerator {
    /**
     * Generates a puzzle for a given difficulty.
     * @param {string} difficulty - 'easy' (Mate in 1), 'medium' (Mate in 2)
     * @returns {Object|null} Puzzle object or null if failed
     */
    static generatePuzzle(difficulty = 'easy') {
        const depth = difficulty === 'easy' ? 1 : 2;
        const maxAttempts = 200;

        for (let i = 0; i < maxAttempts; i++) {
            const board = this.createRandomPosition(difficulty);
            if (!board) continue;

            // Ensure position is legal (kings not touching, side to move not capturing king)
            if (!this.isPositionLegal(board)) continue;

            // Try to find a forced mate
            const solution = PuzzleGenerator.findMateSequence(board, 'white', depth);

            if (solution) {
                return {
                    id: `proc-${Date.now()}-${i}`,
                    title: `Generated ${difficulty === 'easy' ? 'Mate in 1' : 'Mate in 2'}`,
                    description: `White to move. Find the checkmate in ${depth} move${depth > 1 ? 's' : ''}.`,
                    difficulty: difficulty === 'easy' ? 'Easy' : 'Medium',
                    setupStr: PuzzleGenerator.boardToString(board, 'white'),
                    solution: solution,
                };
            }
        }

        return null;
    }

    static createRandomPosition(difficulty) {
        const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

        // 1. Place Kings (must not be adjacent)
        const bk = this.randomSquare();
        board[bk.r][bk.c] = { type: 'k', color: 'black', hasMoved: true };

        let wk;
        do {
            wk = this.randomSquare();
        } while (Math.abs(wk.r - bk.r) <= 1 && Math.abs(wk.c - bk.c) <= 1); // Kings cannot touch
        board[wk.r][wk.c] = { type: 'k', color: 'white', hasMoved: true };

        // 2. Add White Material
        // Easy: Queen + Rook (Overkill to ensure mate is likely)
        // Medium: Rook + Bishop or just Queen
        const pieces = difficulty === 'easy'
            ? ['q', 'r']
            : ['r', 'b']; // Reduced material for medium to make it harder/more precise

        for (const type of pieces) {
            let pos;
            do {
                pos = this.randomSquare();
            } while (board[pos.r][pos.c] !== null);
            board[pos.r][pos.c] = { type, color: 'white', hasMoved: true };
        }

        // 3. Add Black Material (Pawns to block or prevent stalemate)
        // Sometimes add a black pawn to avoid stalemate or allow "helper mate"
        if (Math.random() > 0.5) {
            let pos;
            do {
                pos = this.randomSquare();
            } while (board[pos.r][pos.c] !== null || pos.r === 0 || pos.r === 8); // Pawns not on back ranks
            board[pos.r][pos.c] = { type: 'p', color: 'black', hasMoved: true };
        }

        return board;
    }

    static isPositionLegal(_board) {
        // Basic check: Kings exist and are not adjacent (already handled mostly)
        // Check if Black leader is NOT in check (since it's White's turn)
        // Actually, PuzzleGenerator validation might handle checks, but we should ensure
        // the starting position is valid.
        // For now, relies on generation logic.
        return true;
    }

    static randomSquare() {
        return {
            r: Math.floor(Math.random() * BOARD_SIZE),
            c: Math.floor(Math.random() * BOARD_SIZE)
        };
    }
}
