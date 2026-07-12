import { describe, test, expect } from 'vitest';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import type { Piece } from '../js/gameEngine.js';

describe('OpeningTrainerManager', () => {
  test('loads book data and exposes at least one trainable position', () => {
    const book = new OpeningBook();
    book.load({
      positions: {
        h1: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition();
    expect(pos).not.toBeNull();
    expect(pos!.expectedMove).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
  });

  test('listPositions skips entries with no moves', () => {
    const book = new OpeningBook();
    book.load({ positions: { empty: { moves: [], seenCount: 0 } } });
    const mgr = new OpeningTrainerManager(book);
    expect(mgr.listPositions()).toHaveLength(0);
    expect(mgr.getNextPosition()).toBeNull();
  });

  test('tie in weight keeps the first move as expectedMove', () => {
    const book = new OpeningBook();
    book.load({
      positions: {
        tie: {
          moves: [
            { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 },
            { from: { r: 2, c: 2 }, to: { r: 3, c: 3 }, weight: 100, games: 10 },
          ],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    expect(mgr.getNextPosition()!.expectedMove).toEqual({
      from: { r: 0, c: 0 },
      to: { r: 1, c: 1 },
    });
  });

  test('getNextPosition returns a valid member when the book has multiple positions', () => {
    const book = new OpeningBook();
    const p1 = { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 };
    const p2 = { from: { r: 2, c: 2 }, to: { r: 3, c: 3 }, weight: 90, games: 8 };
    const p3 = { from: { r: 4, c: 4 }, to: { r: 5, c: 5 }, weight: 80, games: 7 };
    book.load({
      positions: {
        'pos-a': { moves: [p1], seenCount: 1 },
        'pos-b': { moves: [p2], seenCount: 1 },
        'pos-c': { moves: [p3], seenCount: 1 },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const all = mgr.listPositions();
    expect(all).toHaveLength(3);
    const next = mgr.getNextPosition()!;
    expect(all).toContainEqual(next);
  });

  test('correct move increments streak and accuracy', () => {
    const book = new OpeningBook();
    book.load({
      positions: {
        h1: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition()!;
    const res = mgr.submitMove(pos, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
    expect(res.correct).toBe(true);
    expect(mgr.progress.streak).toBe(1);
    expect(mgr.progress.correct).toBe(1);
    expect(mgr.accuracy).toBe(1);
  });

  test('wrong move resets streak but records attempt', () => {
    const book = new OpeningBook();
    book.load({
      positions: {
        h1: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition()!;
    const res = mgr.submitMove(pos, { from: { r: 2, c: 2 }, to: { r: 3, c: 3 } });
    expect(res.correct).toBe(false);
    expect(res.expected).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
    expect(mgr.progress.streak).toBe(0);
    expect(mgr.progress.attempts).toBe(1);
    expect(mgr.accuracy).toBe(0);
  });

  test('reconstructBoard turns a hash back into a renderable board + turn', () => {
    const book = new OpeningBook();
    const board: (Piece | null)[][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => null)
    );
    board[0][0] = { type: 'p', color: 'white', hasMoved: false };
    const hash = book.getBoardHash(board, 'white');
    book.load({
      positions: {
        [hash]: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition()!;
    const recon = mgr.reconstructBoard(pos.hash);
    expect(recon.board.length).toBe(9);
    expect(recon.turn).toBe('white');
    expect(recon.board[0][0]).not.toBeNull();
    expect((recon.board[0][0] as Piece).type).toBe('p');
    expect((recon.board[0][0] as Piece).color).toBe('white');
    expect(recon.board[1][1]).toBeNull();
  });

  test('reconstructBoard decodes black pieces and black turn', () => {
    const book = new OpeningBook();
    const board: (Piece | null)[][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => null)
    );
    board[2][3] = { type: 'r', color: 'black', hasMoved: false };
    board[5][5] = { type: 'k', color: 'black', hasMoved: false };
    const hash = book.getBoardHash(board, 'black');
    book.load({
      positions: {
        [hash]: {
          moves: [{ from: { r: 2, c: 3 }, to: { r: 2, c: 4 }, weight: 90, games: 5 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition()!;
    const recon = mgr.reconstructBoard(pos.hash);
    expect(recon.turn).toBe('black');
    expect((recon.board[2][3] as Piece).color).toBe('black');
    expect((recon.board[2][3] as Piece).type).toBe('r');
    expect((recon.board[5][5] as Piece).color).toBe('black');
    expect((recon.board[5][5] as Piece).type).toBe('k');
    expect(recon.board[0][0]).toBeNull();
  });

  test('reconstructBoard round-trips a mixed multi-piece board', () => {
    const book = new OpeningBook();
    const board: (Piece | null)[][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => null)
    );
    board[0][0] = { type: 'p', color: 'white', hasMoved: false };
    board[0][8] = { type: 'p', color: 'white', hasMoved: false };
    board[8][0] = { type: 'p', color: 'black', hasMoved: false };
    board[4][4] = { type: 'q', color: 'white', hasMoved: false };
    const hash = book.getBoardHash(board, 'white');
    book.load({
      positions: {
        [hash]: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition()!;
    const recon = mgr.reconstructBoard(pos.hash);
    expect(recon.turn).toBe('white');
    expect((recon.board[0][0] as Piece).type).toBe('p');
    expect((recon.board[8][0] as Piece).color).toBe('black');
    expect((recon.board[4][4] as Piece).type).toBe('q');
    expect(recon.board[3][3]).toBeNull();
  });
});
