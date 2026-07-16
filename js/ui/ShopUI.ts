/**
 * Modul für das Shop-System UI.
 * @module ShopUI
 */
import { PIECE_VALUES } from '../config.js';
import { getPieceText } from './BoardRenderer.js';
import { updateTutorRecommendations } from './TutorUI.js';
import type { GameLike, PieceType } from '../types/core.js';
import type { Game } from '../gameEngine.js';

/**
 * Zeigt oder verbirgt das Shop-Panel.
 * @param game - Die Game-Instanz
 * @param show - Sichtbarkeit
 */
export function showShop(game: GameLike, show: boolean): void {
  const panel = document.getElementById('shop-panel');
  if (!panel) return;
  const backdrop = document.getElementById('sheet-backdrop');

  if (show) {
    panel.classList.remove('hidden');
    document.body.classList.add('setup-mode');
    // Mobile: dim the board behind the bottom sheet (desktop keeps side panel).
    if (backdrop && window.matchMedia('(max-width: 768px)').matches) {
      backdrop.classList.remove('hidden');
      backdrop.setAttribute('aria-hidden', 'false');
    }
  } else {
    panel.classList.add('hidden');
    document.body.classList.remove('setup-mode');
    // Only hide backdrop if the action overflow is also closed.
    const overflow = document.getElementById('action-overflow-menu');
    if (backdrop && (!overflow || overflow.classList.contains('hidden'))) {
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }
  updateShopUI(game);
}

/**
 * Aktualisiert die Shop-Anzeige.
 * @param game - Die Game-Instanz
 */
export function updateShopUI(game: GameLike): void {
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
  const shopGrid = document.getElementById('shop-buttons');
  const tutorSection = document.getElementById('tutor-recommendations-section');
  const shopHeader = document.querySelector('#shop-panel .shop-header h2');
  const phase = String(game.phase);
  const isUpgradePhase = phase === 'SETUP_WHITE_UPGRADES' || phase === 'SETUP_BLACK_UPGRADES';

  if (isUpgradePhase) {
    if (shopHeader) shopHeader.textContent = 'Truppen verbessern';
    if (shopGrid) shopGrid.classList.add('hidden');
    if (tutorSection) tutorSection.classList.add('hidden');
    if (statusDisplay)
      statusDisplay.textContent = 'Klicke auf Figuren auf dem Brett zum Verbessern';
  } else {
    if (shopHeader) shopHeader.textContent = 'Truppen anheuern';
    if (shopGrid) shopGrid.classList.remove('hidden');
    if (tutorSection) tutorSection.classList.remove('hidden');

    if (statusDisplay) {
      if (game.selectedShopPiece) {
        const pieceType = game.selectedShopPiece as Exclude<PieceType, null>;
        statusDisplay.textContent = `Platziere: ${getPieceText({ type: pieceType, color: game.turn })} (${PIECE_VALUES[pieceType as keyof typeof PIECE_VALUES]} Pkt)`;
      } else {
        statusDisplay.textContent = 'Wähle eine Figur zum Kaufen';
      }
    }
  }

  // Check if UI module is available globally (from App.ts)
  const globalUI = window.UI as
    { updateTutorRecommendations?: (_game: unknown) => void } | undefined;
  if (globalUI?.updateTutorRecommendations) {
    globalUI.updateTutorRecommendations(game);
  } else {
    const legacyUpdate = window.updateTutorRecommendations as
      ((_game: unknown) => void) | undefined;
    if (legacyUpdate) {
      legacyUpdate(game);
    } else {
      updateTutorRecommendations(game as unknown as Game);
    }
  }
}
