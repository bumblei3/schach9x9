/**
 /**
  * UI-Orchestrator für Schach9x9.
  * Importiert und re-exportiert Funktionen aus spezialisierten UI-Modulen.
  * @module ui
  */
export * from './ui/BoardRenderer.js';
export * from './ui/ShopUI.js';
export * from './ui/TutorUI.js';
export * from './ui/OverlayManager.js';
export * from './ui/GameStatusUI.js';
export * from './ui/OpeningBookUI.js';

import type { Player, GameLike } from './types/game.js';
import * as AIEngine from './aiEngine.js';
import { confettiSystem } from './effects.js';
import { updateStatus } from './ui/GameStatusUI.js';

/**
 * Animation für den Schach-Zustand.
 * Nutzt .in-check (pulse-red) + .king-check-flash für sofortiges Feedback.
 * Zusätzlich: König-Figur skaliert kurz, Status-Banner „SCHACH!“.
 */
export function animateCheck(game: GameLike, color: Player): void {
  const kingPos = AIEngine.findKing(game.board, color);
  if (kingPos) {
    const cell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
    if (cell) {
      cell.classList.add('in-check', 'king-check-flash');
      const pieceEl = cell.querySelector('.piece, .piece-svg');
      if (pieceEl) {
        pieceEl.classList.add('king-in-check');
        setTimeout(() => pieceEl.classList.remove('king-in-check'), 1600);
      }
      setTimeout(() => {
        cell.classList.remove('king-check-flash');
      }, 1500);
    }
  }
  // Brief status emphasis so check is obvious even if the king is off-screen focus
  const statusEl = document.getElementById('status-display');
  if (statusEl) {
    statusEl.classList.add('status-check');
    const side = color === 'white' ? 'Weiß' : 'Schwarz';
    const prev = statusEl.textContent || '';
    statusEl.textContent = `⚠️ SCHACH! ${side} steht im Schach`;
    statusEl.setAttribute('data-prev-status', prev);
    setTimeout(() => {
      statusEl.classList.remove('status-check');
      if (statusEl.textContent?.includes('SCHACH!')) {
        try {
          updateStatus(game as Parameters<typeof updateStatus>[0]);
        } catch {
          /* ignore if game shape incomplete */
        }
      }
    }, 2200);
  }
}

/**
 * Animation für den Matt-Zustand.
 * Nutzt .checkmate (roter Glow) + .king-mate-flash.
 */
export function animateCheckmate(game: GameLike, color: Player): void {
  const kingPos = AIEngine.findKing(game.board, color);
  if (kingPos) {
    const cell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
    if (cell) {
      cell.classList.remove('in-check');
      cell.classList.add('checkmate', 'king-mate-flash');
      const pieceEl = cell.querySelector('.piece, .piece-svg');
      if (pieceEl) pieceEl.classList.add('king-in-checkmate');
      confettiSystem.spawn();
    }
  }
}

// showInvalidMoveFeedback is re-exported from BoardRenderer via `export *` above.
