import { describe, test, expect, beforeEach } from 'vitest';
import { getBestMoveDetailed, evaluatePosition } from '../../js/aiEngine.js';
import { createEmptyBoard } from '../../js/gameEngine.js';

describe('AI Performance Benchmarks', () => {
  let board: any;

  beforeEach(() => {
    board = createEmptyBoard();
    // Standard start position Kings
    board[8][4] = { type: 'k', color: 'white' };
    board[0][4] = { type: 'k', color: 'black' };
  });

  test('Benchmark: Start Position Depth 4', async () => {
    const start = Date.now();
    await getBestMoveDetailed(board, 'white', 4);
    const end = Date.now();
    const duration = (end - start) / 1000;

    console.log(`[Benchmark] Depth 4 took ${duration.toFixed(2)}s`);
    // if WASM is active, it might report nodes. In Node environment it should.
  });

  test('Benchmark: Complex Midgame Depth 4', async () => {
    // More complex position to avoid instant book hits or easy exits
    board[8][0] = { type: 'r', color: 'white' };
    board[8][8] = { type: 'r', color: 'white' };
    board[0][0] = { type: 'r', color: 'black' };
    board[0][8] = { type: 'r', color: 'black' };
    board[7][4] = { type: 'p', color: 'white' };
    board[1][4] = { type: 'p', color: 'black' };
    board[6][3] = { type: 'n', color: 'white' };
    board[2][5] = { type: 'n', color: 'black' };
    board[4][4] = { type: 'q', color: 'white' };
    board[4][5] = { type: 'q', color: 'black' };

    const start = Date.now();
    const result = await getBestMoveDetailed(board, 'white', 4);
    const end = Date.now();
    const duration = (end - start) / 1000;

    console.log(`[Benchmark] Complex Midgame Depth 4 took ${duration.toFixed(2)}s`);
    if (result && result.nodes) {
      const nps = Math.floor(result.nodes / duration);
      console.log(`[Benchmark] Nodes: ${result.nodes}, NPS: ${nps.toLocaleString()}`);
      expect(result.nodes).toBeGreaterThan(0);
    }

    expect(duration).toBeLessThan(15);
  });

  test('Consistency: Score stability across depths', async () => {
    board[4][4] = { type: 'n', color: 'white' };
    const score1 = await evaluatePosition(board, 'white');
    const search2 = await getBestMoveDetailed(board, 'white', 2);
    const search4 = await getBestMoveDetailed(board, 'white', 4);

    console.log(`[Stability] Eval: ${score1}, D2: ${search2?.score}, D4: ${search4?.score}`);

    if (search2 && search4) {
      // Check if scores are at least not completely opposite
      // search2.score and search4.score should be similar if position is stable
      expect(Math.abs(search2.score - search4.score)).toBeLessThan(500);
    }
  });

  test('Benchmark: Depth 5 Search (Target < 5s)', async () => {
    const start = Date.now();
    await getBestMoveDetailed(board, 'white', 5);
    const end = Date.now();
    const duration = (end - start) / 1000;

    console.log(`[Benchmark] Depth 5 took ${duration.toFixed(2)}s`);
    expect(duration).toBeLessThan(5);
  }, 30000);
});
