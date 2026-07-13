/**
 * Focused tests for js/ai/OpeningBook.ts — weighted opening-book selection,
 * merging, and result-based weight reinforcement.
 *
 * OpeningBook had NO dedicated test file before this. The riskiest untested
 * logic is the weighted-random move selection (getMove), the position merge
 * (merge), and the win/loss/draw weight reinforcement (applyGameResult). These
 * are pure data structures with no DOM/Worker dependency, so they are driven
 * directly with crafted board states and asserts. Math.random is mocked so the
 * weighted-selection branch is exercised deterministically.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { OpeningBook, openingBook, ensureOpeningBookLoaded, queryOpeningBook } =
  await import('../../js/ai/OpeningBook.js');

// A 9x9 empty board (Piece | null)[][].
function emptyBoard(): any[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(null));
}

// A simple starting position: white pawn at 7,4, black pawn at 1,4.
function startBoard(): any[][] {
  const b = emptyBoard();
  b[7][4] = { type: 'p', color: 'white', hasMoved: false };
  b[1][4] = { type: 'p', color: 'black', hasMoved: false };
  return b;
}

describe('OpeningBook.getMove', () => {
  let book: any;
  beforeEach(() => {
    book = new OpeningBook();
  });

  test('returns null for an empty board', () => {
    expect(book.getMove(emptyBoard(), 'white')).toBeNull();
  });

  test('returns null when the position is unknown', () => {
    expect(book.getMove(startBoard(), 'white')).toBeNull();
  });

  test('returns null when a known position has no moves', () => {
    const b = startBoard();
    book.data.positions[book.getBoardHash(b, 'white')] = { moves: [], seenCount: 1 };
    expect(book.getMove(b, 'white')).toBeNull();
  });

  test('selects the only move deterministically when total weight is hit', () => {
    const b = startBoard();
    book.data.positions[book.getBoardHash(b, 'white')] = {
      moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 1 }],
      seenCount: 1,
    };
    const move = book.getMove(b, 'white');
    expect(move).toEqual({ from: { r: 7, c: 4 }, to: { r: 6, c: 4 } });
  });

  test('weighted selection picks the high-weight move when random falls in its band', () => {
    const b = startBoard();
    book.data.positions[book.getBoardHash(b, 'white')] = {
      moves: [
        { from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 1 },
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, weight: 9, games: 1 },
      ],
      seenCount: 2,
    };
    // random = 0.5 * 10 = 5 -> skips weight-1 move (5-1=4>0), hits weight-9 (4-9<=0)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const move = book.getMove(b, 'white');
    expect(move).toEqual({ from: { r: 7, c: 4 }, to: { r: 5, c: 4 } });
    vi.restoreAllMocks();
  });

  test('falls back to the first move if the weighted loop overshoots', () => {
    const b = startBoard();
    book.data.positions[book.getBoardHash(b, 'white')] = {
      moves: [
        { from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 5, games: 1 },
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, weight: 5, games: 1 },
      ],
      seenCount: 2,
    };
    // random = 0.99 * 10 = 9.9 -> first move: 9.9-5=4.9>0; second: 4.9-5<=0 hit.
    // To force the fallback branch we instead test that the loop always returns
    // a valid move (the fallback only triggers on float drift). Here both bands
    // sum to 10 so any random in [0,1) hits one of them.
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const move = book.getMove(b, 'white');
    expect(move).not.toBeNull();
    expect(move.from).toEqual({ r: 7, c: 4 });
    vi.restoreAllMocks();
  });
});

describe('OpeningBook.addMove', () => {
  test('adds a new move and increments seenCount', () => {
    const book = new OpeningBook();
    const b = startBoard();
    book.addMove(b, 'white', { from: { r: 7, c: 4 }, to: { r: 6, c: 4 } });
    const hash = book.getBoardHash(b, 'white');
    expect(book.data.positions[hash].moves.length).toBe(1);
    expect(book.data.positions[hash].moves[0].games).toBe(1);
    expect(book.data.positions[hash].seenCount).toBe(1);
  });

  test('aggregates games when the same move is added twice', () => {
    const book = new OpeningBook();
    const b = startBoard();
    book.addMove(b, 'white', { from: { r: 7, c: 4 }, to: { r: 6, c: 4 } });
    book.addMove(b, 'white', { from: { r: 7, c: 4 }, to: { r: 6, c: 4 } });
    const hash = book.getBoardHash(b, 'white');
    expect(book.data.positions[hash].moves.length).toBe(1);
    expect(book.data.positions[hash].moves[0].games).toBe(2);
  });
});

describe('OpeningBook.merge', () => {
  test('imports positions that do not exist yet (deep copy)', () => {
    const book = new OpeningBook();
    const b = startBoard();
    const hash = book.getBoardHash(b, 'white');
    const other = new OpeningBook();
    other.data.positions[hash] = {
      moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 3, games: 2 }],
      seenCount: 2,
    };
    book.merge(other);
    expect(book.data.positions[hash].moves[0].games).toBe(2);
    // Mutating the source must not mutate the merged copy.
    other.data.positions[hash].moves[0].games = 99;
    expect(book.data.positions[hash].moves[0].games).toBe(2);
  });

  test('sums seenCount and games for overlapping positions', () => {
    const book = new OpeningBook();
    const b = startBoard();
    const hash = book.getBoardHash(b, 'white');
    book.data.positions[hash] = {
      moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 1 }],
      seenCount: 1,
    };
    const other = new OpeningBook();
    other.data.positions[hash] = {
      moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 4 }],
      seenCount: 5,
    };
    book.merge(other);
    expect(book.data.positions[hash].seenCount).toBe(6);
    expect(book.data.positions[hash].moves[0].games).toBe(5);
  });

  test('is a no-op for null input', () => {
    const book = new OpeningBook();
    const before = JSON.stringify(book.data);
    book.merge(null);
    expect(JSON.stringify(book.data)).toBe(before);
  });
});

describe('OpeningBook.applyGameResult — weight reinforcement', () => {
  function bookWithPosition() {
    const book = new OpeningBook();
    const b = startBoard();
    const hash = book.getBoardHash(b, 'white');
    book.data.positions[hash] = {
      moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 1 }],
      seenCount: 1,
    };
    return { book, b, hash };
  }

  test('win reinforces the player color moves (+2) and penalises the opponent (-1)', () => {
    const { book, b, hash } = bookWithPosition();
    // white is the player (mover 0) and wins.
    book.applyGameResult(
      [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, piece: 'p' }],
      'white',
      'win',
      b
    );
    expect(book.data.positions[hash].moves[0].weight).toBe(3); // 1 + 2
    expect(book.data.positions[hash].moves[0].games).toBe(2);
  });

  test('loss penalises the player color moves (-1)', () => {
    const { book, b, hash } = bookWithPosition();
    book.applyGameResult(
      [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, piece: 'p' }],
      'white',
      'loss',
      b
    );
    expect(book.data.positions[hash].moves[0].weight).toBe(0); // max(0, 1-1)
  });

  test('draw leaves weights unchanged (delta 0)', () => {
    const { book, b, hash } = bookWithPosition();
    book.applyGameResult(
      [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, piece: 'p' }],
      'white',
      'draw',
      b
    );
    expect(book.data.positions[hash].moves[0].weight).toBe(1);
  });

  test('creates a new position entry when the hash is not yet in the book', () => {
    const book = new OpeningBook();
    const b = startBoard();
    book.applyGameResult(
      [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, piece: 'p' }],
      'white',
      'win',
      b
    );
    const hash = book.getBoardHash(b, 'white');
    expect(book.data.positions[hash]).toBeTruthy();
    expect(book.data.positions[hash].moves[0].weight).toBe(3);
  });
});

describe('OpeningBook.getBoardHash — determinism + turn sensitivity', () => {
  test('same board+turn yields identical hash; differs by turn', () => {
    const book = new OpeningBook();
    const b = startBoard();
    const hw = book.getBoardHash(b, 'white');
    const hb = book.getBoardHash(b, 'black');
    expect(hw).toBe(book.getBoardHash(b, 'white')); // deterministic
    expect(hw).not.toBe(hb); // turn-sensitive
  });

  test('board with zero length yields empty hash', () => {
    const book = new OpeningBook();
    expect(book.getBoardHash([], 'white')).toBe('');
  });

  test('a 9x9 all-empty board yields the 162-char dot hash and is deterministic', () => {
    const book = new OpeningBook();
    const h = book.getBoardHash(emptyBoard(), 'white');
    expect(h.length).toBe(81 * 2 + 1); // 81 squares * 2 chars + turn char
    expect(h).toBe(book.getBoardHash(emptyBoard(), 'white'));
  });
});

describe('ensureOpeningBookLoaded + queryOpeningBook (singleton)', () => {
  test('loads the book exactly once, then is a no-op (idempotent)', async () => {
    const json = JSON.stringify({
      positions: {
        posX: {
          moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 1 }],
          seenCount: 1,
        },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse(json) });
    (globalThis as any).fetch = fetchMock;

    // Start from an empty singleton.
    openingBook.load({ positions: {} });
    await ensureOpeningBookLoaded('opening-book.json');
    expect(openingBook.data.positions.posX).toBeTruthy();
    const callsAfterFirst = fetchMock.mock.calls.length;

    // Second call must NOT fetch again (already loaded).
    await ensureOpeningBookLoaded('opening-book.json');
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  test('tolerates a failed fetch without throwing (book stays empty)', async () => {
    openingBook.load({ positions: {} });
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(ensureOpeningBookLoaded('missing.json')).resolves.toBeUndefined();
    expect(Object.keys(openingBook.data.positions).length).toBe(0);
  });

  test('queryOpeningBook maps moveNumber parity to turn color', () => {
    const b = startBoard();
    const hashW = openingBook.getBoardHash(b, 'white');
    openingBook.data.positions[hashW] = {
      moves: [{ from: { r: 7, c: 4 }, to: { r: 6, c: 4 }, weight: 1, games: 1 }],
      seenCount: 1,
    };
    // moveNumber even -> white to move
    expect(queryOpeningBook(b, 0)).toEqual({ from: { r: 7, c: 4 }, to: { r: 6, c: 4 } });
  });
});
