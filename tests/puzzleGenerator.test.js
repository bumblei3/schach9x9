import { PuzzleGenerator } from '../js/puzzleGenerator.js';
import { createEmptyBoard, BOARD_SIZE } from '../js/gameEngine.js';

describe('PuzzleGenerator', () => {
  test('boardToString and stringToBoard should be inverse', () => {
    const board = createEmptyBoard();
    board[4][4] = { type: 'k', color: 'white' };
    board[0][0] = { type: 'r', color: 'black' };
    const turn = 'white';

    const str = PuzzleGenerator.boardToString(board, turn);
    const { board: newBoard, turn: newTurn } = PuzzleGenerator.stringToBoard(str);

    expect(newTurn).toBe(turn);
    expect(newBoard[4][4].type).toBe('k');
    expect(newBoard[4][4].color).toBe('white');
    expect(newBoard[0][0].type).toBe('r');
    expect(newBoard[0][0].color).toBe('black');
  });

  test('should find Mate in 1', () => {
    const board = createEmptyBoard();
    // White King at 2,2 (covers 1,1; 1,2; 1,3)
    // Black King at 0,2
    // White Rook at 1,7
    // White to move: Rook to 0,7 is mate
    board[2][2] = { type: 'k', color: 'white', hasMoved: true };
    board[0][2] = { type: 'k', color: 'black', hasMoved: true };
    board[1][7] = { type: 'r', color: 'white', hasMoved: true };

    const solution = PuzzleGenerator.findMateSequence(board, 'white', 1);
    expect(solution).not.toBeNull();
    expect(solution.length).toBe(1);
    expect(solution[0]).toEqual({
      from: { r: 1, c: 7 },
      to: { r: 0, c: 7 }
    });
  });

  test('should find Mate in 2', () => {
    const board = createEmptyBoard();
    // Mate in 2: White Rooks at 6,4 and 2,4. Black King at 0,4.
    // Step 1: R(6,4)->R(1,4) Check.
    // Step 2: Black King must move (if can) or blocked.
    // If Black King at 0,4 is trapped by White King at 2,4.

    board[2][4] = { type: 'k', color: 'white', hasMoved: true };
    board[6][4] = { type: 'r', color: 'white', hasMoved: true };
    board[0][4] = { type: 'k', color: 'black', hasMoved: true };
    board[5][0] = { type: 'r', color: 'white', hasMoved: true }; // Extra piece to avoid draw

    const solution = PuzzleGenerator.findMateSequence(board, 'white', 2);
    expect(solution).not.toBeNull();
    // Mate in 2 means 3 plys: W1, B1, W2
    expect(solution.length).toBeGreaterThanOrEqual(1);
  });
});
