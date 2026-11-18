import { afterEach, describe, expect, it } from 'vitest';
import { hiringBudget } from '../../js/campaign/hiringBudget.js';
import { setLocale } from '../../js/i18n.js';

describe('hiringBudget', () => {
  it('keeps the chapter base when nothing is owned', () => {
    expect(hiringBudget(30, false, false)).toEqual({ total: 30, label: 'Budget 30' });
  });

  it('adds 5 Taktiker points on Kapitel 4', () => {
    expect(hiringBudget(30, false, true)).toEqual({
      total: 35,
      label: 'Budget 35 (30 + 5 Taktiker)',
    });
  });

  it('keeps the Elite-Garde line', () => {
    expect(hiringBudget(30, true, false)).toEqual({
      total: 40,
      label: 'Budget 40 (30 + 10 Elite-Garde)',
    });
  });

  it('stacks Elite-Garde and Taktiker', () => {
    expect(hiringBudget(30, true, true)).toEqual({
      total: 45,
      label: 'Budget 45 (30 + 10 Elite-Garde + 5 Taktiker)',
    });
  });
});

describe('hiringBudget i18n', () => {
  afterEach(() => setLocale('de'));

  it('englische Ausgabe nutzt andere Label', () => {
    setLocale('en');
    expect(hiringBudget(30, false, false).label).toBe('Purse 30');
    expect(hiringBudget(30, false, true).label).toBe('Purse 35 (30 + 5 Tactician)');
    expect(hiringBudget(30, true, false).label).toBe('Purse 40 (30 + 10 Elite Guard)');
    expect(hiringBudget(30, true, true).label).toBe(
      'Purse 45 (30 + 10 Elite Guard + 5 Tactician)'
    );
  });
});
