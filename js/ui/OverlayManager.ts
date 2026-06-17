/**
 * Modul zur Verwaltung von Overlays, Modals und Toasts.
 * @module OverlayManager
 */
import { renderBoard } from './BoardRenderer.js';
import { soundManager } from '../sounds.js';
import type { Player, Piece } from '../types/core.js';
import type { GameLike, MoveRecord, Puzzle, ModalAction } from '../types/core.js';

/**
 * Zeigt ein modales Dialogfenster an.
 * @param {string} title - Der Titel des Modals
 * @param {string} message - Die Nachricht
 * @param {Array<{text: string, class?: string, callback?: Function}>} actions - Buttons
 */
export function showModal(
  title: string,
  message: string,
  actions: Array<{ text: string; class?: string; callback?: () => void }> = []
): void {
  const modal = document.getElementById('generic-modal');
  const titleEl = document.getElementById('modal-title');
  const messageEl = document.getElementById('modal-message');
  const actionsEl = document.getElementById('modal-actions');

  if (!modal || !titleEl || !messageEl || !actionsEl) {
    console.log('[OverlayManager] Missing elements:', {
      modal: !!modal,
      titleEl: !!titleEl,
      messageEl: !!messageEl,
      actionsEl: !!actionsEl,
    });
    return;
  }
  console.log('[OverlayManager] Showing modal:', title);

  titleEl.textContent = title;
  messageEl.innerHTML = message;
  actionsEl.innerHTML = '';

  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action.text;
    btn.className = action.class || 'btn-secondary';
    btn.onclick = () => {
      if (action.callback) action.callback();
      closeModal();
    };
    actionsEl.appendChild(btn);
  });

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  console.log('[OverlayManager] Modal visibility set to flex');
}

/**
 * Schließt das aktive Modal.
 */
export function closeModal(): void {
  const modal = document.getElementById('generic-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    console.log('[OverlayManager] Modal closed');
  }
}

/**
 * Zeigt das Overlay für die Bauernbeförderung an.
 * Nutzt ein 4-Spalten Grid mit empfohlenen Figuren, Sound und Keyboard-Support.
 */
export function showPromotionUI(
  game: GameLike,
  r: number,
  c: number,
  color: Player,
  moveRecord: MoveRecord,
  callback?: () => void
): void {
  const overlay = document.getElementById('promotion-overlay');
  const optionsContainer = document.getElementById('promotion-options');
  if (!overlay || !optionsContainer) {
    console.error('[OverlayManager] Error: Promotion overlay or options container not found!');
    return;
  }

  optionsContainer.innerHTML = '';
  optionsContainer.className = 'promotion-grid';

  // Sort by value descending, mark top 2 as recommended
  const options = [
    { type: 'q', name: 'Dame', cost: 9 },
    { type: 'e', name: 'Engel', cost: 12 },
    { type: 'c', name: 'Kanzler', cost: 8 },
    { type: 'a', name: 'Erzbischof', cost: 7 },
    { type: 'r', name: 'Turm', cost: 5 },
    { type: 'b', name: 'Läufer', cost: 3 },
    { type: 'n', name: 'Springer', cost: 3 },
  ].sort((a, b) => b.cost - a.cost);

  const recommended = new Set([options[0].type, options[1].type]);

  const selectPiece = (opt: typeof options[0]) => {
    const piece = game.board[r][c];
    if (piece) {
      piece.type = opt.type as Piece['type'];
      if (moveRecord) moveRecord.specialMove = { type: 'promotion', promotedTo: opt.type };
      if (game.log) game.log(`${color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer zu ${opt.name} befördert!`);
      soundManager.playPromotion();
      overlay.classList.add('hidden');
      renderBoard(game);
      if (callback) callback();
    }
  };

  try {
    options.forEach(opt => {
      const btn = document.createElement('div');
      btn.className = 'promotion-option';
      btn.dataset.piece = opt.type;
      btn.tabIndex = 0;
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', `${opt.name} befördern`);

      if (recommended.has(opt.type)) {
        btn.classList.add('recommended');
      }

      const svgs = window.PIECE_SVGS as Record<string, Record<string, string>> | undefined;
      if (!svgs || !svgs[color] || !svgs[color][opt.type]) {
        console.error(`[OverlayManager] Missing SVG for ${color} ${opt.type}`);
      }

      btn.innerHTML = `
        ${recommended.has(opt.type) ? '<div class="promo-badge">★</div>' : ''}
        <div class="piece-svg">${svgs ? svgs[color][opt.type] : '?'}</div>
        <div class="piece-name">${opt.name}</div>
        <div class="piece-cost">${opt.cost} Pkt</div>
      `;

      btn.onclick = () => selectPiece(opt);
      btn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectPiece(opt);
        }
      };

      optionsContainer.appendChild(btn);
    });
    overlay.classList.remove('hidden');
    overlay.classList.add('show');

    // Focus first recommended option
    const firstRec = optionsContainer.querySelector('.promotion-option.recommended') as HTMLElement;
    if (firstRec) firstRec.focus();
  } catch (e) {
    console.error('[OverlayManager] Error showing promotion UI:', e);
  }
}

/**
 * Zeigt das Overlay für Puzzles an.
 */
export function showPuzzleOverlay(puzzle: Puzzle): void {
  const overlay = document.getElementById('puzzle-overlay');
  if (!overlay) return;
  const titleEl = document.getElementById('puzzle-title');
  const descEl = document.getElementById('puzzle-description');
  if (titleEl) titleEl.textContent = puzzle.title;
  if (descEl) descEl.textContent = puzzle.description;

  const statusEl = document.getElementById('puzzle-status');
  if (statusEl) {
    statusEl.textContent = 'Weiß am Zug';
    statusEl.className = 'puzzle-status';
  }

  const nextBtn = document.getElementById('puzzle-next-btn');
  const exitBtn = document.getElementById('puzzle-exit-btn');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (exitBtn) exitBtn.classList.remove('hidden');

  overlay.classList.remove('hidden');
}

/**
 * Verbirgt das Puzzle-Overlay.
 */
export function hidePuzzleOverlay(): void {
  const overlay = document.getElementById('puzzle-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Aktualisiert den Status im Puzzle-Overlay.
 */
export function updatePuzzleStatus(status: string, message: string): void {
  const statusEl = document.getElementById('puzzle-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `puzzle-status ${status}`;
  if (status === 'success') {
    const nextBtn = document.getElementById('puzzle-next-btn');
    if (nextBtn) nextBtn.classList.remove('hidden');
  }
}

/**
 * Zeigt eine Toast-Nachricht an.
 */
export function showToast(message: string, type: string = 'neutral'): void {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '💡';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Zeigt einen speziellen Sieg-Bildschirm für die Kampagne.
 * @param {string} title - Level Titel
 * @param {number} stars - Anzahl der verdienten Sterne (1-3)
 * @param {ModalAction[]} actions - Button-Aktionen
 */
export async function showCampaignVictoryModal(
  title: string,
  stars: number,
  actions: ModalAction[] = [],
  analysis?: { accuracy: number; advice: string }
): Promise<void> {
  let analysisHtml = '';
  if (analysis) {
    analysisHtml = `
            <div class="analysis-summary" style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 8px; margin-top: 1rem; border-left: 4px solid gold;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-muted);">Genauigkeit:</span>
                    <span style="color: gold; font-weight: bold;">${analysis.accuracy}%</span>
                </div>
                <p style="margin: 0; font-style: italic; color: var(--text-muted); font-size: 0.9rem;">"${analysis.advice}"</p>
            </div>
        `;
  }

  const content = `
        <div class="campaign-victory-content" style="text-align: center;">
            <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 0.5rem;">Mission erfüllt!</p>
            <h2 style="color: gold; margin-bottom: 1rem; text-shadow: 0 0 15px rgba(255, 215, 0, 0.3);">${title}</h2>
            
            <div class="victory-stars-container">
                <!-- Stars will be animated here by UIEffects -->
                <div class="victory-star-anim empty">☆</div>
                <div class="victory-star-anim empty">☆</div>
                <div class="victory-star-anim empty">☆</div>
            </div>
 
            <div style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                <p style="margin: 0; color: var(--accent-success);">Hervorragende Leistung, Kommandant!</p>
            </div>

            ${analysisHtml}
        </div>
    `;

  showModal('Sieg!', content, actions);

  // Trigger star animation after a short delay to let modal open
  setTimeout(async () => {
    const { UIEffects } = await import('./ui_effects.js');
    const effects = new UIEffects();
    effects.animateStars(stars);
  }, 100);
}
