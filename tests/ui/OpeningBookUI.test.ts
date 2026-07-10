import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the OpeningBook so updateBookMoves() doesn't need a real book lookup.
vi.mock('../../js/ai/OpeningBook.js', () => ({
  openingBook: {
    getMove: vi.fn(() => null),
  },
}));

// Mock the database lookup so the UI test is independent of the engine's
// exact board-hash format (which need not match the static DB keys).
// vi.hoisted lifts mockEntry above the hoisted vi.mock factories (avoids TDZ).
const { mockEntry } = vi.hoisted(() => ({
  mockEntry: {
    name: 'Test Eröffnung',
    eco: 'T00',
    category: 'Test Category',
    popularity: 50,
    whiteWinRate: 40,
    blackWinRate: 30,
    drawRate: 30,
    avgElo: 2000,
    moves: ['1. e4', '1. d4'],
    description: 'Eine Test-Eröffnung für die UI.',
  },
}));
vi.mock('../../js/ai/OpeningDatabase.js', () => ({
  getOpeningEntry: vi.fn((hash: string) => (hash === 'KNOWN_HASH' ? mockEntry : null)),
  getOpeningsByCategory: vi.fn(() => [mockEntry]),
  getTopOpenings: vi.fn(() => Array(15).fill(mockEntry)),
  searchOpenings: vi.fn(() => [mockEntry]),
  OPENING_DATABASE: { KNOWN_HASH: mockEntry },
}));
vi.mock('../../js/move/MoveValidator.js', () => ({
  getBoardHash: vi.fn(() => 'KNOWN_HASH'),
}));

const { OpeningBookUI } = await import('../../js/ui/OpeningBookUI.js');

const PANEL_HTML = `
  <div id="opening-book-panel" class="hidden">
    <div id="current-opening-name"></div>
    <div id="current-opening-eco"></div>
    <div id="current-opening-category"></div>
    <div id="current-opening-stats"></div>
    <div id="current-opening-moves"></div>
    <div id="current-opening-description"></div>
    <div id="book-moves-list"></div>
    <div id="top-openings-list"></div>
    <div id="opening-search-results"></div>
    <input id="opening-search" />
    <select id="opening-category-filter"></select>
  </div>
`;

function makeGame(overrides: Partial<any> = {}): any {
  return {
    phase: 'PLAY',
    turn: 'white',
    board: Array(9).fill(null).map(() => Array(9).fill(null)),
    ...overrides,
  };
}

describe('OpeningBookUI', () => {
  let ui: InstanceType<typeof OpeningBookUI>;

  beforeEach(() => {
    document.body.innerHTML = PANEL_HTML;
    ui = new OpeningBookUI();
  });

  test('constructor caches DOM elements without throwing', () => {
    expect(ui).toBeDefined();
    expect(ui.visible).toBe(false);
  });

  test('show() reveals the panel and renders top openings + category filter', () => {
    ui.show();
    expect(ui.visible).toBe(true);
    const panel = document.getElementById('opening-book-panel')!;
    expect(panel.classList.contains('hidden')).toBe(false);
    // Top openings list should be populated with entries.
    const top = document.getElementById('top-openings-list')!;
    expect(top.innerHTML).toContain('opening-entry');
    // Category filter should have an "all" option plus real categories.
    const filter = document.getElementById('opening-category-filter') as HTMLSelectElement;
    expect(filter.innerHTML).toContain('Alle Kategorien');
    expect(filter.options.length).toBeGreaterThan(1);
  });

  test('hide() hides the panel and updates visible flag', () => {
    ui.show();
    ui.hide();
    expect(ui.visible).toBe(false);
    const panel = document.getElementById('opening-book-panel')!;
    expect(panel.classList.contains('hidden')).toBe(true);
  });

  test('toggle() flips visibility', () => {
    expect(ui.visible).toBe(false);
    ui.toggle();
    expect(ui.visible).toBe(true);
    ui.toggle();
    expect(ui.visible).toBe(false);
  });

  test('updateCurrentOpening hides when phase is not PLAY', () => {
    const game = makeGame({ phase: 'SETUP' });
    ui.setGame(game as any);
    ui.updateCurrentOpening();
    expect(ui.visible).toBe(false);
    const panel = document.getElementById('opening-book-panel')!;
    expect(panel.classList.contains('hidden')).toBe(true);
  });

  test('updateCurrentOpening renders the matched opening', () => {
    const game = makeGame({ turn: 'white' });
    ui.setGame(game as any);
    ui.updateCurrentOpening();
    expect(ui.visible).toBe(true);
    expect(document.getElementById('current-opening-name')!.textContent).toBe('Test Eröffnung');
    expect(document.getElementById('current-opening-eco')!.textContent).toContain('T00');
    expect(document.getElementById('current-opening-category')!.textContent).toBe('Test Category');
    // Stats and moves should be rendered.
    expect(document.getElementById('current-opening-stats')!.innerHTML).toContain('Beliebtheit');
    expect(document.getElementById('current-opening-moves')!.innerHTML).toContain('opening-move');
  });

  test('updateCurrentOpening hides when no opening matches', async () => {
    // Force a non-matching hash by overriding the mocked getBoardHash.
    const { getBoardHash } = await import('../../js/move/MoveValidator.js');
    (getBoardHash as any).mockReturnValue('UNKNOWN_HASH');
    const game = makeGame({ turn: 'white' });
    ui.setGame(game as any);
    ui.updateCurrentOpening();
    expect(ui.visible).toBe(false);
  });

  test('handleSearch filters openings by query', () => {
    ui.show();
    // Empty query re-renders top openings into the top-openings list.
    (ui as any).handleSearch('');
    expect(document.getElementById('top-openings-list')!.innerHTML).toContain('opening-entry');
    // A real query filters into the search results area.
    (ui as any).handleSearch('test');
    expect(document.getElementById('opening-search-results')!.innerHTML).toContain('opening-entry');
  });

  test('handleCategoryFilter shows only that category', () => {
    ui.show();
    (ui as any).handleCategoryFilter('Test Category');
    const results = document.getElementById('opening-search-results')!;
    expect(results.innerHTML).toContain('opening-entry');
    expect(results.innerHTML).toContain('Test Category');
  });

  test('squareToAlgebraic renders files a-i and ranks 1-9', () => {
    const fn = (ui as any).squareToAlgebraic.bind(ui);
    expect(fn({ r: 8, c: 0 })).toBe('a1');
    expect(fn({ r: 0, c: 8 })).toBe('i9');
  });
});
