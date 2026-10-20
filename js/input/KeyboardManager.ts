/**
 * Handles global keyboard shortcuts for the game.
 * Maps key combinations to game actions.
 * @module KeyboardManager
 */
import { showToast, closeModal, renderBoard, updateStatus } from '../ui.js';
import type { App } from '../App.js';
import type { Game } from '../gameEngine.js';

export class KeyboardManager {
  private app: App;
  private boundHandleKeyDown: (_event: KeyboardEvent) => Promise<void>;
  private pendingFile: string | null = null;
  private pendingFileTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(app: App) {
    this.app = app;
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.init();
  }

  init(): void {
    window.addEventListener('keydown', this.boundHandleKeyDown);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
  }

  async handleKeyDown(event: KeyboardEvent): Promise<void> {
    const g: Game = this.app.game as unknown as Game;
    if (!this.app.gameController || !g) return;

    // Ignore input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    // Field selection by typing: Shift + letter (a-i) then number (1-9).
    // E.g. Shift+E then 4 selects e4. Avoids clashing with single-key shortcuts.
    const files = 'abcdefghi';
    if (shift && files.includes(key) && key.length === 1) {
      event.preventDefault();
      this.pendingFile = key;
      if (this.pendingFileTimer) clearTimeout(this.pendingFileTimer);
      this.pendingFileTimer = setTimeout(() => {
        this.pendingFile = null;
        this.pendingFileTimer = null;
      }, 2000);
      showToast(`Feld: ${key.toUpperCase()}…`, 'info');
      return;
    }
    if (this.pendingFile && /^[1-9]$/.test(key)) {
      event.preventDefault();
      const col = files.indexOf(this.pendingFile);
      const rank = parseInt(key, 10);
      const row = 9 - rank; // rank 1 -> row 8, rank 9 -> row 0
      const piece = g.board[row]?.[col];
      g.selectedSquare = { r: row, c: col };
      g.validMoves = piece ? (g.getValidMoves(row, col, piece) ?? []) : [];
      const game = this.app.game;
      if (game) renderBoard(game);
      if (g.selectedSquare) {
        showToast(`${this.pendingFile.toUpperCase()}${key} ausgewählt`, 'info');
      }
      if (this.pendingFileTimer) clearTimeout(this.pendingFileTimer);
      this.pendingFile = null;
      this.pendingFileTimer = null;
      return;
    }
    // Any other key cancels a pending file selection.
    if (this.pendingFile) {
      if (this.pendingFileTimer) clearTimeout(this.pendingFileTimer);
      this.pendingFile = null;
      this.pendingFileTimer = null;
    }

    // Undo: Ctrl+Z or 'u'
    if ((ctrl && key === 'z' && !shift) || key === 'u') {
      event.preventDefault();
      this.app.gameController.undoMove();
      showToast('Undo', 'info');
      return;
    }

    // Redo: Ctrl+Y, Ctrl+Shift+Z, or 'r'
    if ((ctrl && key === 'y') || (ctrl && shift && key === 'z') || key === 'r') {
      event.preventDefault();
      this.app.gameController.redoMove();
      showToast('Redo', 'info');
      return;
    }

    // Hint: 'h'
    if (key === 'h') {
      event.preventDefault();
      if (this.app.tutorController) {
        await this.app.tutorController.showHint();
      }
      return;
    }

    // Threats: 't'
    if (key === 't') {
      event.preventDefault();
      if (g.analysisManager) {
        const active = g.analysisManager.toggleThreats();
        showToast(active ? 'Drohungen AN' : 'Drohungen AUS', 'info');
        const btn = document.getElementById('threats-btn');
        if (btn) btn.classList.toggle('active', active);
      }
      return;
    }

    // Opportunities: 'o'
    if (key === 'o') {
      event.preventDefault();
      if (g.analysisManager) {
        const active = g.analysisManager.toggleOpportunities();
        showToast(active ? 'Chancen AN' : 'Chancen AUS', 'info');
        const btn = document.getElementById('opportunities-btn');
        if (btn) btn.classList.toggle('active', active);
      }
      return;
    }

    // Best Move: 'b'
    if (key === 'b') {
      event.preventDefault();
      if (g.analysisManager) {
        const active = g.analysisManager.toggleBestMove();
        showToast(active ? 'Bester Zug AN' : 'Bester Zug AUS', 'info');
        const btn = document.getElementById('best-move-btn');
        if (btn) btn.classList.toggle('active', active);
      }
      return;
    }

    // Save: 's'
    if (key === 's') {
      event.preventDefault();
      if (this.app.gameController.saveGame) {
        this.app.gameController.saveGame();
      }
      return;
    }

    // Fullscreen: 'f'
    if (key === 'f') {
      event.preventDefault();
      if (this.app.toggleFullscreen) {
        this.app.toggleFullscreen();
      }
      return;
    }

    // Emergency Recovery: Ctrl+Shift+F12
    if (ctrl && shift && key === 'f12') {
      event.preventDefault();
      this.performEmergencyRecovery();
      showToast('🔧 Emergency Recovery - Game unstuck!', 'warning');
      return;
    }

    // Escape: Cancel selection / Close modals
    if (key === 'escape') {
      event.preventDefault();
      if (this.pendingFileTimer) clearTimeout(this.pendingFileTimer);
      this.pendingFile = null;
      this.pendingFileTimer = null;

      closeModal();

      if (g.selectedSquare) {
        const gc = this.app.gameController as { resetSelection?: () => void } | null;
        if (gc?.resetSelection) {
          gc.resetSelection();
        } else {
          g.selectedSquare = null;
          g.validMoves = [];
          const game = this.app.game;
          if (game) {
            renderBoard(game);
          }
        }
      }
      return;
    }
  }

  /**
   * Emergency recovery function to unstick frozen games.
   */
  performEmergencyRecovery(): void {
    const g: Game = this.app.game as unknown as Game;
    if (!g) return;

    const previousTurn = g.turn;
    g.turn = 'white';
    g.isAnimating = false;

    const spinner = document.getElementById('spinner-overlay');
    if (spinner) spinner.classList.add('hidden');

    g.selectedSquare = null;
    g.validMoves = null;
    g._forceFullRender = true;

    console.warn(
      `[RECOVERY] Previous turn: ${previousTurn}, isAnimating was reset, spinner hidden`
    );

    renderBoard(g);
    updateStatus(g);
  }
}
