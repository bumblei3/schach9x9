import { puzzleManager } from '../puzzleManager.js';
import type { GameControllerInterface } from '../types/core.js';

export class PuzzleMenu {
  gameController: GameControllerInterface;
  overlay: HTMLElement | null;
  /** Active filters: null = all difficulties / all categories. */
  filterDifficulty: string | null = null;
  filterFairy: boolean | null = null;

  constructor(gameController: GameControllerInterface) {
    this.gameController = gameController;
    this.overlay = document.getElementById('puzzle-menu-overlay');

    const closeBtn = document.getElementById('puzzle-menu-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    this.renderFilterBar();
  }

  show(): void {
    this.renderPuzzleList();
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
    }
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }
  }

  /**
   * Filter bar: difficulty chips + category toggle (Alle / Klassisch / Feen).
   * Rebuilt once in the constructor; chips re-render the puzzle list on click.
   */
  renderFilterBar(): void {
    const bar = document.getElementById('puzzle-menu-filters');
    if (!bar) return;
    const barAny = bar as unknown as Record<string, unknown>;
    if (typeof barAny.appendChild !== 'function') return;

    if (typeof barAny.replaceChildren === 'function') {
      bar.replaceChildren();
    } else {
      try {
        bar.innerHTML = '';
      } catch {
        /* minimal stub — skip */
      }
    }

    // Defensive: some test environments stub document.createElement with
    // minimal objects that lack DOM methods — skip rendering rather than
    // break construction of the whole menu.
    let chips: HTMLButtonElement[] = [];
    try {
      chips = this.buildFilterChips(bar);
      bar.appendChild(this.buildCategorySelect());
    } catch {
      return;
    }
    void chips;
  }

  private buildFilterChips(bar: HTMLElement): HTMLButtonElement[] {
    const created: HTMLButtonElement[] = [];
    // Difficulty chips
    const difficulties = ['Alle', ...puzzleManager.getDifficulties()];
    difficulties.forEach((d) => {
      const active = this.filterDifficulty === null ? d === 'Alle' : d === this.filterDifficulty;
      const chip = document.createElement('button');
      chip.className = `puzzle-filter-chip ${active ? 'active' : ''}`;
      chip.textContent = d;
      if (typeof chip.setAttribute === 'function') {
        chip.setAttribute('aria-pressed', String(active));
      }
      chip.onclick = () => {
        this.filterDifficulty = d === 'Alle' ? null : d;
        this.renderFilterBar();
        this.renderPuzzleList();
      };
      bar.appendChild(chip);
      created.push(chip);
    });
    return created;
  }

  private buildCategorySelect(): HTMLSelectElement {
    // Category select: Alle / Klassisch / Feenfiguren
    const cat = document.createElement('select');
    cat.className = 'puzzle-filter-cat';
    if (typeof cat.setAttribute === 'function') {
      cat.setAttribute('aria-label', 'Kategorie filtern');
    }
    [
      ['', 'Alle Kategorien'],
      ['classic', 'Klassisch'],
      ['fairy', 'Feenfiguren'],
    ].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (
        (value === '' && this.filterFairy === null) ||
        (value === 'classic' && this.filterFairy === false) ||
        (value === 'fairy' && this.filterFairy === true)
      ) {
        opt.selected = true;
      }
      cat.appendChild(opt);
    });
    cat.onchange = () => {
      this.filterFairy =
        cat.value === 'classic' ? false : cat.value === 'fairy' ? true : null;
      this.renderPuzzleList();
    };
    return cat;
  }

  renderPuzzleList(): void {
    const container = document.getElementById('puzzle-menu-list');
    if (!container) return;

    container.innerHTML = '';
    const filtered = puzzleManager.getFilteredPuzzles(
      this.filterDifficulty ?? undefined,
      this.filterFairy ?? undefined
    );

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'puzzle-empty';
      empty.textContent = 'Keine Puzzles für diesen Filter.';
      container.appendChild(empty);
      return;
    }

    filtered.forEach(({ index, puzzle }) => {
      const isSolved = puzzleManager.isSolved(puzzle.id);

      const card = document.createElement('div');
      card.className = `puzzle-card ${isSolved ? 'solved' : ''}`;

      const difficultyClass = puzzle.difficulty.toLowerCase();

      card.innerHTML = `
        <div class="puzzle-card-header">
          <span class="puzzle-title">${puzzle.title}</span>
          ${isSolved ? '<span class="puzzle-check">✅</span>' : ''}
        </div>
        <div class="puzzle-card-body">
          <span class="puzzle-difficulty ${difficultyClass}">${puzzle.difficulty}</span>
          <p class="puzzle-desc">${puzzle.description}</p>
        </div>
      `;

      card.onclick = () => {
        this.hide();
        if (this.gameController.loadPuzzle) {
          this.gameController.loadPuzzle(index);
        } else if (this.gameController.startPuzzleMode) {
          this.gameController.startPuzzleMode(index);
        }
      };

      container.appendChild(card);
    });
  }
}
