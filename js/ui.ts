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

/**
 * Animation für den Schach-Zustand.
 * Nutzt .in-check (pulse-red) + .king-check-flash für sofortiges Feedback.
 */
export function animateCheck(game: GameLike, color: Player): void {
  const kingPos = AIEngine.findKing(game.board, color);
  if (kingPos) {
    const cell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
    if (cell) {
      cell.classList.add('in-check', 'king-check-flash');
      setTimeout(() => {
        cell.classList.remove('king-check-flash');
      }, 1500);
    }
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
      confettiSystem.spawn();
    }
  }
}
