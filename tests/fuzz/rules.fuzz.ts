import { getAllLegalMoves, makeMove, undoMove } from '../../js/ai/MoveGenerator.js';
import { SQUARE_COUNT, PIECE_NONE, PIECE_KING, COLOR_WHITE, COLOR_BLACK, PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN, PIECE_ARCHBISHOP, PIECE_CHANCELLOR, PIECE_ANGEL } from '../../js/ai/BoardDefinitions.js';

/**
 * Basic Fuzz Test for the Rules Engine
 * Objectives:
 * 1. Ensure makeMove/undoMove are perfectly symmetrical.
 * 2. Ensure no move results in a board state that crashes the generator.
 * 3. Ensure King capture is never possible in pseudo-legal move generation (if that's a rule).
 */

function boardToString(board: Int8Array): string {
    return Array.from(board).join(',');
}

export function runRulesFuzzTest(iterations: number = 1000) {
    console.log(`Starting Fuzz Test: ${iterations} iterations`);

    const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);

    const resetBoard = () => {
        board.fill(PIECE_NONE);
        // Standard setup for a 9x9 board (simplified for fuzzer)
        // White pieces row 7, 8
        // Black pieces row 0, 1
        // (Just randomizing a bit to find crashes)
        for (let i = 0; i < SQUARE_COUNT; i++) {
            if (Math.random() > 0.7) {
                const color = Math.random() > 0.5 ? COLOR_WHITE : COLOR_BLACK;
                const type = [PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN, PIECE_ARCHBISHOP, PIECE_CHANCELLOR, PIECE_ANGEL][Math.floor(Math.random() * 8)];
                board[i] = type | color;
            }
        }
        // Ensure kings exist
        if (!board.includes(PIECE_KING | COLOR_WHITE)) board[Math.floor(Math.random() * 9) + 72] = PIECE_KING | COLOR_WHITE;
        if (!board.includes(PIECE_KING | COLOR_BLACK)) board[Math.floor(Math.random() * 9)] = PIECE_KING | COLOR_BLACK;
    };

    resetBoard();
    let currentTurn = 'white';

    for (let i = 0; i < iterations; i++) {
        const moves = getAllLegalMoves(board, currentTurn);

        if (moves.length === 0 || i % 50 === 0) {
            resetBoard();
            currentTurn = 'white';
            continue;
        }

        // Pick a random move
        const move = moves[Math.floor(Math.random() * moves.length)];

        const originalBoardState = boardToString(board);

        // Execute move
        const undo = makeMove(board, move);

        // Undo move
        undoMove(board, undo);

        const postUndoBoardState = boardToString(board);

        if (originalBoardState !== postUndoBoardState) {
            console.error(`Inconsistency detected at iteration ${i}!`);
            console.error(`Move:`, move);
            console.error(`Undo Info:`, undo);
            throw new Error(`Board state mismatch after undo!`);
        }

        // Actually apply the move for next step
        makeMove(board, move);
        currentTurn = currentTurn === 'white' ? 'black' : 'white';
    }

    console.log('Fuzz Test complete: No inconsistencies found.');
}
