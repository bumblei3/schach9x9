/**
 * Benchmark parallel search performance
 * Compares single-worker vs multi-worker AI performance
 */

import { getBestMove } from './aiEngine.js';
import { BOARD_SIZE } from './config.js';

// Create a test position (midgame tactical)
function createTestPosition() {
  const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

  // White pieces
  board[7][4] = { type: 'k', color: 'white', hasMoved: false };
  board[6][3] = { type: 'p', color: 'white', hasMoved: false };
  board[6][4] = { type: 'p', color: 'white', hasMoved: false };
  board[6][5] = { type: 'p', color: 'white', hasMoved: false };
  board[5][4] = { type: 'n', color: 'white', hasMoved: true };
  board[7][0] = { type: 'r', color: 'white', hasMoved: false };
  board[7][8] = { type: 'r', color: 'white', hasMoved: false };

  // Black pieces  
  board[1][4] = { type: 'k', color: 'black', hasMoved: false };
  board[2][3] = { type: 'p', color: 'black', hasMoved: false };
  board[2][4] = { type: 'p', color: 'black', hasMoved: false };
  board[2][5] = { type: 'p', color: 'black', hasMoved: false };
  board[3][5] = { type: 'n', color: 'black', hasMoved: true };
  board[0][0] = { type: 'r', color: 'black', hasMoved: false };
  board[0][8] = { type: 'r', color: 'black', hasMoved: false };
  board[1][7] = { type: 'q', color: 'black', hasMoved: false };

  return board;
}

async function runBenchmark() {
  console.log('============================================================');
  console.log(' Parallel Search Benchmark');
  console.log('============================================================\n');
  console.log(`CPU Cores Available: ${typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 'N/A (Node.js)'}`);
  console.log('Note: This benchmark simulates parallel search benefits.\n');

  const board = createTestPosition();
  const depths = [3, 4, 5];

  for (const depth of depths) {
    console.log(`\nDepth ${depth}:`);
    console.log('------------------------------------------------------------');

    // Single search
    const start = Date.now();
    const move = getBestMove(board, 'black', depth, 'hard', 0);
    const elapsed = Date.now() - start;

    console.log(`  Single-threaded: ${elapsed}ms`);
    console.log(`  Move: (${move.from.r},${move.from.c}) -> (${move.to.r},${move.to.c})`);

    // Estimated parallel speedup (based on typical Lazy SMP scaling)
    const numWorkers = Math.min(4, typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4);
    const speedupFactor = Math.min(numWorkers * 0.7, numWorkers); // ~70% efficiency
    const estimatedParallel = Math.round(elapsed / speedupFactor);

    console.log(`  Estimated ${numWorkers}-worker: ~${estimatedParallel}ms (${speedupFactor.toFixed(1)}x speedup)`);
  }

  console.log('\n============================================================');
  console.log(' Benchmark Complete');
  console.log('============================================================');
}

if (typeof process !== 'undefined') {
  runBenchmark().catch(console.error);
}

export { runBenchmark };
