/**
 * Enhanced Debug Console für Schach 9x9
 * Features: Log filtering, search, export, AI debug, board state
 */

import { logger } from './logger.js';

export class DebugConsole {
  constructor(game) {
    this.game = game;
    this.isVisible = false;
    this.logs = [];
    this.maxLogs = 200;
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.initUI();
    this.initKeyboardShortcut();
    this.hookIntoLogger();
  }

  initUI() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel hidden';
    panel.innerHTML = `
      <div class="debug-header">
        <h3>🛠️ Debug Console</h3>
        <div class="debug-header-actions">
          <button class="debug-btn small" onclick="window.debugConsole.exportLogs()" title="Export Logs">📥</button>
          <button class="debug-btn small" onclick="window.debugConsole.clearLogs()" title="Clear Logs">🗑️</button>
          <button class="debug-close" onclick="window.debugConsole.toggle()">✕</button>
        </div>
      </div>
      
      <div class="debug-tabs">
        <button class="debug-tab active" data-tab="logs">Logs</button>
        <button class="debug-tab" data-tab="ai">AI</button>
        <button class="debug-tab" data-tab="state">State</button>
        <button class="debug-tab" data-tab="tools">Tools</button>
      </div>

      <div class="debug-content">
        <!-- LOGS TAB -->
        <div id="debug-tab-logs" class="debug-tab-content active">
          <div class="debug-filters">
            <input type="text" id="debug-search" placeholder="🔍 Suchen..." oninput="window.debugConsole.onSearch(this.value)">
            <div class="debug-filter-btns">
              <button class="debug-filter active" data-filter="all">Alle</button>
              <button class="debug-filter" data-filter="error">❌ Error</button>
              <button class="debug-filter" data-filter="warn">⚠️ Warn</button>
              <button class="debug-filter" data-filter="info">ℹ️ Info</button>
              <button class="debug-filter" data-filter="debug">🔧 Debug</button>
            </div>
            <div class="debug-context-filters">
              <button class="debug-filter small active" data-context="all">Alle</button>
              <button class="debug-filter small" data-context="AI">AI</button>
              <button class="debug-filter small" data-context="Game">Game</button>
              <button class="debug-filter small" data-context="UI">UI</button>
              <button class="debug-filter small" data-context="3D">3D</button>
            </div>
          </div>
          <div id="debug-logs" class="debug-logs"></div>
          <div class="debug-stats">
            <span id="debug-log-count">0 Logs</span>
            <span id="debug-filtered-count"></span>
          </div>
        </div>

        <!-- AI TAB -->
        <div id="debug-tab-ai" class="debug-tab-content">
          <div class="debug-section">
            <h4>🤖 AI Status</h4>
            <div class="debug-ai-stats">
              <div class="debug-stat-row">
                <span>Letzte Berechnung</span>
                <span id="ai-calc-time">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Nodes durchsucht</span>
                <span id="ai-nodes">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Tiefe erreicht</span>
                <span id="ai-depth">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Evaluation</span>
                <span id="ai-eval">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Persönlichkeit</span>
                <span id="ai-personality">balanced</span>
              </div>
            </div>
          </div>
          <div class="debug-section">
            <h4>📊 Transposition Table</h4>
            <div class="debug-ai-stats">
              <div class="debug-stat-row">
                <span>Einträge</span>
                <span id="tt-entries">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Hit Rate</span>
                <span id="tt-hitrate">-</span>
              </div>
            </div>
          </div>
        </div>

        <!-- STATE TAB -->
        <div id="debug-tab-state" class="debug-tab-content">
          <div class="debug-section">
            <h4>🎮 Game State</h4>
            <div class="debug-state-info">
              <div class="debug-stat-row">
                <span>Phase</span>
                <span id="state-phase">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Am Zug</span>
                <span id="state-turn">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Züge</span>
                <span id="state-moves">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Material Weiß</span>
                <span id="state-mat-white">-</span>
              </div>
              <div class="debug-stat-row">
                <span>Material Schwarz</span>
                <span id="state-mat-black">-</span>
              </div>
            </div>
            <button class="debug-btn" onclick="window.debugConsole.copyBoardFEN()">📋 Board kopieren</button>
          </div>
          <div class="debug-section">
            <h4>📋 Board Snapshot</h4>
            <pre id="board-snapshot" class="debug-code"></pre>
          </div>
        </div>

        <!-- TOOLS TAB -->
        <div id="debug-tab-tools" class="debug-tab-content">
          <div class="debug-section">
            <h4>🛒 Shop Testen</h4>
            <div class="debug-buttons">
              <button onclick="window.debugConsole.testShopPiece('p')">♟️ Bauer</button>
              <button onclick="window.debugConsole.testShopPiece('n')">♞ Springer</button>
              <button onclick="window.debugConsole.testShopPiece('b')">♝ Läufer</button>
              <button onclick="window.debugConsole.testShopPiece('r')">♜ Turm</button>
              <button onclick="window.debugConsole.testShopPiece('a')">🏰 Erzbischof</button>
              <button onclick="window.debugConsole.testShopPiece('c')">⚖️ Kanzler</button>
              <button onclick="window.debugConsole.testShopPiece('q')">♛ Dame</button>
            </div>
          </div>
          <div class="debug-section">
            <h4>💰 Punkte</h4>
            <div class="debug-buttons">
              <button onclick="window.debugConsole.setPoints(5)">5</button>
              <button onclick="window.debugConsole.setPoints(10)">10</button>
              <button onclick="window.debugConsole.setPoints(15)">15</button>
              <button onclick="window.debugConsole.setPoints(50)">50</button>
            </div>
          </div>
          <div class="debug-section">
            <h4>🔄 Spielzustand</h4>
            <div class="debug-buttons">
              <button onclick="window.debugConsole.resetBoard()">🔄 Reload</button>
              <button onclick="window.debugConsole.forceAIMove()">🤖 AI Zug</button>
              <button onclick="window.debugConsole.toggleAnalysis()">🔍 Analyse</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Setup tab switching
    panel.querySelectorAll('.debug-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Setup filter buttons
    panel.querySelectorAll('.debug-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.filter) {
          this.setFilter(btn.dataset.filter);
        } else if (btn.dataset.context) {
          this.setContextFilter(btn.dataset.context);
        }
      });
    });

    this.setupErrorLogging();
  }

  initKeyboardShortcut() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  hookIntoLogger() {
    // Hook into the logger to capture all logs
    const originalLog = logger._log.bind(logger);
    logger._log = (level, levelName, args) => {
      originalLog(level, levelName, args);
      this.addLog(levelName.toLowerCase(), args.join(' '));
    };
  }

  toggle() {
    this.isVisible = !this.isVisible;
    const panel = document.getElementById('debug-panel');
    if (panel) {
      panel.classList.toggle('hidden', !this.isVisible);
      if (this.isVisible) {
        this.updateStateTab();
      }
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.debug-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.debug-tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.debug-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`debug-tab-${tabName}`)?.classList.add('active');

    if (tabName === 'state') this.updateStateTab();
    if (tabName === 'ai') this.updateAITab();
  }

  addLog(level, message, _context = '') {
    const timestamp = new Date();
    const log = {
      id: Date.now(),
      timestamp,
      level,
      message,
      context: this.extractContext(message),
    };

    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.renderLogs();
  }

  extractContext(message) {
    const match = message.match(/\[(\w+)\]/);
    return match ? match[1] : '';
  }

  renderLogs() {
    const container = document.getElementById('debug-logs');
    if (!container) return;

    let filtered = this.logs;

    // Filter by level
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(log => log.level === this.activeFilter);
    }

    // Filter by context
    if (this.contextFilter && this.contextFilter !== 'all') {
      filtered = filtered.filter(log => log.context === this.contextFilter);
    }

    // Filter by search
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(log => log.message.toLowerCase().includes(query));
    }

    container.innerHTML = filtered
      .slice(-100)
      .map(log => {
        const time = this.formatTime(log.timestamp);
        return `<div class="debug-log-entry debug-log-${log.level}">
        <span class="log-time">${time}</span>
        <span class="log-level">${this.getLevelIcon(log.level)}</span>
        <span class="log-msg">${this.escapeHtml(log.message)}</span>
      </div>`;
      })
      .join('');

    container.scrollTop = container.scrollHeight;

    // Update stats
    document.getElementById('debug-log-count').textContent = `${this.logs.length} Logs`;
    document.getElementById('debug-filtered-count').textContent =
      filtered.length !== this.logs.length ? `(${filtered.length} angezeigt)` : '';
  }

  formatTime(date) {
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return date.toLocaleTimeString();
  }

  getLevelIcon(level) {
    const icons = { error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🔧' };
    return icons[level] || '•';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setFilter(filter) {
    this.activeFilter = filter;
    document.querySelectorAll('.debug-filter[data-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderLogs();
  }

  setContextFilter(context) {
    this.contextFilter = context;
    document.querySelectorAll('.debug-filter[data-context]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.context === context);
    });
    this.renderLogs();
  }

  onSearch(query) {
    this.searchQuery = query;
    this.renderLogs();
  }

  clearLogs() {
    this.logs = [];
    this.renderLogs();
    this.log('🗑️ Logs gelöscht', 'info');
  }

  exportLogs() {
    const data = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schach9x9-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.log('📥 Logs exportiert', 'info');
  }

  updateStateTab() {
    if (!this.game) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('state-phase', this.game.phase || '-');
    set('state-turn', this.game.turn || '-');
    set('state-moves', this.game.moveHistory?.length || 0);

    // Calculate material
    let matWhite = 0,
      matBlack = 0;
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, a: 7, c: 8, e: 10, k: 0 };
    if (this.game.board) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const piece = this.game.board[r][c];
          if (piece) {
            const val = values[piece.type] || 0;
            if (piece.color === 'white') matWhite += val;
            else matBlack += val;
          }
        }
      }
    }
    set('state-mat-white', matWhite);
    set('state-mat-black', matBlack);

    // Board snapshot
    const snapshot = document.getElementById('board-snapshot');
    if (snapshot && this.game.board) {
      snapshot.textContent = this.boardToString();
    }
  }

  updateAITab() {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('ai-personality', this.game?.aiPersonality || 'balanced');

    // Get AI stats from last calculation if available
    if (window.lastAIStats) {
      set('ai-calc-time', `${window.lastAIStats.time}ms`);
      set('ai-nodes', window.lastAIStats.nodes?.toLocaleString() || '-');
      set('ai-depth', window.lastAIStats.depth || '-');
      set('ai-eval', window.lastAIStats.eval || '-');
    }
  }

  boardToString() {
    if (!this.game?.board) return 'Kein Board';
    const symbols = {
      p: '♟',
      r: '♜',
      n: '♞',
      b: '♝',
      q: '♛',
      k: '♚',
      a: 'A',
      c: 'C',
      e: 'E',
    };
    let result = '   a b c d e f g h i\n';
    for (let r = 0; r < 9; r++) {
      result += `${9 - r}  `;
      for (let c = 0; c < 9; c++) {
        const piece = this.game.board[r][c];
        if (piece) {
          const sym = symbols[piece.type] || piece.type;
          result += (piece.color === 'white' ? sym.toUpperCase() : sym.toLowerCase()) + ' ';
        } else {
          result += '. ';
        }
      }
      result += '\n';
    }
    return result;
  }

  copyBoardFEN() {
    const text = this.boardToString();
    navigator.clipboard.writeText(text).then(() => {
      this.log('📋 Board in Zwischenablage kopiert', 'info');
    });
  }

  // Tool functions
  log(message, type = 'info') {
    this.addLog(type, message);
  }

  testShopPiece(pieceType) {
    this.log(`Testing: ${pieceType}`, 'debug');
    if (this.game?.selectShopPiece) {
      try {
        this.game.selectShopPiece(pieceType);
        this.log(`✓ Selected: ${pieceType}`, 'info');
      } catch (error) {
        this.log(`✗ Error: ${error.message}`, 'error');
      }
    }
  }

  setPoints(amount) {
    if (this.game) {
      this.game.points = amount;
      this.log(`✓ Punkte: ${amount}`, 'info');
      this.game.gameController?.updateShopUI?.();
    }
  }

  resetBoard() {
    this.log('🔄 Reload...', 'info');
    location.reload();
  }

  forceAIMove() {
    if (this.game?.aiController?.triggerAIMove) {
      this.game.aiController.triggerAIMove();
      this.log('🤖 AI Zug getriggert', 'info');
    }
  }

  toggleAnalysis() {
    if (this.game?.gameController?.toggleAnalysisMode) {
      this.game.gameController.toggleAnalysisMode();
      this.log('🔍 Analyse-Modus toggled', 'info');
    }
  }

  setupErrorLogging() {
    const originalError = console.error;
    console.error = (...args) => {
      this.addLog('error', args.join(' '));
      originalError.apply(console, args);
    };

    window.addEventListener('error', e => {
      this.addLog('error', `${e.message} @ ${e.filename}:${e.lineno}`);
    });
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (window.game) {
        window.debugConsole = new DebugConsole(window.game);
        console.log('🛠️ Enhanced Debug Console ready. Press Ctrl+D to toggle.');
      }
    }, 500);
  });
}
