import { describe, test, expect } from 'vitest';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';

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
});
