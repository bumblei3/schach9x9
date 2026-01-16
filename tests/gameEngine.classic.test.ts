import { describe, expect, test, beforeEach } from 'vitest';
import { Game, BOARD_SIZE, PHASES } from '../js/gameEngine.js';

describe('Game Engine - Classic Mode', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game(15, 'classic');
  });

  test('should initialize in PLAY phase', () => {
    expect(game.phase).toBe(PHASES.PLAY);
    expect(game.mode).toBe('classic');
  });

  test('should setup pawns correctly', () => {
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Black pawns at row 1
      expect(game.board[1][c]).toEqual({ type: 'p', color: 'black', hasMoved: false });
      // White pawns at row 7 (BOARD_SIZE - 2)
      expect(game.board[BOARD_SIZE - 2][c]).toEqual({ type: 'p', color: 'white', hasMoved: false });
    }
  });

  test('should setup pieces correctly (R N B A K C B N R)', () => {
    const expectedPieces = ['r', 'n', 'b', 'a', 'k', 'c', 'b', 'n', 'r'];

    for (let c = 0; c < BOARD_SIZE; c++) {
      // Black pieces at row 0
      expect(game.board[0][c]).toEqual({
        type: expectedPieces[c],
        color: 'black',
        hasMoved: false,
      });
      // White pieces at row 8 (BOARD_SIZE - 1)
      expect(game.board[BOARD_SIZE - 1][c]).toEqual({
        type: expectedPieces[c],
        color: 'white',
        hasMoved: false,
      });
    }
  });

  test('should have empty rows in between', () => {
    for (let r = 2; r < BOARD_SIZE - 2; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(game.board[r][c]).toBeNull();
      }
    }
  });
});
