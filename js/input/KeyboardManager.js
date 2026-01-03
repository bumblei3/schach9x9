/**
 * Handles global keyboard shortcuts for the game.
 * Maps key combinations to game actions.
 * @module KeyboardManager
 */
export class KeyboardManager {
  constructor(app) {
    this.app = app;
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.init();
  }

  init() {
    window.addEventListener('keydown', this.boundHandleKeyDown);
  }

  dispose() {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
  }

  async handleKeyDown(event) {
    if (!this.app.gameController || !this.app.game) return;

    // Ignore input fields
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.isContentEditable
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    // Lazy load UI to avoid circular dependency issues at init time
    const UI = await import('../ui.js');

    // Undo: Ctrl+Z or 'u'
    if ((ctrl && key === 'z' && !shift) || key === 'u') {
      event.preventDefault();
      this.app.gameController.undoMove();
      UI.showToast('Undo', 'info');
      return;
    }

    // Redo: Ctrl+Y, Ctrl+Shift+Z, or 'r'
    if ((ctrl && key === 'y') || (ctrl && shift && key === 'z') || key === 'r') {
      event.preventDefault();
      this.app.gameController.redoMove();
      UI.showToast('Redo', 'info');
      return;
    }

    // Hint: 'h'
    if (key === 'h') {
      event.preventDefault();
      if (this.app.tutorController) {
        this.app.tutorController.showHint();
      }
      return;
    }

    // Threats: 't'
    if (key === 't') {
      event.preventDefault();
      if (this.app.game.analysisManager) {
        const active = this.app.game.analysisManager.toggleThreats();
        UI.showToast(active ? 'Drohungen AN' : 'Drohungen AUS', 'info');
        const btn = document.getElementById('threats-btn');
        if (btn) btn.classList.toggle('active', active);
      }
      return;
    }

    // Opportunities: 'o'
    if (key === 'o') {
      event.preventDefault();
      if (this.app.game.analysisManager) {
        const active = this.app.game.analysisManager.toggleOpportunities();
        UI.showToast(active ? 'Chancen AN' : 'Chancen AUS', 'info');
        const btn = document.getElementById('opportunities-btn');
        if (btn) btn.classList.toggle('active', active);
      }
      return;
    }

    // Best Move: 'b'
    if (key === 'b') {
      event.preventDefault();
      if (this.app.game.analysisManager) {
        const active = this.app.game.analysisManager.toggleBestMove();
        UI.showToast(active ? 'Bester Zug AN' : 'Bester Zug AUS', 'info');
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

    // Escape: Cancel selection / Close modals
    if (key === 'escape') {
      event.preventDefault();

      // Close any open modals
      if (UI.closeModal) UI.closeModal();
      if (UI.OverlayManager && UI.OverlayManager.closeAll) UI.OverlayManager.closeAll();

      // Deselect piece
      if (this.app.game.selectedSquare) {
        if (this.app.gameController.resetSelection) {
          this.app.gameController.resetSelection();
        } else {
          this.app.game.selectedSquare = null;
          this.app.game.validMoves = [];
          UI.renderBoard(this.app.game);
        }
      }
      return;
    }
  }
}
