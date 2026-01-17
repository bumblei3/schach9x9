import { describe, test, expect, beforeEach } from 'vitest';
import { evaluatePosition } from '../js/aiEngine.js';
import { createEmptyBoard } from '../js/gameEngine.js';

describe('AI Engine - Evaluation Boost', () => {
  let board: any;

  beforeEach(() => {
    board = createEmptyBoard();
  });

  test('King Safety: King Zone Attacks', async () => {
    // White king in safety
    board[8][4] = { type: 'k', color: 'white' };
    board[0][4] = { type: 'k', color: 'black' }; // Add black king
    board[7][3] = { type: 'p', color: 'white' };
    board[7][4] = { type: 'p', color: 'white' };
    board[7][5] = { type: 'p', color: 'white' };

    // No enemies near
    const safeScore = await evaluatePosition(board, 'white');

    // Enemy knight near king zone
    board[6][5] = { type: 'n', color: 'black' };
    const threatenedScore = await evaluatePosition(board, 'white');

    // Should be lower due to King Zone Attacks penalty
    expect(threatenedScore).toBeLessThan(safeScore);

    // More enemies
    board[6][3] = { type: 'r', color: 'black' };
    const highlyThreatenedScore = await evaluatePosition(board, 'white');
    expect(highlyThreatenedScore).toBeLessThan(threatenedScore);
  });

  test('Supported Passed Pawns bonus', async () => {
    // Both kings must be present
    board[8][4] = { type: 'k', color: 'white' };
    board[0][4] = { type: 'k', color: 'black' };

    // White passed pawn
    board[4][4] = { type: 'p', color: 'white' };
    // No opponent pawns in front or on adjacent columns

    const isolatedPassedScore = await evaluatePosition(board, 'white');

    // Supporting pawn
    board[5][3] = { type: 'p', color: 'white' };
    const supportedPassedScore = await evaluatePosition(board, 'white');

    // Score should increase more than just the base pawn value + PST
    // because of the 1.3x multiplier for supported passed pawns
    // Base pawn value is 100, PST at 4,4 is ~25.
    // Supported bonus is 30% of progress bonus.
    expect(supportedPassedScore).toBeGreaterThan(isolatedPassedScore + 100);
  });
});
