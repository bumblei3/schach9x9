import { describe, test, expect } from 'vitest';
import { getOpeningName } from '../../js/ai/OpeningDatabase.js';

describe('OpeningDatabase', () => {
  test('getOpeningName should return correct name for known hash', () => {
    const startHash =
      'brbnbbbqbkbbbbnbbrbpbpbpbpbpbpbpbpbp................................................................................wpwpwpwpwpwpwpwpwrwnwbwqwkwbwnwrww';
    expect(getOpeningName(startHash)).toBe('Grundstellung');
  });

  test('getOpeningName should return null for unknown hash', () => {
    expect(getOpeningName('unknown')).toBeNull();
  });

  test('getOpeningName should match Sicilian Defense hash', () => {
    const sicilianHash =
      'brbnbbbqbkbbbbnbbrbpbpbpbpbp..bpbpbp....................wp..................wpwpwp..wpwpwpwpwrwnwbwqwkwbwnwrwb';
    expect(getOpeningName(sicilianHash)).toBe('Sizilianische Verteidigung');
  });

  test('getOpeningName should match Italian Game hash', () => {
    const italianHash =
      'br.bqbkbbbbnbbrbpbpbp..bpbpbpbpbp....bn..................wb......wp..........wpwpwp..wpwpwpwpwr.n.wqwkwbwnwrww';
    expect(getOpeningName(italianHash)).toBe('Italienische Partie');
  });
});
