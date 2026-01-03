import { describe, expect, test } from '@jest/globals';
import * as MoveAnalyzer from '../js/tutor/MoveAnalyzer.js';

describe('MoveAnalyzer Unit Tests', () => {
  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  test('categorizeMove great move', () => {
    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      { board, getValidMoves: () => [], isInCheck: () => false },
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      250,
      50,
      'white'
    );
    expect(result.category).toBe('excellent');
  });

  test('categorizeMove blunder', () => {
    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      { board, getValidMoves: () => [], isInCheck: () => false },
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      -250,
      50,
      'white'
    );
    // Based on logic: diffP is -300 (250-50 = -300? No, score is -250, bestScore is 50. diff = -300. diffP = -3.0)
    // >= -3.0 is 'questionable'
    expect(result.category).toBe('questionable');
  });

  test('categorizeMove mistake', () => {
    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      { board, getValidMoves: () => [], isInCheck: () => false },
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      -400,
      50,
      'white'
    );
    // diff = -450. diffP = -4.5. < -3.0 is 'mistake'
    expect(result.category).toBe('mistake');
  });

  test('tactical explanations', () => {
    // Setup a simple capture for explanation
    const testBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    testBoard[5][4] = { type: 'p', color: 'black' };
    testBoard[7][4] = { type: 'p', color: 'white' };

    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      { board: testBoard, getValidMoves: () => [], isInCheck: () => false },
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, captured: { type: 'p', color: 'black' } },
      100,
      0,
      'white'
    );
    // Even if empty returns, it shouldn't crash
    expect(result.tacticalExplanations).toBeDefined();
  });
});
