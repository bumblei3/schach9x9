import { describe, expect, test } from 'vitest';
import * as MoveAnalyzer from '../js/tutor/MoveAnalyzer.js';

describe('MoveAnalyzer Unit Tests', () => {
  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  test('categorizeMove great move', () => {
    const mockGame = {
      board,
      getValidMoves: () => [],
      isInCheck: () => false,
      isSquareUnderAttack: () => false,
    } as any;

    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      mockGame,
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } } as any,
      250,
      50
    );
    expect(result.category).toBe('best');
  });

  test('categorizeMove blunder', () => {
    const mockGame = {
      board,
      getValidMoves: () => [],
      isInCheck: () => false,
      isSquareUnderAttack: () => false,
    } as any;

    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      mockGame,
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } } as any,
      -250,
      50
    );
    expect(result.category).toBe('mistake');
  });

  test('categorizeMove mistake', () => {
    const mockGame = {
      board,
      getValidMoves: () => [],
      isInCheck: () => false,
      isSquareUnderAttack: () => false,
    } as any;

    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      mockGame,
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } } as any,
      -150,
      50
    );
    expect(result.category).toBe('inaccuracy');
  });

  test('tactical explanations', () => {
    const testBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    testBoard[5][4] = { type: 'p', color: 'black' } as any;
    testBoard[7][4] = { type: 'p', color: 'white' } as any;

    const mockGame = {
      board: testBoard,
      getValidMoves: () => [],
      isInCheck: () => false,
      isSquareUnderAttack: () => false,
    } as any;

    const result = MoveAnalyzer.analyzeMoveWithExplanation(
      mockGame,
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, captured: { type: 'p', color: 'black' } } as any,
      100,
      0
    );
    expect(result.tacticalExplanations).toBeDefined();
  });
});
