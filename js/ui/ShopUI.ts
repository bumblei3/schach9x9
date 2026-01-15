/**
 * Modul für das Shop-System UI.
 * @module ShopUI
 */
import { PIECE_VALUES } from '../config.js';
import { getPieceText } from './BoardRenderer.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Removed top-level await preventing circular dependency
// const { updateTutorRecommendations } = (await import('./TutorUI.js')) as any;

/**
 * Zeigt oder verbirgt das Shop-Panel.
 * @param game - Die Game-Instanz
 * @param show - Sichtbarkeit
 */
export function showShop(game: any, show: boolean): void {
  const panel = document.getElementById('shop-panel');
  if (!panel) return;

  if (show) {
    panel.classList.remove('hidden');
    document.body.classList.add('setup-mode');
  } else {
    panel.classList.add('hidden');
    document.body.classList.remove('setup-mode');
  }
  updateShopUI(game);
}

/**
 * Aktualisiert die Shop-Anzeige.
 * @param game - Die Game-Instanz
 */
export function updateShopUI(game: any): void {
  const pointsDisplay = document.getElementById('points-display');
  if (pointsDisplay) pointsDisplay.textContent = game.points.toString();

  const tutorPointsDisplay = document.getElementById('tutor-points-display');
  if (tutorPointsDisplay) tutorPointsDisplay.textContent = (game.tutorPoints || 0).toString();

  document.querySelectorAll<HTMLElement>('.shop-item').forEach(btn => {
    const cost = parseInt(btn.dataset.cost || '0');
    if (cost > game.points) {
      btn.classList.add('disabled');
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    } else {
      btn.classList.remove('disabled');
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  });

  const finishBtn = document.getElementById('finish-setup-btn') as HTMLButtonElement | null;
  if (finishBtn) {
    finishBtn.disabled = false;
    // Show button during upgrade phases or piece placement
    const phase = String(game.phase);
    if (phase === 'SETUP_WHITE_UPGRADES' || phase === 'SETUP_BLACK_UPGRADES') {
      finishBtn.textContent = 'Fertig';
      finishBtn.classList.remove('hidden');
    } else if (phase === 'SETUP_WHITE_PIECES' || phase === 'SETUP_BLACK_PIECES') {
      finishBtn.textContent = 'Fertig'; // Or 'Start Game'
      finishBtn.classList.remove('hidden');
    }
  }

  const statusDisplay = document.getElementById('selected-piece-display');
  if (statusDisplay) {
    if (game.selectedShopPiece) {
      statusDisplay.textContent = `Platziere: ${getPieceText({ type: game.selectedShopPiece, color: game.turn })} (${PIECE_VALUES[game.selectedShopPiece as keyof typeof PIECE_VALUES]} Pkt)`;
    } else {
      statusDisplay.textContent = 'Wähle eine Figur zum Kaufen';
    }
  }

  // Check if UI module is available globally (from App.ts)
  const globalUI = (window as any).UI;
  if (globalUI && globalUI.updateTutorRecommendations) {
    globalUI.updateTutorRecommendations(game);
  } else if ((window as any).updateTutorRecommendations) {
    // Legacy fallback
    (window as any).updateTutorRecommendations(game);
  } else {
    // Dynamic import fallback
    import('./TutorUI.js').then((module: any) => {
      if (module.updateTutorRecommendations) module.updateTutorRecommendations(game);
    });
  }
}
