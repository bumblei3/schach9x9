import { puzzleManager, puzzleTitle, puzzleDescription, puzzleDifficultyText } from '../puzzleManager.js';
import { t } from '../i18n.js';
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
    const all = 'Alle';
    const difficulties = [all, ...puzzleManager.getDifficulties()];
    difficulties.forEach((d) => {
      const active = this.filterDifficulty === null ? d === all : d === this.filterDifficulty;
      const chip = document.createElement('button');
      chip.className = `puzzle-filter-chip ${active ? 'active' : ''}`;
      chip.textContent = d === all ? t('puzzle.filterAll') : puzzleDifficultyText(d);
      if (typeof chip.setAttribute === 'function') {
        chip.setAttribute('aria-pressed', String(active));
      }
      chip.onclick = () => {
        this.filterDifficulty = d === all ? null : d;
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
      cat.setAttribute('aria-label', t('puzzle.filterCategoryLabel'));
    }
    const labels: Array<[string, string]> = [
      ['', t('puzzle.filterAllCategories')],
      ['classic', t('puzzle.filterClassic')],
      ['fairy', t('puzzle.filterFairy')],
    ];
    labels.forEach(([value, label]) => {
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

    // Progress summary
    const allPuzzles = puzzleManager.puzzles || [];
    const solvedCount = allPuzzles.filter(p => puzzleManager.isSolved(p.id)).length;
    const progressEl = document.getElementById('puzzle-progress');
    if (progressEl) {
      progressEl.textContent = t('puzzle.progress', { solved: solvedCount, total: allPuzzles.length });
    }

    container.innerHTML = '';
    const filtered = puzzleManager.getFilteredPuzzles(
      this.filterDifficulty ?? undefined,
      this.filterFairy ?? undefined
    );

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'puzzle-empty';
      empty.textContent = t('puzzle.emptyFilter');
      container.appendChild(empty);
      return;
    }

    filtered.forEach(({ index, puzzle }) => {
      const isSolved = puzzleManager.isSolved(puzzle.id);

      const card = document.createElement('div');
      card.className = `puzzle-card ${isSolved ? 'solved' : ''}`;

      // CSS-Klasse bleibt am Datenwert (einfach/mittel/schwer), der Text wird übersetzt.
      const difficultyClass = puzzle.difficulty.toLowerCase();

      card.innerHTML = `
        <div class="puzzle-card-header">
          <span class="puzzle-title">${puzzleTitle(puzzle)}</span>
          ${isSolved ? '<span class="puzzle-check">✅</span>' : ''}
        </div>
        <div class="puzzle-card-body">
          <span class="puzzle-difficulty ${difficultyClass}">${puzzleDifficultyText(puzzle.difficulty)}</span>
          <p class="puzzle-desc">${puzzleDescription(puzzle)}</p>
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
