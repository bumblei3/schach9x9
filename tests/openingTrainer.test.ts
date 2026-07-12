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
});
