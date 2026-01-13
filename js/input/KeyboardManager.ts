/**
 * Handles global keyboard shortcuts for the game.
 * Maps key combinations to game actions.
 * @module KeyboardManager
 */
import type { App } from '../App.js';

export class KeyboardManager {
  private app: App;
  private boundHandleKeyDown: (event: KeyboardEvent) => Promise<void>;

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
    const g = this.app.game as any;
    if (!this.app.gameController || !g) return;

    // Ignore input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    // Lazy load UI
    const UI = await import('../ui.js');

    // Undo: Ctrl+Z or 'u'
    if ((ctrl && key === 'z' && !shift) || key === 'u') {
      event.preventDefault();
      this.app.gameController.undoMove();
      (UI as any).showToast('Undo', 'info');
      return;
    }

    // Redo: Ctrl+Y, Ctrl+Shift+Z, or 'r'
    if ((ctrl && key === 'y') || (ctrl && shift && key === 'z') || key === 'r') {
      event.preventDefault();
      this.app.gameController.redoMove();
      (UI as any).showToast('Redo', 'info');
      return;
    }

    // Hint: 'h'
    if (key === 'h') {
      event.preventDefault();
      if ((this.app as any).tutorController) {
        await (this.app as any).tutorController.showHint();
      }
      return;
    }

    // Threats: 't'
    if (key === 't') {
      event.preventDefault();
      if (g.analysisManager) {
        const active = g.analysisManager.toggleThreats();
        (UI as any).showToast(active ? 'Drohungen AN' : 'Drohungen AUS', 'info');
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
        (UI as any).showToast(active ? 'Chancen AN' : 'Chancen AUS', 'info');
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
        (UI as any).showToast(active ? 'Bester Zug AN' : 'Bester Zug AUS', 'info');
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
      if ((this.app as any).toggleFullscreen) {
        (this.app as any).toggleFullscreen();
      }
      return;
    }

    // Emergency Recovery: Ctrl+Shift+F12
    if (ctrl && shift && key === 'f12') {
      event.preventDefault();
      this.performEmergencyRecovery();
      (UI as any).showToast('🔧 Emergency Recovery - Game unstuck!', 'warning');
      return;
    }

    // Escape: Cancel selection / Close modals
    if (key === 'escape') {
      event.preventDefault();

      if ((UI as any).closeModal) (UI as any).closeModal();
      if ((UI as any).OverlayManager && (UI as any).OverlayManager.closeAll)
        (UI as any).OverlayManager.closeAll();

      if (g.selectedSquare) {
        if (this.app.gameController.resetSelection) {
          this.app.gameController.resetSelection();
        } else {
          g.selectedSquare = null;
          g.validMoves = [];
          UI.renderBoard(this.app.game);
        }
      }
      return;
    }
  }

  /**
   * Emergency recovery function to unstick frozen games.
   */
  performEmergencyRecovery(): void {
    const game = this.app.game as any;
    if (!game) return;

    const previousTurn = game.turn;
    game.turn = 'white';
    game.isAnimating = false;

    const spinner = document.getElementById('spinner-overlay');
    if (spinner) spinner.style.display = 'none';

    game.selectedSquare = null;
    game.validMoves = null;

    if (game._forceFullRender !== undefined) {
      game._forceFullRender = true;
    }

    console.warn(
      `[RECOVERY] Previous turn: ${previousTurn}, isAnimating was reset, spinner hidden`
    );

    import('../ui.js').then(UI => {
      UI.renderBoard(game);
      UI.updateStatus(game);
    });
  }
}
