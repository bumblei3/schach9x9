/**
 * Tests for the opening database lookup helpers in js/ai/OpeningDatabase.ts.
 * These functions were previously uncovered (47% lines) because only the
 * static data was imported, never the query API.
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

describe('OpeningDatabase query API', () => {
  const START_HASH =
    'brbnbbbqbkbbbbnbbrbpbpbpbpbpbpbpbpbp................................................................................wpwpwpwpwpwpwpwpwrwnwbwqwkwbwnwrww';

  test('getOpeningEntry returns the starting position entry by exact hash', () => {
    const entry = getOpeningEntry(START_HASH);
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('Grundstellung');
    expect(entry!.eco).toBe('A00');
  });

  test('getOpeningEntry returns null for an unknown hash', () => {
    expect(getOpeningEntry('this-hash-does-not-exist-anywhere')).toBeNull();
  });

  test('getOpeningEntry supports partial (prefix) matches for long db hashes', () => {
    // A real board hash that begins with the Grundstellung prefix should
    // still resolve via the first-50-chars prefix rule.
    const partial = START_HASH.slice(0, 60) + 'x'.repeat(0);
    const entry = getOpeningEntry(partial);
    // Either an exact match or a prefix match on a >50-char db key.
    expect(entry).not.toBeNull();
  });

  test('getOpeningName delegates to getOpeningEntry', () => {
    expect(getOpeningName(START_HASH)).toBe('Grundstellung');
    expect(getOpeningName('unknown-hash')).toBeNull();
  });

  test('searchOpenings matches by name (case-insensitive)', () => {
    const results = searchOpenings('sizilianisch');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(e => e.name === 'Sizilianische Verteidigung')).toBe(true);
  });

  test('searchOpenings matches by ECO code', () => {
    const results = searchOpenings('B20');
    expect(results.some(e => e.eco === 'B20')).toBe(true);
  });

  test('searchOpenings matches by category', () => {
    const results = searchOpenings('gambit');
    expect(results.length).toBeGreaterThan(0);
    // Search matches name/eco/category, so at least one hit must be a real gambit.
    expect(results.some(e => e.category.toLowerCase().includes('gambit'))).toBe(true);
  });

  test('searchOpenings returns empty array for no match', () => {
    expect(searchOpenings('zzz-non-existent-opening')).toEqual([]);
  });

  test('getOpeningsByCategory returns every entry in that category', () => {
    const openGames = getOpeningsByCategory('Open Game');
    expect(openGames.length).toBeGreaterThan(1);
    expect(openGames.every(e => e.category === 'Open Game')).toBe(true);
  });

  test('getOpeningsByCategory returns empty for unknown category', () => {
    expect(getOpeningsByCategory('Nonexistent Category')).toEqual([]);
  });

  test('getTopOpenings returns n entries sorted by popularity desc', () => {
    const top = getTopOpenings(3);
    expect(top).toHaveLength(3);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].popularity).toBeGreaterThanOrEqual(top[i].popularity);
    }
  });

  test('getTopOpenings defaults to 10 entries', () => {
    expect(getTopOpenings()).toHaveLength(10);
  });

  test('exportDatabase produces valid JSON containing the starting entry', () => {
    const json = exportDatabase();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed[START_HASH]).toBeDefined();
  });

  test('database contains the 9x9-specific openings', () => {
    const names = Object.values(OPENING_DATABASE).map(e => e.name);
    expect(names).toContain('Symmetrische Aufstellung (9x9)');
    expect(names).toContain('Offensive Formation (9x9)');
  });
});
