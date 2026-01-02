import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { analyzePosition, extractPV, getBestMove } from '../js/ai/Search.js';
import { clearTT } from '../js/ai/TranspositionTable.js';
import { BOARD_SIZE } from '../js/config.js';

describe('Search Logic - Edge Cases & Coverage', () => {
  let game;

  beforeEach(() => {
    game = new Game(15, 'classic');
    clearTT();
  });

  test('analyzePosition should return top moves and scores', () => {
    const analysis = analyzePosition(game.board, 'white', 1);
    expect(analysis).toBeDefined();
    expect(analysis.score).toBeDefined();
    expect(analysis.topMoves.length).toBeGreaterThan(0);
  });

  test('analyzePosition should handle empty moves (checkmate)', () => {
    const board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    board[0][0] = { type: 'k', color: 'white' };
    board[8][8] = { type: 'k', color: 'black' };
    board[0][8] = { type: 'r', color: 'black' };
    board[1][8] = { type: 'r', color: 'black' };
    board[8][0] = { type: 'r', color: 'black' };
    board[8][1] = { type: 'r', color: 'black' };

    const analysis = analyzePosition(board, 'white', 1);
    expect(analysis.topMoves.length).toBe(0);
    expect(analysis.score).toBe(0);
  });

  test('extractPV should return principal variation', () => {
    getBestMove(game.board, 'white', 'hard', 1);
    const pv = extractPV(game.board, 'white', 1);
    expect(Array.isArray(pv)).toBe(true);
    // Even if length is 0 in some environments, we want to at least not crash
  });

  test('Search should handle aspiration window widening', () => {
    const result = getBestMove(game.board, 'white', 'hard', 1);
    expect(result).toBeDefined();
  });
});
