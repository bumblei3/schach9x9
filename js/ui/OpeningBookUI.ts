/**
 * Opening Book UI Component for Schach 9x9
 * Displays detailed opening database information, statistics, and book moves.
 *
 * XSS-safe: all dynamic strings go through textContent / createElement.
 * Never assign untrusted (or DB-derived) strings via innerHTML.
 */
import {
  getOpeningEntry,
  getOpeningsByCategory,
  getTopOpenings,
  searchOpenings,
  OPENING_DATABASE,
} from '../ai/OpeningDatabase.js';
import { getBoardHash } from '../move/MoveValidator.js';
import type { Game } from '../gameEngine.js';
import { PHASES } from '../config.js';
import { openingBook } from '../ai/OpeningBook.js';

interface OpeningBookUIElements {
  container: HTMLElement | null;
  currentOpening: HTMLElement | null;
  currentEco: HTMLElement | null;
  currentCategory: HTMLElement | null;
  currentStats: HTMLElement | null;
  currentMoves: HTMLElement | null;
  currentDescription: HTMLElement | null;
  bookMovesList: HTMLElement | null;
  topOpeningsList: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  searchResults: HTMLElement | null;
  categoryFilter: HTMLSelectElement | null;
}

type OpeningEntry = NonNullable<ReturnType<typeof getOpeningEntry>>;

/** Create an element with optional class, text, and attributes (values as text, never HTML). */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: Node[];
  } = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      node.setAttribute(k, v);
    }
  }
  if (opts.children) {
    for (const child of opts.children) node.appendChild(child);
  }
  return node;
}

function clearChildren(node: HTMLElement): void {
  node.replaceChildren();
}

export class OpeningBookUI {
  private game: Game | null = null;
  private elements: OpeningBookUIElements = {
    container: null,
    currentOpening: null,
    currentEco: null,
    currentCategory: null,
    currentStats: null,
    currentMoves: null,
    currentDescription: null,
    bookMovesList: null,
    topOpeningsList: null,
    searchInput: null,
    searchResults: null,
    categoryFilter: null,
  };
  private isVisible = false;

  public get visible(): boolean {
    return this.isVisible;
  }

  constructor() {
    this.cacheElements();
    this.bindEvents();
  }

  private cacheElements(): void {
    this.elements = {
      container: document.getElementById('opening-book-panel'),
      currentOpening: document.getElementById('current-opening-name'),
      currentEco: document.getElementById('current-opening-eco'),
      currentCategory: document.getElementById('current-opening-category'),
      currentStats: document.getElementById('current-opening-stats'),
      currentMoves: document.getElementById('current-opening-moves'),
      currentDescription: document.getElementById('current-opening-description'),
      bookMovesList: document.getElementById('book-moves-list'),
      topOpeningsList: document.getElementById('top-openings-list'),
      searchInput: document.getElementById('opening-search') as HTMLInputElement | null,
      searchResults: document.getElementById('opening-search-results'),
      categoryFilter: document.getElementById(
        'opening-category-filter'
      ) as HTMLSelectElement | null,
    };
  }

  private bindEvents(): void {
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', e => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.handleSearch(query);
      });
    }

    if (this.elements.categoryFilter) {
      this.elements.categoryFilter.addEventListener('change', e => {
        const category = (e.target as HTMLSelectElement).value;
        this.handleCategoryFilter(category);
      });
    }
  }

  setGame(game: Game): void {
    this.game = game;
  }

  updateCurrentOpening(): void {
    if (!this.game || !this.elements.container) return;

    if (this.game.phase !== PHASES.PLAY) {
      this.hideCurrentOpening();
      return;
    }

    const hash = getBoardHash(this.game);
    const entry = getOpeningEntry(hash);

    if (entry) {
      this.showCurrentOpening(entry);
    } else {
      this.hideCurrentOpening();
    }
  }

  private showCurrentOpening(entry: OpeningEntry): void {
    if (!this.elements.currentOpening) return;

    this.elements.currentOpening.textContent = entry.name;
    this.elements.currentOpening.title = entry.description;

    if (this.elements.currentEco) {
      this.elements.currentEco.textContent = `ECO: ${entry.eco}`;
    }
    if (this.elements.currentCategory) {
      this.elements.currentCategory.textContent = entry.category;
    }
    if (this.elements.currentStats) {
      clearChildren(this.elements.currentStats);
      const stats: Array<{ className: string; text: string }> = [
        { className: 'stat-pill', text: `Beliebtheit: ${entry.popularity}%` },
        { className: 'stat-pill white', text: `Weiß: ${entry.whiteWinRate}%` },
        { className: 'stat-pill black', text: `Schwarz: ${entry.blackWinRate}%` },
        { className: 'stat-pill draw', text: `Remis: ${entry.drawRate}%` },
        { className: 'stat-pill', text: `Ø Elo: ${entry.avgElo}` },
      ];
      for (const s of stats) {
        this.elements.currentStats.appendChild(el('span', { className: s.className, text: s.text }));
      }
    }
    if (this.elements.currentMoves) {
      clearChildren(this.elements.currentMoves);
      entry.moves.forEach((m, i) => {
        if (i > 0) {
          this.elements.currentMoves!.appendChild(document.createTextNode(' → '));
        }
        this.elements.currentMoves!.appendChild(
          el('span', { className: 'opening-move', text: m })
        );
      });
    }
    if (this.elements.currentDescription) {
      this.elements.currentDescription.textContent = entry.description;
    }

    // Show the container
    this.elements.container?.classList.remove('hidden');
    this.isVisible = true;

    // Update book moves from OpeningBook
    this.updateBookMoves();
  }

  private hideCurrentOpening(): void {
    if (this.elements.container) {
      this.elements.container.classList.add('hidden');
    }
    this.isVisible = false;
  }

  private updateBookMoves(): void {
    if (!this.game || !this.elements.bookMovesList) return;

    const turn = this.game.turn;
    const bookMove = openingBook.getMove(this.game.board, turn);
    clearChildren(this.elements.bookMovesList);

    if (bookMove) {
      const fromSquare = this.squareToAlgebraic(bookMove.from);
      const toSquare = this.squareToAlgebraic(bookMove.to);
      this.elements.bookMovesList.appendChild(
        el('div', {
          className: 'book-move-item book-move',
          children: [
            el('span', { className: 'move-notation', text: `${fromSquare}${toSquare}` }),
            el('span', { className: 'move-source', text: 'Buchzug' }),
          ],
        })
      );
    } else {
      this.elements.bookMovesList.appendChild(
        el('div', { className: 'no-book-moves', text: 'Kein Buchzug für diese Stellung' })
      );
    }
  }

  private handleSearch(query: string): void {
    if (!this.elements.searchResults) return;

    if (!query) {
      clearChildren(this.elements.searchResults);
      this.renderTopOpenings();
      return;
    }

    const results = searchOpenings(query);
    this.renderSearchResults(results);
  }

  private handleCategoryFilter(category: string): void {
    if (!this.elements.searchResults) return;

    if (!category || category === 'all') {
      this.renderTopOpenings();
      return;
    }

    const results = getOpeningsByCategory(category);
    this.renderSearchResults(results);
  }

  private renderSearchResults(entries: ReturnType<typeof searchOpenings>): void {
    if (!this.elements.searchResults) return;
    clearChildren(this.elements.searchResults);

    if (entries.length === 0) {
      this.elements.searchResults.appendChild(
        el('div', { className: 'no-results', text: 'Keine Eröffnungen gefunden' })
      );
      return;
    }

    for (const entry of entries.slice(0, 20)) {
      this.elements.searchResults.appendChild(this.buildOpeningEntry(entry, false));
    }
  }

  private renderTopOpenings(): void {
    if (!this.elements.topOpeningsList) return;
    clearChildren(this.elements.topOpeningsList);

    const topOpenings = getTopOpenings(15);
    for (const entry of topOpenings) {
      this.elements.topOpeningsList.appendChild(this.buildOpeningEntry(entry, true));
    }
  }

  /** Build a safe DOM node for one opening entry (no HTML string interpolation). */
  private buildOpeningEntry(entry: OpeningEntry, compact = false): HTMLElement {
    const winRateColor =
      entry.whiteWinRate > entry.blackWinRate
        ? 'white'
        : entry.blackWinRate > entry.whiteWinRate
          ? 'black'
          : 'draw';

    const root = el('div', {
      className: `opening-entry${compact ? ' compact' : ''}`,
      attrs: { 'data-eco': entry.eco, 'data-name': entry.name },
    });

    root.appendChild(
      el('div', {
        className: 'opening-entry-header',
        children: [
          el('span', { className: 'opening-name', text: entry.name }),
          el('span', { className: 'opening-eco', text: entry.eco }),
        ],
      })
    );

    root.appendChild(
      el('div', {
        className: 'opening-meta',
        children: [
          el('span', { className: 'opening-category', text: entry.category }),
          el('span', {
            className: 'opening-popularity',
            text: `Pop: ${entry.popularity}%`,
          }),
        ],
      })
    );

    root.appendChild(
      el('div', {
        className: 'opening-stats',
        children: [
          el('span', {
            className: `stat ${winRateColor}`,
            text: `W:${entry.whiteWinRate}% B:${entry.blackWinRate}% R:${entry.drawRate}%`,
          }),
          el('span', { className: 'stat elo', text: `Ø ${entry.avgElo}` }),
        ],
      })
    );

    if (!compact) {
      root.appendChild(
        el('div', {
          className: 'opening-moves',
          text: entry.moves.join(' → '),
        })
      );
      root.appendChild(
        el('div', {
          className: 'opening-description',
          text: entry.description,
        })
      );
    }

    return root;
  }

  private squareToAlgebraic(sq: { r: number; c: number }): string {
    const file = String.fromCharCode(97 + sq.c);
    const rank = 9 - sq.r;
    return `${file}${rank}`;
  }

  show(): void {
    this.cacheElements(); // Re-cache in case DOM changed
    this.renderTopOpenings();
    this.populateCategoryFilter();
    this.elements.container?.classList.remove('hidden');
    this.isVisible = true;
  }

  hide(): void {
    this.elements.container?.classList.add('hidden');
    this.isVisible = false;
  }

  toggle(): void {
    if (this.isVisible) this.hide();
    else this.show();
  }

  private populateCategoryFilter(): void {
    if (!this.elements.categoryFilter) return;

    const categories = new Set<string>();
    Object.values(OPENING_DATABASE).forEach(entry => {
      categories.add(entry.category);
    });
    const sortedCategories = Array.from(categories).sort();

    clearChildren(this.elements.categoryFilter);
    this.elements.categoryFilter.appendChild(
      el('option', { text: 'Alle Kategorien', attrs: { value: 'all' } })
    );
    for (const cat of sortedCategories) {
      this.elements.categoryFilter.appendChild(
        el('option', { text: cat, attrs: { value: cat } })
      );
    }
  }
}

// Singleton instance
export const openingBookUI = new OpeningBookUI();
