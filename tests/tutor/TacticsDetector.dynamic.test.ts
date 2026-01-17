import { describe, test, expect, beforeEach } from 'vitest';
import { Game, BOARD_SIZE } from '../../js/gameEngine.js';
import { detectTacticalPatterns, detectBattery } from '../../js/tutor/TacticsDetector.js';

describe('TacticsDetector Dynamic', () => {
  let game: any;
  const analyzer: any = { getPieceName: (t: any) => t };

  beforeEach(() => {
    game = new Game(15, 'classic'); // 9x9 board
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    game.whiteCorridor = { rowStart: 6, colStart: 3 };
    game.blackCorridor = { rowStart: 0, colStart: 3 };
    game.phase = 'PLAY';
  });

  // Helper to place piece
  const place = (r: number, c: number, type: string, color: string) => {
    game.board[r][c] = { type, color, hasMoved: false };
  };

  test('detectBattery should find Rook + Rook battery', () => {
    // Setup: White Rook at 4,4. White Rook at 4,6.
    // Move Rook from 4,6 to 4,5.
    // Positions: Front 4,5. Behind 4,4.

    place(4, 4, 'r', 'white'); // Behind
    place(4, 6, 'r', 'white'); // Moving piece

    // Move to 4,5

    // detectBattery expects 'pos' AFTER move.
    // We simulate the board state manually for this unit test if calling detectBattery directly?
    // detectTacticalPatterns simulates it. detectBattery does NOT.

    // Manual simulation
    game.board[4][4] = { type: 'r', color: 'white' };
    game.board[4][5] = { type: 'r', color: 'white' };
    game.board[4][6] = null;

    const batteries = detectBattery(game as any, analyzer, { r: 4, c: 5 }, 'white');

    expect(batteries).toHaveLength(1);
    expect(batteries[0].frontPos).toEqual({ r: 4, c: 5 });
    expect(batteries[0].behindPos).toEqual({ r: 4, c: 4 });
  });

  test('detectTacticalPatterns should include targets for Fork', () => {
    // White Knight forks Black Rooks
    place(3, 3, 'r', 'black');
    place(3, 7, 'r', 'black');
    place(5, 5, 'n', 'white'); // Moving from here

    const move = { from: { r: 5, c: 5 }, to: { r: 4, c: 5 } };

    // Knight at 4,5 attacks 3,3 (dr-1, dc-2) and 3,7 (dr-1, dc+2)??
    // Knight moves: +/-1, +/-2.
    // 4,5 + (-1, -2) = 3,3. Yes.
    // 4,5 + (-1, +2) = 3,7. Yes.

    const patterns = detectTacticalPatterns(game as any, analyzer, move);
    const fork: any = patterns.find((p: any) => p.type === 'fork');

    expect(fork).toBeDefined();
    expect(fork.targets).toHaveLength(2);
    expect(fork.targets).toContainEqual({ r: 3, c: 3 });
    expect(fork.targets).toContainEqual({ r: 3, c: 7 });
  });

  test('detectTacticalPatterns should include targets for Pin', () => {
    // White Rook pins Black Knight to Black King
    place(0, 0, 'k', 'black');
    place(0, 2, 'n', 'black');
    place(4, 0, 'r', 'white'); // Moving to 0,5 (same rank)

    // Move White Rook from 4,0 to 0,5?
    // Rank 0: K . N . . R
    // Rook at 0,5 attacks 0,2 (N). Behind N is 0,0 (K).

    // Move
    const move = { from: { r: 4, c: 0 }, to: { r: 0, c: 5 } };

    const patterns = detectTacticalPatterns(game as any, analyzer, move);
    const pin: any = patterns.find((p: any) => p.type === 'pin');

    expect(pin).toBeDefined();
    expect(pin.targets).toContainEqual({ r: 0, c: 2 }); // Pinned Knight
    expect(pin.targets).toContainEqual({ r: 0, c: 0 }); // King behind
  });
});
