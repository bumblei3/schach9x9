
import * as AIEngine from '../js/aiEngine.js';
import { Game } from '../js/gameEngine.js';

describe('AIEngine Integration', () => {
  let game;

  beforeEach(() => {
    game = new Game(15, 'classic');
  });

  test('analyzePosition re-export functionality', () => {
    // analyzePosition is currently a stub returning null in Wasm port
    const result = AIEngine.analyzePosition(game.board, 'white');
    expect(result).toBeNull();
  });

  test('getBestMove re-export functionality', async () => {
    const board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    board[7][4] = { type: 'k', color: 'white' };
    board[1][4] = { type: 'k', color: 'black' };
    const result = await AIEngine.getBestMove(board, 'white', 1, 'hard', { elo: 2500 });
    expect(result).toBeDefined();
    expect(result.from).toBeDefined();
  });

  test('evaluatePosition re-export functionality', async () => {
    const score = await AIEngine.evaluatePosition(game.board, 'white');
    expect(typeof score).toBe('number');
  });

  test('extractPV re-export functionality', async () => {
    // extractPV is currently a stub returning [] in Wasm port
    const pv = AIEngine.extractPV(game.board, 'white');
    expect(Array.isArray(pv)).toBe(true);
  });
});
