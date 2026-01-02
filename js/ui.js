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

// Zusätzliche Animationen (könnten später auch verschoben werden)
/**
 * Animation für den Schach-Zustand.
 */
export function animateCheck(game, color) {
  const kingPos = findKing(game, color);
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
export function animateCheckmate(game, color) {
  const kingPos = findKing(game, color);
  if (kingPos) {
    const cell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
    if (cell) {
      cell.classList.add('checkmate');
      setTimeout(() => cell.classList.remove('checkmate'), 3000);
    }
  }
}

// Helper für Animationen
function findKing(game, color) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = game.board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
  }
  return null;
}
