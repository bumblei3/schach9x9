/**
 * Enhanced Debug Console für Schach 9x9
 * Features: Log filtering, search, export, AI debug, board state
 */

import { logger } from './logger.js';
import { campaignManager } from './campaign/CampaignManager.js';
import { Game } from './gameEngine.js';

interface DebugLogEntry {
  id: number;
  timestamp: Date;
  level: string;
  message: string;
  context: string;
}

// Extend Game with dynamic properties set at runtime by controllers
// that are not in the static type definition
interface DebugGame extends Game {
  selectShopPiece?: (pieceType: string) => void;
  gameController?: Game['gameController'] & {
    toggleAnalysisMode?: () => void;
  };
  aiController?: Game['aiController'] & {
    triggerAIMove?: () => void;
  };
}

declare global {
  interface Window {
    lastAIStats?: {
      time: number;
      nodes?: number;
      depth?: number;
      eval?: string;
    };
  }
}

export class DebugConsole {
  public game: DebugGame;
  public isVisible: boolean;
  public logs: DebugLogEntry[];
  public maxLogs: number;
  public activeFilter: string;
  public searchQuery: string;
  public contextFilter: string | null = null;

  constructor(game: DebugGame) {
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

  public initUI(): void {
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
          <div class="debug-section">
            <h4>🏆 Kampagne</h4>
            <div class="debug-buttons">
              <button onclick="window.debugConsole.unlockAllLevels()">🔓 Alle freischalten</button>
              <button onclick="window.debugConsole.completeCurrentLevel()">✅ Level beenden</button>
              <button onclick="window.debugConsole.resetCampaign()">❌ Reset</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Setup tab switching
    panel.querySelectorAll('.debug-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab((tab as HTMLElement).dataset.tab || ''));
    });

    // Setup filter buttons
    panel.querySelectorAll('.debug-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const button = btn as HTMLElement;
        if (button.dataset.filter) {
          this.setFilter(button.dataset.filter);
        } else if (button.dataset.context) {
          this.setContextFilter(button.dataset.context);
        }
      });
    });

    this.setupErrorLogging();

    // Create visible floating toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '🛠️';
    toggleBtn.title = 'Open Debug Console';
    toggleBtn.style.position = 'fixed';
    toggleBtn.style.bottom = '10px';
    toggleBtn.style.right = '10px';
    toggleBtn.style.zIndex = '10000';
    toggleBtn.style.fontSize = '24px';
    toggleBtn.style.padding = '8px 12px';
    toggleBtn.style.borderRadius = '50%';
    toggleBtn.style.border = '2px solid rgba(99, 102, 241, 0.5)';
    toggleBtn.style.background = 'rgba(15, 23, 42, 0.9)';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    toggleBtn.style.transition = 'transform 0.2s';

    toggleBtn.onmouseover = () => (toggleBtn.style.transform = 'scale(1.1)');
    toggleBtn.onmouseout = () => (toggleBtn.style.transform = 'scale(1)');

    toggleBtn.onclick = () => this.toggle();
    document.body.appendChild(toggleBtn);
  }

  public initKeyboardShortcut(): void {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  public hookIntoLogger(): void {
    // Hook into the logger to capture all logs
    // _log is private; cast via unknown to access it
    type LogFn = (level: number, levelName: string, args: unknown[]) => void;
    const logProxy = logger as unknown as { _log: LogFn };
    const originalLog: LogFn = logProxy._log.bind(logger) as LogFn;
    logProxy._log = (level: number, levelName: string, args: unknown[]): void => {
      originalLog(level, levelName, args);
      this.addLog(levelName.toLowerCase(), (args as string[]).join(' '));
    };
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    const panel = document.getElementById('debug-panel');
    if (panel) {
      panel.classList.toggle('hidden', !this.isVisible);
      if (this.isVisible) {
        this.updateStateTab();
      }
    }
  }

  public switchTab(tabName: string): void {
    document.querySelectorAll('.debug-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.debug-tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.debug-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`debug-tab-${tabName}`)?.classList.add('active');

    if (tabName === 'state') this.updateStateTab();
    if (tabName === 'ai') this.updateAITab();
  }

  public addLog(level: string, message: string, _context: string = ''): void {
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

  public extractContext(message: string): string {
    const match = message.match(/\[(\w+)\]/);
    return match ? match[1] : '';
  }

  public renderLogs(): void {
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
    const countEl = document.getElementById('debug-log-count');
    const filteredEl = document.getElementById('debug-filtered-count');
    if (countEl) countEl.textContent = `${this.logs.length} Logs`;
    if (filteredEl)
      filteredEl.textContent =
        filtered.length !== this.logs.length ? `(${filtered.length} angezeigt)` : '';
  }

  public formatTime(date: Date): string {
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return date.toLocaleTimeString();
  }

  public getLevelIcon(level: string): string {
    const icons: Record<string, string> = { error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🔧' };
    return icons[level] || '•';
  }

  public escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public setFilter(filter: string): void {
    this.activeFilter = filter;
    document.querySelectorAll('.debug-filter[data-filter]').forEach(btn => {
      const button = btn as HTMLElement;
      btn.classList.toggle('active', button.dataset.filter === filter);
    });
    this.renderLogs();
  }

  public setContextFilter(context: string): void {
    this.contextFilter = context;
    document.querySelectorAll('.debug-filter[data-context]').forEach(btn => {
      const button = btn as HTMLElement;
      btn.classList.toggle('active', button.dataset.context === context);
    });
    this.renderLogs();
  }

  public onSearch(query: string): void {
    this.searchQuery = query;
    this.renderLogs();
  }

  public clearLogs(): void {
    this.logs = [];
    this.renderLogs();
    this.log('🗑️ Logs gelöscht', 'info');
  }

  public exportLogs(): void {
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

  public updateStateTab(): void {
    if (!this.game) return;

    const set = (id: string, val: string | number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    set('state-phase', this.game.phase || '-');
    set('state-turn', this.game.turn || '-');
    set('state-moves', this.game.moveHistory?.length || 0);

    // Calculate material
    let matWhite = 0,
      matBlack = 0;
    const values: Record<string, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      a: 7,
      c: 8,
      e: 10,
      k: 0,
    };
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

  public updateAITab(): void {
    const set = (id: string, val: string | number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    set('ai-personality', this.game?.aiPersonality || 'balanced');

    // Get AI stats from last calculation if available
    if (window.lastAIStats) {
      const stats = window.lastAIStats;
      set('ai-calc-time', `${stats.time}ms`);
      set('ai-nodes', stats.nodes?.toLocaleString() || '-');
      set('ai-depth', stats.depth || '-');
      set('ai-eval', stats.eval || '-');
    }
  }

  public boardToString(): string {
    if (!this.game?.board) return 'Kein Board';
    const symbols: Record<string, string> = {
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

  public copyBoardFEN(): void {
    const text = this.boardToString();
    navigator.clipboard.writeText(text).then(() => {
      this.log('📋 Board in Zwischenablage kopiert', 'info');
    });
  }

  // Tool functions
  public log(message: string, type: string = 'info'): void {
    this.addLog(type, message);
  }

  public testShopPiece(pieceType: string): void {
    this.log(`Testing: ${pieceType}`, 'debug');
    if (this.game?.selectShopPiece) {
      try {
        this.game.selectShopPiece(pieceType);
        this.log(`✓ Selected: ${pieceType}`, 'info');
      } catch (error: unknown) {
        this.log(`✗ Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  }

  public setPoints(amount: number): void {
    if (this.game) {
      this.game.points = amount;
      this.log(`✓ Punkte: ${amount}`, 'info');
      this.game.gameController?.updateShopUI?.();
    }
  }

  public resetBoard(): void {
    this.log('🔄 Reload...', 'info');
    location.reload();
  }

  public forceAIMove(): void {
    if (this.game?.aiController?.triggerAIMove) {
      this.game.aiController.triggerAIMove();
      this.log('🤖 AI Zug getriggert', 'info');
    }
  }

  public toggleAnalysis(): void {
    if (this.game?.gameController?.toggleAnalysisMode) {
      this.game.gameController.toggleAnalysisMode();
      this.log('🔍 Analyse-Modus toggled', 'info');
    }
  }

  public unlockAllLevels(): void {
    campaignManager.unlockAll();
    this.log('🔓 Alle Kampagnen-Level freigeschaltet! Reloading...', 'success');
    setTimeout(() => location.reload(), 1000);
  }

  public completeCurrentLevel(): void {
    const currentId = campaignManager.getCurrentLevelId();
    if (currentId) {
      campaignManager.completeLevel(currentId);
      this.log(`✅ Level ${currentId} als abgeschlossen markiert.`, 'success');
    } else {
      this.log('⚠️ Kein aktives Level gefunden.', 'warn');
    }
  }

  public resetCampaign(): void {
    campaignManager.resetState();
    this.log('❌ Kampagnen-Fortschritt zurückgesetzt.', 'info');
  }

  public setupErrorLogging(): void {
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

// Auto-initialize with retry
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const tryInit = () => {
      const win = window as unknown as Record<string, unknown>;
      if (win['game']) {
        if (!win['debugConsole']) {
          win['debugConsole'] = new DebugConsole(win['game'] as DebugGame);
          console.log(
            '🛠️ Enhanced Debug Console ready. Press Ctrl+D or click the floating button.'
          );
        }
      } else {
        setTimeout(tryInit, 500); // Retry if game not yet ready
      }
    };
    tryInit();
  });
}
