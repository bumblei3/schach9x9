/**
 * UI Effects for Schach 9x9
 * Handles background animations and floating piece effects for the main menu.
 */

export class UIEffects {
    container: HTMLElement;
    pieces: string[];

    constructor() {
        this.container = document.body;
        this.pieces = ['♟', '♞', '♝', '♜', '♛', '♚', '🏰', '⚖️', '👼'];
    }

    /**
     * Start the floating pieces effect in the background
     */
    startFloatingPieces(): void {
        const overlay = document.getElementById('points-selection-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            this.createFloatingPieces(15);
        }
    }

    /**
     * Create floating chess pieces
     * @param count 
     */
    createFloatingPieces(count: number): void {
        for (let i = 0; i < count; i++) {
            this.spawnPiece();
        }
    }

    spawnPiece(): void {
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

    /**
     * Animate earning stars in the campaign victory modal
     * @param count - Number of stars earned (1-3)
     */
    animateStars(count: number): void {
        const starContainer = document.querySelector('.victory-stars-container');
        if (!starContainer) return;

        starContainer.innerHTML = '';
        for (let i = 1; i <= 3; i++) {
            const star = document.createElement('div');
            star.className = 'victory-star-anim';
            star.innerHTML = i <= count ? '★' : '☆';
            if (i > count) star.classList.add('empty');
            star.style.animationDelay = `${0.3 + i * 0.4}s`;
            starContainer.appendChild(star);
        }
    }
}

// Add CSS for the floating pieces if not in a CSS file
if (typeof document !== 'undefined') {
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
  
      /* Victory Star Animations */
      .victory-stars-container {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin: 2rem 0;
          min-height: 80px;
      }
  
      .victory-star-anim {
          font-size: 4rem;
          color: gold;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          opacity: 0;
          transform: scale(0) rotate(-45deg);
          animation: starPopIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      }
  
      .victory-star-anim.empty {
          color: #444;
          text-shadow: none;
      }
  
      @keyframes starPopIn {
          0% {
              opacity: 0;
              transform: scale(0) rotate(-45deg);
          }
          70% {
              transform: scale(1.2) rotate(10deg);
          }
          100% {
              opacity: 1;
              transform: scale(1) rotate(0);
          }
      }
  `;
    document.head.appendChild(style);
}
