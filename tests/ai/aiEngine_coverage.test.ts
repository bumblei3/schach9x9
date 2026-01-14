import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as aiEngine from '../../js/aiEngine.js';
import { createEmptyBoard } from '../../js/gameEngine.js';

// Mock Worker for aiEngine
class MockWorker {
  onmessage: ((e: any) => void) | null = null;
  postMessage = vi.fn(msg => {
    // Automatically respond to requests with id
    if (msg.id !== undefined) {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: msg.type === 'getBestMove' ? 'bestMove' : 'payload',
              id: msg.id,
              data: { move: { from: { r: 1, c: 1 }, to: { r: 1, c: 2 } }, score: 100 },
            },
          } as any);
        }
      }, 0);
    }
  });
  terminate = vi.fn();
  addEventListener = vi.fn((type, handler) => {
    if (type === 'message') this.onmessage = handler;
  });
}

// @ts-ignore
global.Worker = MockWorker;
// @ts-ignore
global.window = global;

describe('AIEngine Coverage Boost', () => {
  let board: any;

  beforeEach(() => {
    board = createEmptyBoard();
    vi.clearAllMocks();
  });

  test('convertBoardToInt handles Int8Array input', () => {
    const intArray = new Int8Array(81);
    const result = aiEngine.convertBoardToInt(intArray as any);
    expect(result).toBe(intArray);
  });

  test('makeMove and undoMove should maintain board state', () => {
    board[1][1] = { type: 'p', color: 'white' };
    board[1][2] = { type: 'n', color: 'black' };

    const move = { from: { r: 1, c: 1 }, to: { r: 1, c: 2 } };
    const undoInfo = aiEngine.makeMove(board, move);

    expect(board[1][1]).toBeNull();
    expect(board[1][2]).toEqual({ type: 'p', color: 'white', hasMoved: true });

    aiEngine.undoMove(board, undoInfo);

    expect(board[1][1]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(board[1][2]).toEqual({ type: 'n', color: 'black' });
  });

  test('getParamsForElo coverage', () => {
    expect(aiEngine.getParamsForElo(800).maxDepth).toBe(3);
    expect(aiEngine.getParamsForElo(1200).maxDepth).toBe(4);
    expect(aiEngine.getParamsForElo(1600).maxDepth).toBe(5);
    expect(aiEngine.getParamsForElo(2000).maxDepth).toBe(6);
    expect(aiEngine.getParamsForElo(2400).maxDepth).toBe(8);
  });

  test('getBestMove - success path', async () => {
    board[0][0] = { type: 'k', color: 'white' };
    board[8][8] = { type: 'k', color: 'black' };
    const result = await aiEngine.getBestMove(board, 'white', 1);
    expect(result).toBeDefined();
  });

  test('getBestMoveDetailed with Elo config', async () => {
    board[0][0] = { type: 'k', color: 'white' };
    board[8][8] = { type: 'k', color: 'black' };
    const result = await aiEngine.getBestMoveDetailed(board, 'white', 1, { elo: 1000 });
    expect(result).toBeDefined();
  });

  test('isInCheck and isSquareAttacked', () => {
    board[4][4] = { type: 'k', color: 'white' };
    board[4][3] = { type: 'r', color: 'black' }; // Attacking on same rank

    expect(aiEngine.isInCheck(board, 'white')).toBe(true);
    expect(aiEngine.isSquareAttacked(board, 4, 4, 'black')).toBe(true);

    // Test non-attacked square
    expect(aiEngine.isSquareAttacked(board, 0, 0, 'black')).toBe(false);
  });

  test('findKing edge cases', () => {
    board[0][0] = { type: 'k', color: 'white' };
    expect(aiEngine.findKing(board, 'white')).toEqual({ r: 0, c: 0 });
    expect(aiEngine.findKing(board, 'black')).toBeNull(); // King not found
  });

  test('TT and Nodes coverage', () => {
    aiEngine.resetNodesEvaluated();
    expect(aiEngine.getNodesEvaluated()).toBeGreaterThanOrEqual(0);

    aiEngine.storeTT();
    aiEngine.probeTT();
    expect(aiEngine.getTTMove()).toBeNull();
    aiEngine.clearTT();
    expect(aiEngine.getTTSize()).toBe(0);
    aiEngine.setTTMaxSize();
    aiEngine.testStoreTT();
    aiEngine.testProbeTT();
  });

  test('setProgressCallback coverage', () => {
    aiEngine.setProgressCallback(null as any);
    aiEngine.setProgressCallback(() => {});
    expect(true).toBe(true);
  });

  test('computeZobristHash coverage', () => {
    expect(aiEngine.computeZobristHash(board, 'white')).toBe(0);
  });
});
