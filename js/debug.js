/**
 * Debug-Konsole für einfaches Testen
 */

export class DebugConsole {
  constructor(game) {
    this.game = game;
    this.isVisible = false;
    this.initUI();
    this.initKeyboardShortcut();
  }

  initUI() {
    // Create debug panel HTML
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel hidden';
    panel.innerHTML = `
            <div class="debug-header">
                <h3>🛠️ Debug Console</h3>
                <button class="debug-close" onclick="window.debugConsole.toggle()">✕</button>
            </div>
            <div class="debug-content">
                <div class="debug-section">
                    <h4>Shop Testen</h4>
                    <div class="debug-buttons">
                        <button onclick="window.debugConsole.testShopPiece('p')">Bauer</button>
                        <button onclick="window.debugConsole.testShopPiece('n')">Springer</button>
                        <button onclick="window.debugConsole.testShopPiece('b')">Läufer</button>
                        <button onclick="window.debugConsole.testShopPiece('r')">Turm</button>
                        <button onclick="window.debugConsole.testShopPiece('a')">Erzbischof</button>
                        <button onclick="window.debugConsole.testShopPiece('c')">Kanzler</button>
                        <button onclick="window.debugConsole.testShopPiece('q')">Dame</button>
                    </div>
                </div>

                <div class="debug-section">
                    <h4>Punkte</h4>
                    <div class="debug-buttons">
                        <button onclick="window.debugConsole.setPoints(5)">5 Punkte</button>
                        <button onclick="window.debugConsole.setPoints(10)">10 Punkte</button>
                        <button onclick="window.debugConsole.setPoints(15)">15 Punkte</button>
                        <button onclick="window.debugConsole.setPoints(50)">50 Punkte</button>
                    </div>
                </div>

                <div class="debug-section">
                    <h4>Spielzustand</h4>
                    <div class="debug-buttons">
                        <button onclick="window.debugConsole.resetBoard()">Board Reset</button>
                        <button onclick="window.debugConsole.skipToPlay()">Skip to Play</button>
                        <button onclick="window.debugConsole.toggleShop()">Shop Toggle</button>
                    </div>
                </div>

                <div class="debug-section">
                    <h4>Logs</h4>
                    <div id="debug-logs" class="debug-logs"></div>
                    <button onclick="window.debugConsole.clearLogs()">Logs löschen</button>
                </div>
            </div>
        `;
    document.body.appendChild(panel);

    // Intercept console.error for debugging
    this.setupErrorLogging();
  }

  initKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+D to toggle debug console
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    this.isVisible = !this.isVisible;
    const panel = document.getElementById('debug-panel');
    if (panel) {
      panel.classList.toggle('hidden', !this.isVisible);
    }
  }

  testShopPiece(pieceType) {
    console.log(`Testing shop piece: ${pieceType}`);
    this.log(`Testing: ${pieceType}`);

    if (this.game && this.game.selectShopPiece) {
      try {
        this.game.selectShopPiece(pieceType);
        this.log(`✓ Selected: ${pieceType}`, 'success');
      } catch (error) {
        this.log(`✗ Error: ${error.message}`, 'error');
        console.error(error);
      }
    } else {
      this.log('✗ Game or selectShopPiece not available', 'error');
    }
  }

  setPoints(amount) {
    if (this.game) {
      this.game.points = amount;
      this.log(`✓ Points set to: ${amount}`, 'success');

      // Update UI
      if (this.game.gameController && this.game.gameController.updateShopUI) {
        this.game.gameController.updateShopUI();
      }
    }
  }

  resetBoard() {
    if (this.game) {
      this.log('Resetting board...', 'info');
      location.reload();
    }
  }

  skipToPlay() {
    this.log('Skip to play not yet implemented', 'warning');
  }

  toggleShop() {
    const shopEl = document.getElementById('shop');
    if (shopEl) {
      shopEl.classList.toggle('hidden');
      this.log('✓ Shop toggled', 'success');
    }
  }

  log(message, type = 'info') {
    const logsContainer = document.getElementById('debug-logs');
    if (!logsContainer) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log-entry debug-log-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Keep only last 50 logs
    while (logsContainer.children.length > 50) {
      logsContainer.removeChild(logsContainer.firstChild);
    }
  }

  clearLogs() {
    const logsContainer = document.getElementById('debug-logs');
    if (logsContainer) {
      logsContainer.innerHTML = '';
      this.log('Logs cleared', 'info');
    }
  }

  setupErrorLogging() {
    const originalError = console.error;
    console.error = (...args) => {
      this.log(`ERROR: ${args.join(' ')}`, 'error');
      originalError.apply(console, args);
    };
  }
}

// Auto-initialize when in development
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Wait for game to be initialized
    setTimeout(() => {
      if (window.game) {
        window.debugConsole = new DebugConsole(window.game);
        console.log('🛠️ Debug Console initialized. Press Ctrl+D to toggle.');
      }
    }, 500);
  });
}
