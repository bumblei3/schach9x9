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

import type { Player } from './types/game.js';
import * as AIEngine from './aiEngine.js';
import { confettiSystem } from './effects.js';

// Zusätzliche Animationen
/**
 * Animation für den Schach-Zustand.
 */
export function animateCheck(game: any, color: Player): void {
  const kingPos = AIEngine.findKing(game.board, color);
  if (kingPos) {
    const cell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
    if (cell) {
      cell.classList.add('in-check');
      setTimeout(() => cell.classList.remove('in-check'), 2000);
    }
  }
}

/**
 * Animation für den Matt-Zustand.
 */
export function animateCheckmate(game: any, color: Player): void {
  const kingPos = AIEngine.findKing(game.board, color);
  if (kingPos) {
    const cell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
    if (cell) {
      cell.classList.add('checkmate');
      setTimeout(() => cell.classList.remove('checkmate'), 3000);

      // Winner is the opposite color
      // Trigger confetti
      confettiSystem.spawn();
    }
  }
}
