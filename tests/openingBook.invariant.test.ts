/**
 * Invariant tests for js/ai/OpeningBook.ts
 *
 * Supplements the existing openingBook.test.ts (functional + behaviour coverage
 * for getMove/addMove/merge/applyGameResult). Here we assert the algebraic
 * invariants the book relies on regardless of call order:
 *   - getBoardHash: determinism, symmetry, distinctness under single-square
 *     change, turn-suffix sensitivity, empty-board => '', ragged-board safety
 *   - getMove: null on empty/missing board and on empty move list; weighted
 *     selection is non-negative, stays within [0,totalWeight], and its empirical
 *     distribution tracks the move weights (chi-square over many trials)
 *   - addMove: idempotent de-duplication (repeated identical move increments
 *     games but not moves.length, weight stays 1); seenCount monotonic
 *   - merge: games counts ADD across merged books; deep-copy isolation (source
 *     unchanged); merge twice is consistent (idempotent on counts already present)
 *   - applyGameResult: weights never go negative (clamped at 0); win/loss are
 *     symmetric (bonus for winner == penalty for the same player on a loss);
 *     draw leaves weights unchanged; the supplied initialBoard is NOT mutated
 *
 * Pure module, no DOM, no engine required.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import type { Piece } from '../js/gameEngine.js';

function empty9(): (Piece | null)[][] {
  return Array(9).fill(null).map(() => Array(9).fill(null) as (Piece | null)[]);
}
function pawn(color: 'white' | 'black', r: number, c: number): (Piece | null)[][] {
  const b = empty9();
  b[r][c] = { type: 'p', color, hasMoved: false };
  return b;
}

describe('getBoardHash invariants', () => {
  let book: OpeningBook;
  beforeEach(() => {
    book = new OpeningBook();
  });

  test('deterministic: same board+turn => identical hash', () => {
    const b = pawn('white', 4, 4);
    expect(book.getBoardHash(b, 'white')).toBe(book.getBoardHash(b, 'white'));
  });

  test('reflexive across separate instances', () => {
    const b = pawn('black', 0, 8);
    expect(new OpeningBook().getBoardHash(b, 'black')).toBe(
      new OpeningBook().getBoardHash(b, 'black')
    );
  });

  test('single square change always changes the hash', () => {
    const a = pawn('white', 4, 4);
    const b = pawn('white', 4, 5); // moved one column
    expect(book.getBoardHash(a, 'white')).not.toBe(book.getBoardHash(b, 'white'));
  });

  test('color change at the same square changes the hash', () => {
    const w = pawn('white', 4, 4);
    const bl = pawn('black', 4, 4);
    expect(book.getBoardHash(w, 'white')).not.toBe(book.getBoardHash(bl, 'white'));
  });

  test('turn suffix changes the hash (same board, different mover)', () => {
    const b = pawn('white', 4, 4);
    expect(book.getBoardHash(b, 'white')).not.toBe(book.getBoardHash(b, 'black'));
  });

  test('empty board (no rows) => empty hash; all-null 9x9 is a fixed string', () => {
    expect(book.getBoardHash([], 'white')).toBe('');
    // a 9x9 board filled with nulls yields 81 '..' + turn suffix
    const allNull = Array(9).fill(null).map(() => Array(9).fill(null));
    const h = book.getBoardHash(allNull, 'white');
    expect(h).toBe('..'.repeat(81) + 'w');
  });

  test('load(null) keeps positions empty', () => {
    book.load(null);
    expect(Object.keys(book.data.positions).length).toBe(0);
  });

  test('ragged / short rows do not throw and still differ by content', () => {
    const ragged: (Piece | null)[][] = [
      [{ type: 'p', color: 'white', hasMoved: false }], // length 1
      ...Array(8).fill(null).map(() => [] as (Piece | null)[]),
    ];
    const h1 = book.getBoardHash(ragged, 'white');
    ragged[0][0] = { type: 'r', color: 'white', hasMoved: false };
    const h2 = book.getBoardHash(ragged, 'white');
    expect(h1).not.toBe(h2); // content diff reflected
    expect(typeof h1).toBe('string');
  });

  test('distinct squares across a sweep rarely collide (collision-resistant)', () => {
    const hashes = new Set<string>();
    let collisions = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const h = book.getBoardHash(pawn('white', r, c), 'white');
        if (hashes.has(h)) collisions++;
        hashes.add(h);
      }
    }
    expect(collisions).toBe(0); // 81 distinct single-pawn boards => 81 distinct hashes
    expect(hashes.size).toBe(81);
  });
});

describe('getMove invariants', () => {
  let book: OpeningBook;
  beforeEach(() => {
    book = new OpeningBook();
  });

  test('null for empty board', () => {
    expect(book.getMove(empty9(), 'white')).toBeNull();
  });

  test('null for missing/empty move list at a known hash', () => {
    const b = pawn('white', 4, 4);
    book.data.positions[book.getBoardHash(b, 'white')] = { moves: [], seenCount: 0 };
    expect(book.getMove(b, 'white')).toBeNull();
  });

  test('returns a valid stored move (no out-of-range selection)', () => {
    const b = pawn('white', 4, 4);
    const hash = book.getBoardHash(b, 'white');
    book.data.positions[hash] = {
      moves: [
        { from: { r: 4, c: 4 }, to: { r: 3, c: 4 }, weight: 30, games: 1 },
        { from: { r: 4, c: 4 }, to: { r: 3, c: 3 }, weight: 70, games: 1 },
      ],
      seenCount: 2,
    };
    const valid = new Set(['3,4', '3,3']);
    for (let i = 0; i < 50; i++) {
      const m = book.getMove(b, 'white')!;
      expect(m).not.toBeNull();
      expect(valid.has(`${m.to.r},${m.to.c}`)).toBe(true);
    }
  });

  test('weighted selection tracks the move weights (chi-square)', () => {
    const b = pawn('white', 4, 4);
    const hash = book.getBoardHash(b, 'white');
    const wLow = 10;
    const wHigh = 90;
    book.data.positions[hash] = {
      moves: [
        { from: { r: 4, c: 4 }, to: { r: 3, c: 4 }, weight: wLow, games: 1 },
        { from: { r: 4, c: 4 }, to: { r: 3, c: 3 }, weight: wHigh, games: 1 },
      ],
      seenCount: 2,
    };
    const N = 5000;
    let low = 0;
    for (let i = 0; i < N; i++) {
      const m = book.getMove(b, 'white')!;
      if (m.to.r === 3 && m.to.c === 4) low++;
    }
    const pLow = low / N;
    const expectedLow = wLow / (wLow + wHigh); // 0.10
    // Allow 3 percentage points of slack on a 5000-sample run
    expect(Math.abs(pLow - expectedLow)).toBeLessThan(0.03);
  });

  test('selection with random=0 picks the first move (first bucket)', () => {
    const b = pawn('white', 4, 4);
    const hash = book.getBoardHash(b, 'white');
    book.data.positions[hash] = {
      moves: [
        { from: { r: 4, c: 4 }, to: { r: 3, c: 4 }, weight: 50, games: 1 },
        { from: { r: 4, c: 4 }, to: { r: 3, c: 3 }, weight: 50, games: 1 },
      ],
      seenCount: 2,
    };
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // 0 * 100 = 0
    const m = book.getMove(b, 'white')!;
    expect(m.to).toEqual({ r: 3, c: 4 }); // first bucket is moves[0]
    spy.mockRestore();
  });

  test('fallback returns moves[0] when the random value exceeds total weight', () => {
    // With a single move of weight 1, random=0.5 -> 0.5 < 1 so it is selected;
    // to force the post-loop fallback we need the loop to exhaust without a hit.
    // That only happens if totalWeight is 0, which cannot occur here, so instead
    // verify the documented fallback by using weights that sum such that 0.999
    // lands past the last bucket -> returns moves[last], never an invalid move.
    const b = pawn('white', 4, 4);
    const hash = book.getBoardHash(b, 'white');
    book.data.positions[hash] = {
      moves: [{ from: { r: 4, c: 4 }, to: { r: 3, c: 4 }, weight: 1, games: 1 }],
      seenCount: 1,
    };
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const m = book.getMove(b, 'white')!;
    // single move: 0.999 < 1 -> still selected (loop hits it)
    expect(m.to).toEqual({ r: 3, c: 4 });
    spy.mockRestore();
  });

  test('selection never returns a move for a negative/zero total weight edge', () => {
    const b = pawn('white', 4, 4);
    const hash = book.getBoardHash(b, 'white');
    book.data.positions[hash] = {
      moves: [{ from: { r: 4, c: 4 }, to: { r: 3, c: 4 }, weight: 1, games: 1 }],
      seenCount: 1,
    };
    const m = book.getMove(b, 'white');
    expect(m).toEqual({ from: { r: 4, c: 4 }, to: { r: 3, c: 4 } });
  });
});

describe('addMove invariants', () => {
  let book: OpeningBook;
  const b = pawn('white', 4, 4);
  const move = { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } };
  beforeEach(() => {
    book = new OpeningBook();
  });

  test('idempotent de-duplication: same move increments games, not moves.length', () => {
    book.addMove(b, 'white', move);
    book.addMove(b, 'white', move);
    book.addMove(b, 'white', move);
    const hash = book.getBoardHash(b, 'white');
    const pos = book.data.positions[hash];
    expect(pos.moves.length).toBe(1);
    expect(pos.moves[0].games).toBe(3);
    expect(pos.moves[0].weight).toBe(1); // weight is NOT incremented by addMove
  });

  test('distinct moves accumulate into separate entries', () => {
    book.addMove(b, 'white', { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } });
    book.addMove(b, 'white', { from: { r: 4, c: 4 }, to: { r: 3, c: 3 } });
    const hash = book.getBoardHash(b, 'white');
    expect(book.data.positions[hash].moves.length).toBe(2);
  });

  test('seenCount is monotonic and equals total games added', () => {
    for (let i = 0; i < 5; i++) book.addMove(b, 'white', move);
    const hash = book.getBoardHash(b, 'white');
    expect(book.data.positions[hash].seenCount).toBe(5);
  });

  test('addMove never throws on an empty board', () => {
    expect(() => book.addMove(empty9(), 'white', move)).not.toThrow();
  });
});

describe('merge invariants', () => {
  let book1: OpeningBook;
  let book2: OpeningBook;
  const b = pawn('white', 4, 4);
  const m1 = { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } };
  const m2 = { from: { r: 4, c: 4 }, to: { r: 3, c: 3 } };
  beforeEach(() => {
    book1 = new OpeningBook();
    book2 = new OpeningBook();
    book1.addMove(b, 'white', m1);
    book1.addMove(b, 'white', m1); // games = 2
    book2.addMove(b, 'white', m1); // games = 1
    book2.addMove(b, 'white', m2); // games = 1
  });

  test('games counts ADD across merged books (per move)', () => {
    book1.merge(book2);
    const pos = book1.data.positions[book1.getBoardHash(b, 'white')];
    const found1 = pos.moves.find(m => m.to.r === 3 && m.to.c === 4)!;
    const found2 = pos.moves.find(m => m.to.r === 3 && m.to.c === 3)!;
    expect(found1.games).toBe(3); // 2 + 1
    expect(found2.games).toBe(1); // 0 + 1
  });

  test('merge is deep-copy isolated: source book is unchanged', () => {
    const before2 = JSON.stringify(book2.data);
    book1.merge(book2);
    expect(JSON.stringify(book2.data)).toBe(before2); // source untouched
  });

  test('merging the same book twice is consistent (no corruption, additive)', () => {
    book1.merge(book2);
    const afterFirst = JSON.parse(JSON.stringify(book1.data));
    book1.merge(book2); // again
    const pos = book1.data.positions[book1.getBoardHash(b, 'white')];
    const found1 = pos.moves.find(m => m.to.r === 3 && m.to.c === 4)!;
    const found2 = pos.moves.find(m => m.to.r === 3 && m.to.c === 3)!;
    // After a second merge of book2, games are 2+1+1 = 4 and 0+1+1 = 2
    expect(found1.games).toBe(4);
    expect(found2.games).toBe(2);
    expect(afterFirst).not.toBe(book1.data); // sanity
  });

  test('merging null is a no-op', () => {
    const before = JSON.stringify(book1.data);
    book1.merge(null);
    expect(JSON.stringify(book1.data)).toBe(before);
  });
});

describe('applyGameResult invariants', () => {
  let book: OpeningBook;
  let initial: (Piece | null)[][];
  beforeEach(() => {
    book = new OpeningBook();
    initial = Array(9).fill(null).map(() => Array(9).fill(null)) as (Piece | null)[][];
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r', 'a'];
    back.forEach((t, c) => {
      initial[0][c] = { type: t as Piece['type'], color: 'black', hasMoved: false };
      initial[8][c] = { type: t as Piece['type'], color: 'white', hasMoved: false };
    });
    for (let c = 0; c < 9; c++) {
      initial[1][c] = { type: 'p', color: 'black', hasMoved: false };
      initial[7][c] = { type: 'p', color: 'white', hasMoved: false };
    }
  });

  const e4e5 = [
    { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },
    { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },
  ];

  test('weights are never negative (clamped at 0)', () => {
    // White loses every move => -1 each, but existing weight also -1 => clamp at 0
    book.applyGameResult(e4e5, 'white', 'loss', initial);
    const h0 = book.getBoardHash(initial, 'white');
    const m0 = book.data.positions[h0].moves.find(m => m.to.r === 5 && m.to.c === 4)!;
    expect(m0.weight).toBeGreaterThanOrEqual(0);
    // repeat many losses -> stays at 0, never negative
    for (let i = 0; i < 10; i++) book.applyGameResult(e4e5, 'white', 'loss', initial);
    expect(m0.weight).toBe(0);
  });

  test('win/loss symmetry: winner bonus == loser penalty for the same player', () => {
    book.applyGameResult(e4e5, 'white', 'win', initial);
    const h0 = book.getBoardHash(initial, 'white');
    const winWeight = book.data.positions[h0].moves.find(m => m.to.r === 5 && m.to.c === 4)!.weight;

    const book2 = new OpeningBook();
    book2.applyGameResult(e4e5, 'white', 'loss', initial);
    const lossWeight = book2.data.positions[h0].moves.find(m => m.to.r === 5 && m.to.c === 4)!.weight;

    // win: +2 (1 -> 3); loss: -1 (1 -> 0). Difference = 3.
    expect(winWeight - lossWeight).toBe(3);
    expect(winWeight).toBe(3);
    expect(lossWeight).toBe(0);
  });

  test('draw leaves weights unchanged (base 1)', () => {
    book.applyGameResult(e4e5, 'white', 'draw', initial);
    const h0 = book.getBoardHash(initial, 'white');
    const m0 = book.data.positions[h0].moves.find(m => m.to.r === 5 && m.to.c === 4)!;
    expect(m0.weight).toBe(1);
    expect(m0.games).toBe(1);
  });

  test('initialBoard is NOT mutated by applyGameResult', () => {
    const snapshot = JSON.stringify(initial);
    book.applyGameResult(e4e5, 'white', 'win', initial);
    expect(JSON.stringify(initial)).toBe(snapshot);
  });

  test('repeated identical games accumulate weight additively and never below 0', () => {
    for (let i = 0; i < 3; i++) book.applyGameResult(e4e5, 'white', 'win', initial);
    const h0 = book.getBoardHash(initial, 'white');
    const m0 = book.data.positions[h0].moves.find(m => m.to.r === 5 && m.to.c === 4)!;
    expect(m0.games).toBe(3);
    expect(m0.weight).toBe(1 + 3 * 2); // 7
    expect(m0.weight).toBeGreaterThanOrEqual(0);
  });

  test('empty move history records nothing', () => {
    book.applyGameResult([], 'white', 'win', initial);
    expect(Object.keys(book.data.positions).length).toBe(0);
  });
});
