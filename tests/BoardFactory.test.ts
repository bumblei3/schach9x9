import { describe, test, expect } from 'vitest';
import { BoardFactory } from '../js/campaign/BoardFactory.js';
import { BOARD_SIZE } from '../js/config.js';

describe('BoardFactory', () => {
  test('createEmptyBoard should return 9x9 null matrix', () => {
    const board = BoardFactory.createEmptyBoard();
    expect(board.length).toBe(BOARD_SIZE);
    expect(board[0].length).toBe(BOARD_SIZE);
    expect(board.every((row: any) => row.every((cell: any) => cell === null))).toBe(true);
  });

  test('createLevel1Board should have required pieces', () => {
    const board = BoardFactory.createLevel1Board();

    // Check for player pieces (White King, Rooks, Knights)
    let whitePieces = 0;
    let blackPieces = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece) {
          if (piece.color === 'white') whitePieces++;
          if (piece.color === 'black') blackPieces++;
        }
      }
    }

    // Level 1: White has King + 2 Rooks + 2 Knights + 5 Pawns = 10
    expect(whitePieces).toBe(10);
    // Black has King + 9 Pawns (row 1) + 5 Pawns (row 2) = 15
    expect(blackPieces).toBe(15);
  });

  test('createLevel2Board should have required pieces', () => {
    const board = BoardFactory.createLevel2Board();

    // Level 2: Opponent has 4 Knights and a King
    let knights = 0;
    let king = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.color === 'black') {
          if (piece.type === 'n') knights++;
          if (piece.type === 'k') king++;
        }
      }
    }

    expect(knights).toBe(4);
    expect(king).toBe(1);
  });
});
