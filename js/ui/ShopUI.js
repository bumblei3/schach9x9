/**
 * Modul für das Shop-System UI.
 * @module ShopUI
 */
import { PIECE_VALUES } from '../config.js';
import { getPieceText } from './BoardRenderer.js';
import { updateTutorRecommendations } from './TutorUI.js';

/**
 * Zeigt oder verbirgt das Shop-Panel.
 * @param {object} game - Die Game-Instanz
 * @param {boolean} show - Sichtbarkeit
 */
export function showShop(game, show) {
  const panel = document.getElementById('shop-panel');
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
 * @param {object} game - Die Game-Instanz
 */
export function updateShopUI(game) {
  const pointsDisplay = document.getElementById('points-display');
  if (pointsDisplay) pointsDisplay.textContent = game.points;

  const tutorPointsDisplay = document.getElementById('tutor-points-display');
  if (tutorPointsDisplay) tutorPointsDisplay.textContent = game.tutorPoints || 0;

  document.querySelectorAll('.shop-item').forEach(btn => {
    const cost = parseInt(btn.dataset.cost);
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

  const finishBtn = document.getElementById('finish-setup-btn');
  if (finishBtn) finishBtn.disabled = false;

  const statusDisplay = document.getElementById('selected-piece-display');
  if (statusDisplay) {
    if (game.selectedShopPiece) {
      statusDisplay.textContent = `Platziere: ${getPieceText({ type: game.selectedShopPiece, color: game.turn })} (${PIECE_VALUES[game.selectedShopPiece]} Pkt)`;
    } else {
      statusDisplay.textContent = 'Wähle eine Figur zum Kaufen';
    }
  }

  updateTutorRecommendations(game);
}
