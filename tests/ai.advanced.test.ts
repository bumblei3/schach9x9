import { describe, test, expect, beforeEach } from 'vitest';
/* eslint-disable no-undef */

(global as any).BOARD_SIZE = 9;

// Dynamic import
const { evaluatePosition } = await import('../js/aiEngine.js');

describe('AI Advanced Evaluation Tests', () => {
  let board: any;

  function createPiece(type: string, color: string) {
    return { type, color, hasMoved: false };
  }

  beforeEach(() => {
    board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  test('Bishop Pair: should reward having two bishops', async () => {
    board[0][0] = createPiece('b', 'white');
    board[0][1] = createPiece('b', 'white');
    board[8][0] = createPiece('b', 'black');
    board[8][1] = createPiece('n', 'black');
    board[2][4] = createPiece('k', 'white');
    board[6][4] = createPiece('k', 'black');

    const score = await evaluatePosition(board, 'white');
    expect(score).toBeGreaterThan(0);
  });

  test('Passed Pawn: should reward pawn with no opposing pawns ahead', async () => {
    board[4][4] = createPiece('p', 'white');
    board[4][0] = createPiece('p', 'black');
    board[5][0] = createPiece('p', 'white');
    board[0][4] = createPiece('k', 'white');
    board[8][4] = createPiece('k', 'black');

    const score = await evaluatePosition(board, 'white');
    expect(score).toBeGreaterThan(20);
  });

  test('King Safety: Exposed king should be penalized', async () => {
    // Baseline: King behind pawn shield
    board[8][4] = createPiece('k', 'white');
    board[7][3] = createPiece('p', 'white');
    board[7][4] = createPiece('p', 'white');
    board[7][5] = createPiece('p', 'white');
    board[0][4] = createPiece('k', 'black');

    const safeScore = await evaluatePosition(board, 'white');

    // Remove pawn shield
    board[7][3] = null;
    board[7][4] = null;
    board[7][5] = null;

    const exposedScore = await evaluatePosition(board, 'white');

    expect(safeScore).toBeGreaterThan(exposedScore);
  });

  test('Material Advantage: Extra queen should win', async () => {
    board[0][4] = createPiece('k', 'white');
    board[8][4] = createPiece('k', 'black');
    board[4][4] = createPiece('q', 'white');

    const score = await evaluatePosition(board, 'white');
    expect(score).toBeGreaterThan(800); // Queen is worth ~900
  });
});
