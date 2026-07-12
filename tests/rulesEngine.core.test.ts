/**
 * Focused unit tests for js/RulesEngine.ts — the core move-legality and
 * check/checkmate/stalemate engine.
 *
 * RulesEngine only depends on a board (GameWithBoard), so these tests build
 * minimal boards and assert the *invariants* of chess rules rather than just
 * that calls resolve. No UI / Game / vitest mocks required.
 */

import { describe, test, expect } from 'vitest';
import { RulesEngine } from '../js/RulesEngine.js';
import type { Piece } from '../js/types/game.js';

const SIZE = 9;

function emptyBoard(): (Piece | null)[][] {
  return Array(SIZE)
    .fill(null)
    .map(() => Array(SIZE).fill(null) as (Piece | null)[]);
}

function put(board: (Piece | null)[][], r: number, c: number, p: Piece) {
  board[r][c] = p;
}

const K = (color: 'white' | 'black'): Piece => ({ type: 'k', color, hasMoved: true });
const P = (color: 'white' | 'black'): Piece => ({ type: 'p', color, hasMoved: true });
const R = (color: 'white' | 'black'): Piece => ({ type: 'r', color, hasMoved: true });
const B = (color: 'white' | 'black'): Piece => ({ type: 'b', color, hasMoved: true });
const N = (color: 'white' | 'black'): Piece => ({ type: 'n', color, hasMoved: true });
const Q = (color: 'white' | 'black'): Piece => ({ type: 'q', color, hasMoved: true });
// 9x9 fairy pieces: a = archbishop (B+N), c = chancellor (R+N), e = angel (Q+N)
const A = (color: 'white' | 'black'): Piece => ({ type: 'a', color, hasMoved: true });
const C = (color: 'white' | 'black'): Piece => ({ type: 'c', color, hasMoved: true });
const E = (color: 'white' | 'black'): Piece => ({ type: 'e', color, hasMoved: true });

describe('RulesEngine.isSquareUnderAttack', () => {
  test('rook attacks along an open rank/file', () => {
    const board = emptyBoard();
    put(board, 0, 0, K('white'));
    put(board, 8, 8, K('black'));
    put(board, 4, 0, R('black')); // black rook on file 0 / rank 4
    const engine = new RulesEngine({ board });
    expect(engine.isSquareUnderAttack(4, 5, 'black')).toBe(true); // same rank, open
    expect(engine.isSquareUnderAttack(2, 0, 'black')).toBe(true); // same file, open
  });

  test('rook attack is blocked by an intervening piece', () => {
    const board = emptyBoard();
    put(board, 0, 0, K('white'));
    put(board, 8, 8, K('black'));
    put(board, 4, 0, R('black'));
    put(board, 2, 0, P('white')); // blocker between rook and (1,0)
    const engine = new RulesEngine({ board });
    // (1,0) is behind the blocker from the rook -> not attacked
    expect(engine.isSquareUnderAttack(1, 0, 'black')).toBe(false);
    // (6,0) is on the open side -> attacked
    expect(engine.isSquareUnderAttack(6, 0, 'black')).toBe(true);
  });

  test('bishop attacks diagonally, knight via L-shape, pawn forward-diagonally', () => {
    const board = emptyBoard();
    put(board, 0, 0, K('white'));
    put(board, 8, 8, K('black'));
    put(board, 4, 4, B('black'));
    put(board, 2, 3, N('black'));
    put(board, 5, 3, P('black')); // black pawn attacks (4,2) and (4,4)
    const engine = new RulesEngine({ board });
    expect(engine.isSquareUnderAttack(6, 6, 'black')).toBe(true); // diagonal bishop
    expect(engine.isSquareUnderAttack(4, 2, 'black')).toBe(true); // black pawn attacks up-left
    expect(engine.isSquareUnderAttack(3, 1, 'black')).toBe(true); // knight from (2,3) -> (3,1) is a knight jump
  });

  test('a square is not attacked by a friendly-colour piece', () => {
    const board = emptyBoard();
    put(board, 0, 0, K('white'));
    put(board, 8, 8, K('black'));
    put(board, 4, 0, R('white'));
    const engine = new RulesEngine({ board });
    expect(engine.isSquareUnderAttack(4, 5, 'black')).toBe(false); // only a white rook there
  });
});

describe('RulesEngine check / checkmate / stalemate', () => {
  test('isInCheck is true when the king is attacked', () => {
    const board = emptyBoard();
    put(board, 8, 8, K('white'));
    put(board, 0, 0, K('black'));
    put(board, 8, 0, R('black')); // black rook attacks white king on same rank
    const engine = new RulesEngine({ board });
    expect(engine.isInCheck('white')).toBe(true);
    expect(engine.isInCheck('black')).toBe(false);
  });

  test('isCheckmate: king in check with no escape and no blocker', () => {
    // Back-rank style mate: white king cornered at (8,8), a black rook gives
    // check from (8,7) and is itself defended by the black king at (7,7), so
    // the white king cannot capture it and has no flight square.
    const board = emptyBoard();
    put(board, 8, 8, K('white'));
    put(board, 7, 7, K('black'));
    put(board, 8, 7, R('black')); // gives check AND is defended by black king
    const engine = new RulesEngine({ board });
    expect(engine.isInCheck('white')).toBe(true);
    expect(engine.isCheckmate('white')).toBe(true);
  });

  test('isCheckmate is false if the checked king has an escape square', () => {
    const board = emptyBoard();
    put(board, 4, 4, K('white'));
    put(board, 0, 0, K('black'));
    put(board, 4, 0, R('black')); // rook checks along rank 4
    const engine = new RulesEngine({ board });
    expect(engine.isInCheck('white')).toBe(true);
    // King can step off rank 4 -> escape, so not mate.
    expect(engine.isCheckmate('white')).toBe(false);
  });

  test('isStalemate: not in check but no legal moves', () => {
    // Black king cornered at (0,0); two white rooks cover every flight square
    // ((0,1),(1,0),(1,1)) without giving check to (0,0).
    const board = emptyBoard();
    put(board, 0, 0, K('black'));
    put(board, 0, 2, K('white'));
    put(board, 1, 2, R('white')); // covers rank 1 -> (1,0),(1,1)
    put(board, 2, 1, R('white')); // covers file 1 -> (0,1),(1,1)
    const engine = new RulesEngine({ board });
    expect(engine.isInCheck('black')).toBe(false);
    expect(engine.isStalemate('black')).toBe(true);
  });
});

describe('RulesEngine.getValidMoves legality', () => {
  test('king may not move into a square that leaves it in check', () => {
    const board = emptyBoard();
    put(board, 4, 4, K('white'));
    put(board, 0, 0, K('black'));
    put(board, 4, 0, R('black')); // black rook covers the whole rank 4
    const engine = new RulesEngine({ board });
    const moves = engine.getValidMoves(4, 4, board[4][4]!);
    // King cannot stay on rank 4 (it would be in check). All valid dests must be off rank 4.
    for (const m of moves) {
      expect(m.r).not.toBe(4);
    }
    // At least one off-rank square is available, so moves exist.
    expect(moves.length).toBeGreaterThan(0);
  });

  test('king can capture an adjacent unattacked enemy rook', () => {
    const board = emptyBoard();
    put(board, 4, 4, K('white'));
    put(board, 0, 0, K('black'));
    put(board, 4, 5, R('black')); // rook right next to king, not defended
    const engine = new RulesEngine({ board });
    const moves = engine.getValidMoves(4, 4, board[4][4]!);
    expect(moves.some(m => m.r === 4 && m.c === 5)).toBe(true);
  });
});

describe('RulesEngine.getValidMoves — absolute pins', () => {
  test('a rook pinned along a rank may only move along that rank', () => {
    // White king (4,0) — white rook (4,4) — black rook (4,8), all on rank 4.
    const board = emptyBoard();
    put(board, 4, 0, K('white'));
    put(board, 4, 4, R('white'));
    put(board, 4, 8, R('black'));
    put(board, 0, 8, K('black'));
    const engine = new RulesEngine({ board });
    const moves = engine.getValidMoves(4, 4, board[4][4]!);
    // Every legal destination must stay on rank 4 (the pin line).
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(m.r).toBe(4);
    // It may capture the pinning rook at (4,8) but never leave the rank.
    expect(moves.some(m => m.r === 4 && m.c === 8)).toBe(true);
  });

  test('a bishop pinned along a rank has no legal moves (cannot hold the line)', () => {
    // A bishop only moves diagonally, so a rank-pin freezes it completely.
    const board = emptyBoard();
    put(board, 4, 0, K('white'));
    put(board, 4, 4, B('white'));
    put(board, 4, 8, R('black'));
    put(board, 0, 8, K('black'));
    const engine = new RulesEngine({ board });
    expect(engine.getValidMoves(4, 4, board[4][4]!)).toHaveLength(0);
  });

  test('a knight pinned on a diagonal is frozen', () => {
    // White king (0,0) — white knight (2,2) — black bishop (4,4) on the a1-h8 diagonal.
    const board = emptyBoard();
    put(board, 0, 0, K('white'));
    put(board, 2, 2, N('white'));
    put(board, 4, 4, B('black'));
    put(board, 8, 8, K('black'));
    const engine = new RulesEngine({ board });
    expect(engine.getValidMoves(2, 2, board[2][2]!)).toHaveLength(0);
  });
});

describe('RulesEngine.getValidMoves — 9x9 fairy pieces', () => {
  // A friendly king at (1,0) sits off every line/diagonal through the center
  // (4,4), so it never blocks or extends the tested piece's rays. The enemy
  // king sits far away at (8,8).
  function centerMoves(pieceFactory: (c: 'white' | 'black') => Piece): number {
    const board = emptyBoard();
    put(board, 1, 0, K('white'));
    put(board, 8, 8, K('black'));
    const piece = pieceFactory('white');
    put(board, 4, 4, piece);
    return new RulesEngine({ board }).getValidMoves(4, 4, piece).length;
  }

  test('archbishop (B+N) = 24, chancellor (R+N) = 24, angel (Q+N) = 40 from center', () => {
    expect(centerMoves(A)).toBe(24);
    expect(centerMoves(C)).toBe(24);
    expect(centerMoves(E)).toBe(40);
  });

  test('compound identities: archbishop = bishop+knight, chancellor = rook+knight, angel = queen+knight', () => {
    const b = centerMoves(B);
    const r = centerMoves(R);
    const n = centerMoves(N);
    const q = centerMoves(Q);
    expect(centerMoves(A)).toBe(b + n);
    expect(centerMoves(C)).toBe(r + n);
    expect(centerMoves(E)).toBe(q + n);
  });

  test('a pinned angel may still slide along the pin line', () => {
    // Angel behaves like a queen for the pin: on rank 4 between king and rook
    // it keeps its rank moves (including capturing the pinner) but no others.
    const board = emptyBoard();
    put(board, 4, 0, K('white'));
    put(board, 4, 4, E('white'));
    put(board, 4, 8, R('black'));
    put(board, 0, 8, K('black'));
    const engine = new RulesEngine({ board });
    const moves = engine.getValidMoves(4, 4, board[4][4]!);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(m.r).toBe(4); // knight jumps & diagonals are illegal here
    expect(moves.some(m => m.c === 8)).toBe(true); // can capture the pinning rook
  });
});
