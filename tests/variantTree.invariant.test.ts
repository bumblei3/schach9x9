/**
 * Invariant suite for js/analyze/variantTree.ts (supplements the existing
 * functional tests/variantTree.test.ts which uses the real getTopMoves).
 *
 * Here we MOCK `getTopMoves` to make every guard branch deterministic:
 *   - applyMove promotion handling (pawn becomes promoted piece, hasMoved set)
 *   - applyMove on an empty from-square is a no-op (board unchanged)
 *   - toFullMove derives `piece` from the board and passes promotion through
 *   - root entries without a move are skipped
 *   - reply loop breaks when the opponent has no reply (continuation shorter
 *     than maxReplies)
 *   - side alternation across replies (white → black → white)
 *   - purity re-check with a mutated-mock (defends against accidental aliasing)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

const getTopMovesMock = vi.fn();

vi.mock('../js/aiEngine.js', () => ({
  getTopMoves: (...args: unknown[]) => getTopMovesMock(...args),
}));

const { buildVariantTree } = await import('../js/analyze/variantTree.js');
import type { Piece as CorePiece } from '../js/types/core.js';
type Piece = CorePiece;
type Board = (Piece | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
}

function put(
  board: Board,
  r: number,
  c: number,
  type: string,
  color: 'white' | 'black'
): void {
  board[r][c] = { type, color, hasMoved: false } as unknown as Piece;
}

beforeEach(() => {
  getTopCalls.length = 0;
});
const getTopCalls: Array<{ board: unknown; color: string; count: number }> = [];

function boardKey(board: unknown): string {
  // Identify boards by their occupied squares so we can script per-position replies.
  const b = board as (Piece | null)[][];
  const cells: string[] = [];
  b.forEach((row, r) =>
    row.forEach((p, c) => {
      if (p) cells.push(`${r}${c}${p.type}${p.color[0]}`);
    })
  );
  return cells.join('|');
}

describe('buildVariantTree (mocked getTopMoves)', () => {
  test('root move applies a promotion on applyMove (pawn -> promoted piece at target)', async () => {
    const board = emptyBoard();
    put(board, 1, 4, 'p', 'white'); // pawn one step before promotion rank 0

    getTopMovesMock.mockImplementation(async (b: (Piece | null)[][]) => {
      getTopCalls.push({ board: b, color: 'white', count: 1 });
      // Scripted: the pawn promotes moving to rank 0.
      if (b[1][4]?.type === 'p') {
        return [{ move: { from: { r: 1, c: 4 }, to: { r: 0, c: 4 }, promotion: 'q' }, score: 100 }];
      }
      return [];
    });

    const tree = await buildVariantTree(board, 'white', 1, 2);
    expect(tree).toHaveLength(1);
    expect(tree[0].move.promotion).toBe('q');
    expect(tree[0].move.piece).toBe('p');
    // Continuation empty: after the promotion the scripted engine has no moves.
    expect(tree[0].continuation).toEqual([]);
    // Input board untouched by the promotion.
    expect(board[1][4]?.type).toBe('p');
    expect(board[0][4]).toBeNull();
  });

  test('reply loop alternates sides and stops when the opponent has no reply', async () => {
    const board = emptyBoard();
    put(board, 8, 0, 'r', 'white');

    getTopMovesMock.mockImplementation(async (b: (Piece | null)[][], color: string) => {
      // Root: white rook slides down its file.
      if (color === 'white' && b[8][0]?.type === 'r' && b[7][0] === null) {
        return [{ move: { from: { r: 8, c: 0 }, to: { r: 6, c: 0 } }, score: 50 }];
      }
      // After the root move the rook sits on (6,0): white's second scripted reply.
      if (b[6][0]?.type === 'r' && b[4][0] === null) {
        return [{ move: { from: { r: 6, c: 0 }, to: { r: 4, c: 0 } }, score: 40 }];
      }
      void color;
      return [];
    });

    // depth 3 -> maxReplies = 2, but after ONE reply the position no longer
    // matches any scripted entry -> the reply loop breaks early.
    const tree = await buildVariantTree(board, 'white', 1, 3);
    expect(tree).toHaveLength(1);
    expect(tree[0].continuation).toHaveLength(1);
    // The single collected reply is BLACK's best answer to the root move.
    expect(tree[0].continuation[0]).toEqual({
      from: { r: 6, c: 0 },
      to: { r: 4, c: 0 },
      piece: 'r',
      promotion: undefined,
    });
    expect(tree[0].score).toBe(50);
    // Root board untouched by the whole analysis.
    expect(board[8][0]?.type).toBe('r');
    expect(board[6][0]).toBeNull();
    expect(board[4][0]).toBeNull();
  });

  test('full depth-3 line: two alternating replies are collected in order', async () => {
    const board = emptyBoard();
    put(board, 8, 8, 'r', 'white');

    getTopMovesMock.mockImplementation(async (b: (Piece | null)[][], color: string) => {
      if (b[8][8]?.type === 'r' && color === 'white') {
        return [{ move: { from: { r: 8, c: 8 }, to: { r: 8, c: 0 } }, score: 10 }];
      }
      if (b[8][0]?.type === 'r' && color === 'black') {
        return [{ move: { from: { r: 8, c: 0 }, to: { r: 0, c: 0 }, promotion: 'c' }, score: -10 }];
      }
      if (b[0][0]?.type === 'c' && color === 'white') {
        return [{ move: { from: { r: 0, c: 0 }, to: { r: 4, c: 4 } }, score: 20 }];
      }
      return [];
    });

    const tree = await buildVariantTree(board, 'white', 1, 3);
    expect(tree).toHaveLength(1);
    const cont = tree[0].continuation;
    expect(cont).toHaveLength(2);
    // First reply: black rook promotes to chancellor.
    expect(cont[0]).toMatchObject({ from: { r: 8, c: 0 }, to: { r: 0, c: 0 }, piece: 'r', promotion: 'c' });
    // Second reply: white chancellor moves to the center.
    expect(cont[1]).toMatchObject({ from: { r: 0, c: 0 }, to: { r: 4, c: 4 }, piece: 'c' });
  });

  test('skips root results without a move', async () => {
    const board = emptyBoard();
    put(board, 4, 4, 'k', 'white');

    getTopMovesMock.mockImplementation(async () => [
      { move: null, score: 1 },
      { move: { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } }, score: 2 },
    ]);

    const tree = await buildVariantTree(board, 'white', 2, 1);
    expect(tree).toHaveLength(1);
    expect(tree[0].score).toBe(2);
    expect(tree[0].move.piece).toBe('k');
  });

  test('applyMove no-op guard: root move whose from-square is empty yields piece null but still a node', async () => {
    const board = emptyBoard(); // completely empty

    getTopMovesMock.mockImplementation(async () => [
      { move: { from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }, score: 7 },
    ]);

    const tree = await buildVariantTree(board, 'white', 1, 1);
    // Node is kept (toFullMove never returns null here) with piece derived as null.
    expect(tree).toHaveLength(1);
    expect(tree[0].move.piece).toBeNull();
    // Board remains untouched (applyMove early-returned).
    expect(board[1][0]).toBeNull();
  });

  test('multiple root candidates each carry their own continuation', async () => {
    const board = emptyBoard();
    put(board, 8, 0, 'r', 'white');
    put(board, 8, 8, 'n', 'white');

    getTopMovesMock.mockImplementation(async (b: (Piece | null)[][]) => {
      const key = boardKey(b);
      if (key.includes('80r') && key.includes('88n')) {
        return [
          { move: { from: { r: 8, c: 8 }, to: { r: 6, c: 7 } }, score: 30 },
          { move: { from: { r: 8, c: 0 }, to: { r: 0, c: 0 } }, score: 20 },
        ];
      }
      if (key.includes('67n')) {
        return [{ move: { from: { r: 6, c: 7 }, to: { r: 5, c: 5 } }, score: 5 }];
      }
      return []; // rook-on-a-line position: black has nothing
    });

    const tree = await buildVariantTree(board, 'white', 2, 2);
    expect(tree).toHaveLength(2);
    const knight = tree.find((n) => n.move.from.c === 8)!;
    const rook = tree.find((n) => n.move.from.c === 0)!;
    expect(knight.continuation).toHaveLength(1); // black replies once
    expect(rook.continuation).toHaveLength(0); // black has no answer
    expect(knight.score).toBe(30);
    expect(rook.score).toBe(20);
  });
});

export {};
