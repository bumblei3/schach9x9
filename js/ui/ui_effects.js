/**
 * UI Effects for Schach 9x9
 * Handles background animations and floating piece effects for the main menu.
 */

export class UIEffects {
  constructor() {
    this.container = document.body;
    this.pieces = ['♟', '♞', '♝', '♜', '♛', '♚', '🏰', '⚖️', '👼'];
  }

  /**
   * Start the floating pieces effect in the background
   */
  startFloatingPieces() {
    // Only run on main menu or if desirable
    if (
      document.getElementById('points-selection-overlay') &&
      !document.getElementById('points-selection-overlay').classList.contains('hidden')
    ) {
      this.createFloatingPieces(15);
    }
  }

  /**
   * Create floating chess pieces
   * @param {number} count
   */
  createFloatingPieces(count) {
    for (let i = 0; i < count; i++) {
      this.spawnPiece();
    }
  }

  spawnPiece() {
    const piece = document.createElement('div');
    piece.className = 'floating-bg-piece';
    piece.textContent = this.pieces[Math.floor(Math.random() * this.pieces.length)];

    const size = 20 + Math.random() * 60;
    const left = Math.random() * 100;
    const duration = 15 + Math.random() * 30;
    const delay = Math.random() * -30;

    piece.style.left = `${left}%`;
    piece.style.fontSize = `${size}px`;
    piece.style.opacity = (Math.random() * 0.1).toString();
    piece.style.animation = `floatPiece ${duration}s linear ${delay}s infinite`;

    this.container.appendChild(piece);
  }
}

// Add CSS for the floating pieces if not in a CSS file
const style = document.createElement('style');
style.textContent = `
    @keyframes floatPiece {
        0% {
            transform: translateY(110vh) rotate(0deg);
        }
        100% {
            transform: translateY(-10vh) rotate(360deg);
        }
    }
    .floating-bg-piece {
        position: fixed;
        bottom: -100px;
        color: var(--text-main);
        pointer-events: none;
        z-index: -1;
        user-select: none;
    }
`;
document.head.appendChild(style);
