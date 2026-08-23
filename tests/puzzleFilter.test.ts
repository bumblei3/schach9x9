/**
 * Tests for the puzzle filter feature (getFilteredPuzzles / getDifficulties)
 * and the PuzzleMenu filter UI wiring (js/ui/PuzzleMenu.ts).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
} as unknown as Storage);

const { puzzleManager } = await import('../js/puzzleManager.js');

describe('puzzleManager filters', () => {
  beforeEach(() => {
    store.clear();
    // Reset filter state via fresh instance semantics — filters live on
    // PuzzleMenu, not here; nothing to reset for the manager itself.
  });

  test('getDifficulties returns distinct levels', () => {
    const diffs = puzzleManager.getDifficulties();
    expect(diffs.length).toBeGreaterThan(0);
    expect(new Set(diffs).size).toBe(diffs.length);
    expect(diffs).toContain('Einfach');
  });

  test('getFilteredPuzzles with no filter returns all puzzles with original indices', () => {
    const all = puzzleManager.getFilteredPuzzles(undefined, undefined);
    expect(all.length).toBe(puzzleManager.getPuzzles().length);
    all.forEach((entry, i) => expect(entry.index).toBe(i));
  });

  test('difficulty filter keeps only matching difficulty', () => {
    const easy = puzzleManager.getFilteredPuzzles('Einfach', undefined);
    expect(easy.length).toBeGreaterThan(0);
    easy.forEach(({ puzzle }) => expect(puzzle.difficulty).toBe('Einfach'));
  });

  test('impossible combination yields empty result', () => {
    const none = puzzleManager.getFilteredPuzzles('NichtExistierend', undefined);
    expect(none).toEqual([]);
  });

  test('fairy=true returns only fairy ids, fairy=false only classic', () => {
    const fairy = puzzleManager.getFilteredPuzzles(undefined, true);
    expect(fairy.length).toBeGreaterThan(0);
    fairy.forEach(({ puzzle }) => expect(puzzle.id.startsWith('fairy-')).toBe(true));

    const classic = puzzleManager.getFilteredPuzzles(undefined, false);
    expect(classic.length).toBeGreaterThan(0);
    classic.forEach(({ puzzle }) => expect(puzzle.id.startsWith('fairy-')).toBe(false));

    expect(fairy.length + classic.length).toBe(puzzleManager.getPuzzles().length);
  });

  test('combined difficulty+fairy filter intersects', () => {
    const both = puzzleManager.getFilteredPuzzles('Schwer', true);
    both.forEach(({ puzzle }) => {
      expect(puzzle.difficulty).toBe('Schwer');
      expect(puzzle.id.startsWith('fairy-')).toBe(true);
    });
  });
});

describe('PuzzleMenu filter UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="puzzle-menu-overlay" class="hidden">
        <div id="puzzle-menu-filters"></div>
        <div id="puzzle-menu-list"></div>
        <button id="puzzle-menu-close-btn">×</button>
      </div>
    `;
    store.clear();
  });

  async function makeMenu() {
    const { PuzzleMenu } = await import('../js/ui/PuzzleMenu.js');
    return new PuzzleMenu({} as any);
  }

  test('filter bar renders a chip per difficulty plus "Alle"', async () => {
    const menu = await makeMenu();
    menu.renderFilterBar();
    const chips = [...document.querySelectorAll('.puzzle-filter-chip')] as HTMLElement[];
    expect(chips[0].textContent).toBe('Alle');
    expect(chips.length).toBe(1 + puzzleManager.getDifficulties().length);
    expect(chips[0].className).toContain('active');
  });

  test('clicking a difficulty chip filters the list', async () => {
    const menu = await makeMenu();
    menu.show();

    const chips = [...document.querySelectorAll('.puzzle-filter-chip')] as HTMLButtonElement[];
    const schwerChip = chips.find((c) => c.textContent === 'Schwer');
    expect(schwerChip).toBeTruthy();
    schwerChip!.click();

    const cards = document.querySelectorAll('.puzzle-card');
    const expected = puzzleManager.getFilteredPuzzles('Schwer', undefined);
    expect(cards.length).toBe(expected.length);
  });

  test('"Alle" chip resets the filter', async () => {
    const menu = await makeMenu();
    menu.filterDifficulty = 'Einfach';
    menu.renderFilterBar();
    menu.renderPuzzleList();

    const chips = [...document.querySelectorAll('.puzzle-filter-chip')] as HTMLButtonElement[];
    chips.find((c) => c.textContent === 'Alle')!.click();

    expect(menu.filterDifficulty).toBeNull();
    expect(document.querySelectorAll('.puzzle-card').length).toBe(
      puzzleManager.getPuzzles().length
    );
  });

  test('category select filters fairy vs classic', async () => {
    const menu = await makeMenu();
    menu.filterFairy = true;
    menu.renderPuzzleList();

    const expected = puzzleManager.getFilteredPuzzles(undefined, true);
    expect(document.querySelectorAll('.puzzle-card').length).toBe(expected.length);
  });

  test('empty filter result shows placeholder message', async () => {
    const menu = await makeMenu();
    menu.filterDifficulty = 'GibtEsNicht';
    menu.renderPuzzleList();
    expect(document.querySelector('.puzzle-empty')?.textContent).toContain(
      'Keine Puzzles'
    );
  });

  test('original index is preserved when loading from filtered list', async () => {
    const menu = await makeMenu();
    menu.show();
    const loaded: number[] = [];
    (menu.gameController as any).loadPuzzle = (i: number) => loaded.push(i);

    const cards = document.querySelectorAll('.puzzle-card') as NodeListOf<HTMLElement>;
    cards[cards.length - 1].click();

    const all = puzzleManager.getPuzzles();
    expect(loaded).toEqual([all.length - 1]);
  });
});
