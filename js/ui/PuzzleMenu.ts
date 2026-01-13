import { puzzleManager } from '../puzzleManager.js';

export class PuzzleMenu {
  gameController: any;
  overlay: HTMLElement | null;

  constructor(gameController: any) {
    this.gameController = gameController;
    this.overlay = document.getElementById('puzzle-menu-overlay');

    const closeBtn = document.getElementById('puzzle-menu-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
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

  renderPuzzleList(): void {
    const container = document.getElementById('puzzle-menu-list');
    if (!container) return;

    container.innerHTML = '';
    const puzzles = (puzzleManager as any).getPuzzles();

    puzzles.forEach((puzzle: any, index: number) => {
      const isSolved = (puzzleManager as any).isSolved(puzzle.id);

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
        } else {
          this.gameController.startPuzzleMode(index);
        }
      };

      container.appendChild(card);
    });
  }
}
