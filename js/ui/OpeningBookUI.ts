/**
 * Opening Book UI Component for Schach 9x9
 * Displays detailed opening database information, statistics, and book moves
 */
import { getOpeningEntry, getOpeningsByCategory, getTopOpenings, searchOpenings, OPENING_DATABASE } from '../ai/OpeningDatabase.js';
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
      categoryFilter: document.getElementById('opening-category-filter') as HTMLSelectElement | null,
    };
  }

  private bindEvents(): void {
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.handleSearch(query);
      });
    }

    if (this.elements.categoryFilter) {
      this.elements.categoryFilter.addEventListener('change', (e) => {
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

  private showCurrentOpening(entry: NonNullable<ReturnType<typeof getOpeningEntry>>): void {
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
      this.elements.currentStats.innerHTML = `
        <span class="stat-pill">Beliebtheit: ${entry.popularity}%</span>
        <span class="stat-pill white">Weiß: ${entry.whiteWinRate}%</span>
        <span class="stat-pill black">Schwarz: ${entry.blackWinRate}%</span>
        <span class="stat-pill draw">Remis: ${entry.drawRate}%</span>
        <span class="stat-pill">Ø Elo: ${entry.avgElo}</span>
      `;
    }
    if (this.elements.currentMoves) {
      this.elements.currentMoves.innerHTML = entry.moves
        .map(m => `<span class="opening-move">${m}</span>`)
        .join(' → ');
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

    if (bookMove) {
      // Show the book move
      const fromSquare = this.squareToAlgebraic(bookMove.from);
      const toSquare = this.squareToAlgebraic(bookMove.to);
      this.elements.bookMovesList.innerHTML = `
        <div class="book-move-item book-move">
          <span class="move-notation">${fromSquare}${toSquare}</span>
          <span class="move-source">Buchzug</span>
        </div>
      `;
    } else {
      this.elements.bookMovesList.innerHTML = '<div class="no-book-moves">Kein Buchzug für diese Stellung</div>';
    }
  }

  private handleSearch(query: string): void {
    if (!this.elements.searchResults) return;

    if (!query) {
      this.elements.searchResults.innerHTML = '';
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

    if (entries.length === 0) {
      this.elements.searchResults.innerHTML = '<div class="no-results">Keine Eröffnungen gefunden</div>';
      return;
    }

    this.elements.searchResults.innerHTML = entries
      .slice(0, 20)
      .map(entry => this.renderOpeningEntry(entry))
      .join('');
  }

  private renderTopOpenings(): void {
    if (!this.elements.topOpeningsList) return;

    const topOpenings = getTopOpenings(15);
    this.elements.topOpeningsList.innerHTML = topOpenings
      .map(entry => this.renderOpeningEntry(entry, true))
      .join('');
  }

  private renderOpeningEntry(entry: NonNullable<ReturnType<typeof getOpeningEntry>>, compact = false): string {
    const winRateColor = entry.whiteWinRate > entry.blackWinRate ? 'white' : 
                         entry.blackWinRate > entry.whiteWinRate ? 'black' : 'draw';
    
    return `
      <div class="opening-entry${compact ? ' compact' : ''}" data-eco="${entry.eco}" data-name="${entry.name}">
        <div class="opening-entry-header">
          <span class="opening-name">${entry.name}</span>
          <span class="opening-eco">${entry.eco}</span>
        </div>
        <div class="opening-meta">
          <span class="opening-category">${entry.category}</span>
          <span class="opening-popularity">Pop: ${entry.popularity}%</span>
        </div>
        <div class="opening-stats">
          <span class="stat ${winRateColor}">W:${entry.whiteWinRate}% B:${entry.blackWinRate}% R:${entry.drawRate}%</span>
          <span class="stat elo">Ø ${entry.avgElo}</span>
        </div>
        ${!compact ? `<div class="opening-moves">${entry.moves.join(' → ')}</div>` : ''}
        ${!compact ? `<div class="opening-description">${entry.description}</div>` : ''}
      </div>
    `;
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
    if (this.isVisible) this.hide(); else this.show();
  }

  private populateCategoryFilter(): void {
    if (!this.elements.categoryFilter) return;

    const categories = new Set<string>();
    
    Object.values(OPENING_DATABASE).forEach(entry => {
      categories.add(entry.category);
    });

    const sortedCategories = Array.from(categories).sort();
    
    this.elements.categoryFilter.innerHTML = `
      <option value="all">Alle Kategorien</option>
      ${sortedCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
    `;
  }
}

// Singleton instance
export const openingBookUI = new OpeningBookUI();
