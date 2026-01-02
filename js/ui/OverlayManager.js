/**
 * Modul zur Verwaltung von Overlays, Modals und Toasts.
 * @module OverlayManager
 */
import { renderBoard } from './BoardRenderer.js';

/**
 * Zeigt ein modales Dialogfenster an.
 * @param {string} title - Der Titel des Modals
 * @param {string} message - Die Nachricht
 * @param {Array<{text: string, class: string, callback: Function}>} actions - Buttons
 */
export function showModal(title, message, actions = []) {
  const modal = document.getElementById('generic-modal');
  const titleEl = document.getElementById('modal-title');
  const messageEl = document.getElementById('modal-message');
  const actionsEl = document.getElementById('modal-actions');

  if (!modal || !titleEl || !messageEl || !actionsEl) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
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

  modal.style.display = 'flex';
}

/**
 * Schließt das aktive Modal.
 */
export function closeModal() {
  const modal = document.getElementById('generic-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * Zeigt das Overlay für die Bauernbeförderung an.
 */
export function showPromotionUI(game, r, c, color, moveRecord, callback) {
  const overlay = document.getElementById('promotion-overlay');
  const optionsContainer = document.getElementById('promotion-options');
  if (!overlay || !optionsContainer) return;

  optionsContainer.innerHTML = '';
  const options = [
    { type: 'e', symbol: 'E' },
    { type: 'q', symbol: color === 'white' ? '♕' : '♛' },
    { type: 'c', symbol: 'C' },
    { type: 'a', symbol: 'A' },
    { type: 'r', symbol: color === 'white' ? '♖' : '♜' },
    { type: 'b', symbol: 'B' },
    { type: 'n', symbol: 'N' },
  ];

  options.forEach(opt => {
    const btn = document.createElement('div');
    btn.className = 'promotion-option';
    btn.innerHTML = `<div class="piece-svg">${window.PIECE_SVGS[color][opt.type]}</div>`;
    btn.onclick = () => {
      if (game.board[r][c]) {
        game.board[r][c].type = opt.type;
        if (moveRecord) moveRecord.specialMove = { type: 'promotion', promotedTo: opt.type };
        if (game.log) game.log(`${color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer befördert!`);
        overlay.classList.add('hidden');
        renderBoard(game);
        if (callback) callback();
      }
    };
    optionsContainer.appendChild(btn);
  });
  overlay.classList.remove('hidden');
}

/**
 * Zeigt das Overlay für Puzzles an.
 */
export function showPuzzleOverlay(puzzle) {
  const overlay = document.getElementById('puzzle-overlay');
  if (!overlay) return;
  document.getElementById('puzzle-title').textContent = puzzle.title;
  document.getElementById('puzzle-description').textContent = puzzle.description;
  const statusEl = document.getElementById('puzzle-status');
  statusEl.textContent = 'Weiß am Zug';
  statusEl.className = 'puzzle-status';
  document.getElementById('puzzle-next-btn').classList.add('hidden');
  document.getElementById('puzzle-exit-btn').classList.remove('hidden');
  overlay.classList.remove('hidden');
}

/**
 * Verbirgt das Puzzle-Overlay.
 */
export function hidePuzzleOverlay() {
  const overlay = document.getElementById('puzzle-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Aktualisiert den Status im Puzzle-Overlay.
 */
export function updatePuzzleStatus(status, message) {
  const statusEl = document.getElementById('puzzle-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `puzzle-status ${status}`;
  if (status === 'success') {
    document.getElementById('puzzle-next-btn').classList.remove('hidden');
  }
}

/**
 * Zeigt eine Toast-Nachricht an.
 */
export function showToast(message, type = 'neutral') {
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
