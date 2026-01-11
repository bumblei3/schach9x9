#!/usr/bin/env node
/**
 * Performance Benchmark for Schach 9x9 AI Engine
 * Measures AI performance on various positions
 */

import { getBestMove } from './aiEngine.js';
import { BOARD_SIZE } from './config.js';

// Disable progress callback to avoid spam
// setProgressCallback(null);

function createEmptyBoard(): any[][] {
  const board: any[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = null;
    }
  }
  return board;
}

function createTacticalPosition(): any[][] {
  const board = createEmptyBoard();

  // White
  board[8][4] = { type: 'k', color: 'white', hasMoved: true };
  board[5][4] = { type: 'q', color: 'white', hasMoved: true };
  board[6][3] = { type: 'r', color: 'white', hasMoved: true };
  board[7][5] = { type: 'n', color: 'white', hasMoved: true };
  board[7][3] = { type: 'p', color: 'white', hasMoved: true };

  // Black
  board[0][4] = { type: 'k', color: 'black', hasMoved: true };
  board[2][4] = { type: 'q', color: 'black', hasMoved: true };
  board[3][5] = { type: 'r', color: 'black', hasMoved: true };
  board[2][2] = { type: 'n', color: 'black', hasMoved: true };
  board[3][4] = { type: 'p', color: 'black', hasMoved: true };

  return board;
}

async function runBenchmark(): Promise<void> {
  console.log('='.repeat(60));
  console.log(' AI Performance Benchmark - Schach 9x9');
  console.log('='.repeat(60));
  console.log('');

  const position = createTacticalPosition();
  const depths = [2, 3, 4, 5, 6];

  console.log('Position: Tactical Midgame');
  console.log('-'.repeat(60));
  console.log('');

  for (const depth of depths) {
    const startTime = Date.now();

    try {
      const move = await getBestMove(position, 'white', depth, 'medium', { maxDepth: depth });
      const endTime = Date.now();
      const timeMs = endTime - startTime;

      console.log(`Depth ${depth}:`);
      console.log(`  Time: ${timeMs}ms`);
      if (move) {
        console.log(`  Move: (${move.from.r},${move.from.c}) -> (${move.to.r},${move.to.c})`);
      }
      console.log('');
    } catch (error: any) {
      console.error(`  Error at depth ${depth}:`, error.message);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log(' Benchmark Complete');
  console.log('='.repeat(60));
}

runBenchmark();
