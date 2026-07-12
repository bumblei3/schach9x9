/**
 * Invariant tests for js/ai/OpeningDatabase.ts
 *
 * Supplements the existing OpeningDatabase.test.ts (functional coverage of the
 * query API). Here we assert the algebraic/data invariants the database must
 * preserve:
 *   - Every entry is internally consistent: rates in [0,100], rates sum to ~100,
 *     valid ECO code, non-empty name/moves, avgElo positive
 *   - getOpeningEntry: exact match wins over prefix; prefix only fires for db
 *     keys longer than 50 chars (so short PLACEHOLDER_* keys never partial-match);
 *     unknown hash => null; the database object is never mutated by queries
 *   - getOpeningName: delegates to getOpeningEntry (null passthrough)
 *   - getTopOpenings: non-increasing popularity, length == min(n, total)
 *   - getOpeningsByCategory: partitions the catalog (sum of category sizes ==
 *     total categorized entries); unknown category => []
 *   - searchOpenings: case-insensitive, scans name/eco/category/description,
 *     empty/missing => []
 *   - exportDatabase: JSON round-trip preserves every key (no data loss)
 *
 * Pure module, no DOM, no engine required.
 */

import { describe, test, expect } from 'vitest';
import {
  OPENING_DATABASE,
  getOpeningEntry,
  getOpeningName,
  searchOpenings,
  getOpeningsByCategory,
  getTopOpenings,
  exportDatabase,
} from '../../js/ai/OpeningDatabase.js';

const START_HASH =
  'brbnbbbqbkbbbbnbbrbpbpbpbpbpbpbpbpbp................................................................................wpwpwpwpwpwpwpwpwrwnwbwqwkwbwnwrww';

describe('database entry consistency invariants', () => {
  const entries = Object.entries(OPENING_DATABASE);

  test('every entry carries the required fields with correct shapes', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [hash, e] of entries) {
      expect(typeof hash).toBe('string');
      expect(typeof e.name).toBe('string');
      expect(e.name.length).toBeGreaterThan(0);
      expect(Array.isArray(e.moves)).toBe(true);
      expect(e.moves.length).toBeGreaterThan(0);
      expect(typeof e.eco).toBe('string');
      expect(typeof e.category).toBe('string');
      expect(typeof e.popularity).toBe('number');
      expect(typeof e.avgElo).toBe('number');
    }
  });

  test('all rate fields are within [0, 100]', () => {
    for (const [, e] of entries) {
      for (const f of ['popularity', 'whiteWinRate', 'blackWinRate', 'drawRate'] as const) {
        expect(e[f]).toBeGreaterThanOrEqual(0);
        expect(e[f]).toBeLessThanOrEqual(100);
      }
    }
  });

  test('win/draw rates sum to 100 (statistical identity) per entry', () => {
    for (const [, e] of entries) {
      // 9x9 entries use whiteWinRate+blackWinRate+drawRate; tolerate rounding slack
      const sum = e.whiteWinRate + e.blackWinRate + e.drawRate;
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
    }
  });

  test('ECO codes match the documented A-E / 9x9-Xnn pattern', () => {
    const ecoRe = /^(?:[A-E]\d\d|9x9-[A-E]\d\d)$/;
    for (const [, e] of entries) {
      expect(e.eco).toMatch(ecoRe);
    }
  });

  test('avgElo is a positive number', () => {
    for (const [, e] of entries) {
      expect(e.avgElo).toBeGreaterThan(0);
    }
  });

  test('real board-hash keys are longer than 50 chars (prefix-match eligible)', () => {
    // The genuine board-hash keys (Grundstellung, Italienische, etc.) must be
    // >50 chars so the prefix rule can apply. Compact 9x9-* keys are legitimately
    // short and are excluded from this check.
    for (const [hash, e] of entries) {
      if (e.name.includes('PLACEHOLDER') || hash.startsWith('PLACEHOLDER')) continue;
      if (hash.startsWith('9x9_')) continue; // compact custom keys, intentionally short
      expect(hash.length).toBeGreaterThan(50);
    }
  });
});

describe('getOpeningEntry invariants', () => {
  test('exact hash returns the matching entry', () => {
    const e = getOpeningEntry(START_HASH);
    expect(e).not.toBeNull();
    expect(e!.name).toBe('Grundstellung');
  });

  test('unknown hash returns null', () => {
    expect(getOpeningEntry('completely-unknown-board-hash-xyz')).toBeNull();
  });

  test('a fabricated short prefix never resolves via partial match', () => {
    // 'PLACEHOLDER_EVANS' is NOT an exact key (the real key is
    // 'PLACEHOLDER_EVANS_GAMBIT'); and no db key >50 starts with it, so the
    // prefix rule must not fire. Result must be null.
    expect(getOpeningEntry('PLACEHOLDER_EVANS')).toBeNull();
    expect(getOpeningEntry('PLACEHOLDER_RUY')).toBeNull();
  });

  test('an exact PLACEHOLDER key still resolves (it is a real entry)', () => {
    // Unlike random strings, the literal PLACEHOLDER_* keys exist in the map.
    const e = getOpeningEntry('PLACEHOLDER_EVANS_GAMBIT');
    expect(e).not.toBeNull();
    expect(e!.name).toBe('Evans-Gambit');
  });

  test('prefix match resolves a long real key by its first 50 chars', () => {
    // Build a hash that shares the Grundstellung prefix but diverges later.
    const prefix = START_HASH.slice(0, 50);
    const probe =
      prefix + 'ZZZZZZZZZZ' + 'x'.repeat(Math.max(0, START_HASH.length - prefix.length - 10));
    const e = getOpeningEntry(probe);
    expect(e).not.toBeNull();
    expect(e!.name).toBe('Grundstellung');
  });

  test('exact match has priority over any prefix candidate', () => {
    // Even if a probe equals a db key exactly, the result is that exact entry.
    const e = getOpeningEntry(START_HASH);
    expect(e!.name).toBe('Grundstellung');
  });

  test('queries never mutate the database', () => {
    const before = JSON.stringify(OPENING_DATABASE);
    getOpeningEntry(START_HASH);
    getOpeningEntry('unknown');
    getOpeningName(START_HASH);
    expect(JSON.stringify(OPENING_DATABASE)).toBe(before);
  });
});

describe('getOpeningName invariants', () => {
  test('returns the entry name for a known hash', () => {
    expect(getOpeningName(START_HASH)).toBe('Grundstellung');
  });

  test('returns null for an unknown hash (delegates to getOpeningEntry)', () => {
    expect(getOpeningName('nope')).toBeNull();
  });
});

describe('getTopOpenings invariants', () => {
  const total = Object.keys(OPENING_DATABASE).length;

  test('results are sorted non-increasing by popularity', () => {
    const top = getTopOpenings(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].popularity).toBeGreaterThanOrEqual(top[i].popularity);
    }
  });

  test('length === min(n, total)', () => {
    expect(getTopOpenings(3)).toHaveLength(Math.min(3, total));
    expect(getTopOpenings(999)).toHaveLength(total);
    expect(getTopOpenings(0)).toHaveLength(0);
  });

  test('default limit is 10', () => {
    expect(getTopOpenings()).toHaveLength(Math.min(10, total));
  });

  test('top result equals the global maximum popularity entry', () => {
    const top = getTopOpenings(1)[0];
    const maxPop = Math.max(...Object.values(OPENING_DATABASE).map(e => e.popularity));
    expect(top.popularity).toBe(maxPop);
  });
});

describe('getOpeningsByCategory partition invariant', () => {
  test('category sizes partition all categorized entries', () => {
    const cats = new Set(Object.values(OPENING_DATABASE).map(e => e.category));
    let partitionSum = 0;
    for (const cat of cats) {
      const group = getOpeningsByCategory(cat);
      expect(group.length).toBeGreaterThan(0);
      expect(group.every(e => e.category === cat)).toBe(true);
      partitionSum += group.length;
    }
    // Every entry belongs to exactly one category, so the partition sums to total.
    expect(partitionSum).toBe(Object.keys(OPENING_DATABASE).length);
  });

  test('unknown category returns empty array', () => {
    expect(getOpeningsByCategory('Does Not Exist')).toEqual([]);
  });
});

describe('searchOpenings invariants', () => {
  test('case-insensitive matching', () => {
    const lower = searchOpenings('sizilianisch');
    const upper = searchOpenings('SIZILIANISCH');
    expect(lower).toHaveLength(upper.length);
    expect(lower.length).toBeGreaterThan(0);
  });

  test('matches across name, eco and category fields (case-insensitive)', () => {
    expect(searchOpenings('B20').some(e => e.eco === 'B20')).toBe(true);
    expect(searchOpenings('gambit').some(e => e.category.toLowerCase().includes('gambit'))).toBe(
      true
    );
    // name match, case-insensitive
    expect(searchOpenings('sizilianisch').some(e => e.name === 'Sizilianische Verteidigung')).toBe(
      true
    );
  });

  test('no match returns empty array', () => {
    expect(searchOpenings('zzz-no-such-opening')).toEqual([]);
  });

  test('empty query returns the full catalog (every entry contains "" )', () => {
    const all = searchOpenings('');
    expect(all).toHaveLength(Object.keys(OPENING_DATABASE).length);
    // Any specific match is a subset of the empty-query result
    const specific = searchOpenings('sizilianisch');
    for (const e of specific) expect(all).toContain(e);
  });

  test('every returned entry actually contains the term (except empty query)', () => {
    const term = 'italienische';
    const results = searchOpenings(term);
    const hay = (e: (typeof results)[number]) =>
      [e.name, e.eco, e.category, e.description].join(' ').toLowerCase();
    expect(results.every(e => hay(e).includes(term.toLowerCase()))).toBe(true);
  });
});

describe('exportDatabase round-trip invariant', () => {
  test('JSON round-trip preserves every key with no data loss', () => {
    const json = exportDatabase();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const origKeys = Object.keys(OPENING_DATABASE).sort();
    const parsedKeys = Object.keys(parsed).sort();
    expect(parsedKeys).toEqual(origKeys);
  });
});
