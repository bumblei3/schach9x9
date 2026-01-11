import { puzzleManager } from '../puzzleManager.js';

export class PuzzleMenu {
  constructor(gameController) {
    this.gameController = gameController;
    this.overlay = document.getElementById('puzzle-menu-overlay');

    // Bind close button
    const closeBtn = document.getElementById('puzzle-menu-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    } else {
      // Optional: Log warning if not in test environment
      // console.warn('Puzzle menu close button not found');
    }
  }

  show() {
    this.renderPuzzleList();
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
      this.overlay.style.display = 'flex';
    }
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
      this.overlay.style.display = 'none';
    }
  }

  renderPuzzleList() {
    const container = document.getElementById('puzzle-menu-list');
    if (!container) return;

    container.innerHTML = '';
    const puzzles = puzzleManager.getPuzzles();

    puzzles.forEach((puzzle, index) => {
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
        // Use the gameController to load the puzzle by index
        // We might want to pass ID, but puzzleManager.loadPuzzle takes index currently.
        // Let's rely on index for now as puzzles are static list.
        if (this.gameController.loadPuzzle) {
          this.gameController.loadPuzzle(index);
        } else {
          // Fallback if direct load not available, though we planned to add it
          this.gameController.startPuzzleMode(index);
        }
      };

      container.appendChild(card);
    });
  }
}
