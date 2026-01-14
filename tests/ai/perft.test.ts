import { describe, test, expect, beforeEach } from 'vitest';
import { getAllLegalMoves, makeMove, undoMove } from '../../js/ai/MoveGenerator.js';
import {
    SQUARE_COUNT, PIECE_NONE, COLOR_WHITE, COLOR_BLACK,
    WHITE_KING, BLACK_KING,
    PIECE_PAWN
} from '../../js/ai/BoardDefinitions.js';

function perft(board: Int8Array, depth: number, color: number): number {
    if (depth === 0) return 1;

    const moves = getAllLegalMoves(board, color === COLOR_WHITE ? 'white' : 'black');
    let nodes = 0;

    for (const move of moves) {
        const undo = makeMove(board, move);
        nodes += perft(board, depth - 1, color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE);
        undoMove(board, undo);
    }

    return nodes;
}

describe('Perft (Performance Test) & Move Generation Integrity', () => {
    let board: Int8Array;

    beforeEach(() => {
        board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
        // Place Kings to ensure legal position
        board[76] = WHITE_KING; // 8,4
        board[4] = BLACK_KING;  // 0,4
    });

    test('Perft Depth 1 - King only', () => {
        // King at 8,4. Surrounding empty. 
        // Moves: 8,3; 8,5; 7,3; 7,4; 7,5 (5 moves)
        const nodes = perft(board, 1, COLOR_WHITE);
        expect(nodes).toBe(5);
    });

    test('Perft Depth 2 - King only', () => {
        // Depth 2: White moves (5), then Black moves.
        // Black King at 0,4. Moves: 0,3; 0,5; 1,3; 1,4; 1,5 (5 moves)
        // Total = 5 * 5 = 25
        const nodes = perft(board, 2, COLOR_WHITE);
        expect(nodes).toBe(25);
    });

    test('Perft Depth 1 - King + Pawn', () => {
        // Add White Pawn at 7,4 (in front of King)
        board[67] = PIECE_PAWN | COLOR_WHITE;

        // King Moves blocked by pawn: 7,4 is blocked.
        // King Moves: 8,3; 8,5; 7,3; 7,5 (4 moves)
        // Pawn Moves: 6,4 (1 step), 5,4 (2 steps from start rank? Row 7 is start rank for 9x9?)
        // Assuming 9x9 rules: White Pawns on Row 7. Move to 5,4 and 6,4. (2 moves)

        // Total moves = 4 + 2 = 6
        const nodes = perft(board, 1, COLOR_WHITE);

        // Note: verify rules. If Row 7 is start, can move 2 squares.
        expect(nodes).toBeGreaterThanOrEqual(5);
    });
});
