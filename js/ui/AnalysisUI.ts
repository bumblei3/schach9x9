/**
 * Engine Analysis UI Component
 */
import { showModal, closeModal, updateMoveHistoryUI, renderEvalGraph } from '../ui.js';
import * as PostGameAnalyzer from '../tutor/PostGameAnalyzer.js';
import type { Game } from '../gameEngine.js';
import type { AIProgressData } from '../aiEngine';

interface AnalysisResult {
  score?: number;
  topMoves?: Array<{
    move: { from: { r: number; c: number }; to: { r: number; c: number } };
    score: number;
    notation?: string;
  }>;
  depth?: number;
  nodes?: number;
}

interface PlayerStats {
  accuracy: number;
  counts: Record<string, number>;
}

interface AppWithGame {
  game: Partial<Game> & { moveHistory: unknown[]; playerColor: 'white' | 'black'; gameController?: any };
}

export class AnalysisUI {
  private app: AppWithGame;
  bar: HTMLElement | null;
  fill: HTMLElement | null;
  text: HTMLElement | null;
  marker: HTMLElement | null;
  panel: HTMLElement | null;
  panelScore: HTMLElement | null;
  topMovesContainer: HTMLElement | null;
  panelBarValue: HTMLElement | null;
  evalScoreValue: HTMLElement | null;
  engineInfo: HTMLElement | null;
  // Live search elements
  liveDepth: HTMLElement | null;
  liveNodes: HTMLElement | null;
  liveScore: HTMLElement | null;
  liveTime: HTMLElement | null;
  livePV: HTMLElement | null;
  isAnalyzing: boolean = false;

  constructor(app: AppWithGame) {
    this.app = app;
    this.bar = document.getElementById('evaluation-bar');
    this.fill = document.getElementById('eval-fill');
    this.text = document.getElementById('eval-text');
    this.marker = document.getElementById('eval-marker');

    this.panel = document.getElementById('analysis-panel');
    this.panelScore = document.getElementById('analysis-score-value');
    this.topMovesContainer = document.getElementById('top-moves-content');
    this.panelBarValue = document.getElementById('eval-bar');
    this.evalScoreValue = document.getElementById('eval-score');

    this.engineInfo = document.getElementById('analysis-engine-info');
    // Live search elements
    this.liveDepth = document.getElementById('live-depth');
    this.liveNodes = document.getElementById('live-nodes');
    this.liveScore = document.getElementById('live-score');
    this.liveTime = document.getElementById('live-time');
    this.livePV = document.getElementById('live-pv');
  }

  get game(): Game {
    return this.app.game as Game;
  }

  update(analysis: AnalysisResult): void {
    const { score = 0, topMoves = [], depth = 0, nodes = 0 } = analysis;

    this.updateBar(score);
    this.updatePanel(score, topMoves, depth, nodes);
  }

  updateBar(score: number): void {
    if (!this.bar || !this.fill) return;

    // Convert score (centi-pawns) to percentage
    const clampedScore = Math.max(-1000, Math.min(1000, score));
    const percentage = 50 + clampedScore / 20;

    this.fill.style.height = `${percentage}%`;

    const displayScore = (score / 100).toFixed(1);
    const prefix = score > 0 ? '+' : '';
    if (this.text) this.text.textContent = prefix + displayScore;

    this.bar.classList.remove('hidden');
  }

  updatePanel(
    score: number,
    topMoves: AnalysisResult['topMoves'],
    depth: number,
    nodes: number
  ): void {
    if (!this.panel || this.panel.classList.contains('hidden')) return;

    // Update panel score
    const displayScore = (score / 100).toFixed(2);
    const prefix = score > 0 ? '+' : '';
    if (this.evalScoreValue) {
      this.evalScoreValue.textContent = prefix + displayScore;
    }

    // Update panel mini bar
    if (this.panelBarValue) {
      const percentage = Math.max(0, Math.min(100, 50 + score / 20));
      this.panelBarValue.style.width = `${percentage}%`;
    }

    // Update Top Moves
    if (this.topMovesContainer && topMoves) {
      this.topMovesContainer.innerHTML = topMoves
        .map(
          m => `
        <div class="top-move-item" data-from="${m.move.from.r},${m.move.from.c}" data-to="${m.move.to.r},${m.move.to.c}">
          <span class="move-notation">${m.notation || '??'}</span>
          <span class="move-eval">${(m.score / 100).toFixed(1)}</span>
        </div>
      `
        )
        .join('');

      this.topMovesContainer.querySelectorAll('.top-move-item').forEach(item => {
        item.addEventListener('click', () => {
          console.log('Top move clicked:', (item as HTMLElement).dataset);
        });
      });
    }

    // Update engine info
    if (this.engineInfo) {
      this.engineInfo.textContent = `Tiefe: ${depth || '-'} | Knoten: ${nodes || '-'}`;
    }
    }

    // Live progress update during search
    updateLiveProgress(progress: AIProgressData): void {
    if (!this.isAnalyzing) return;
  
    if (this.liveDepth) {
      this.liveDepth.textContent = progress.depth?.toString() || '-';
    }
    if (this.liveNodes) {
      this.liveNodes.textContent = progress.nodes ? progress.nodes.toLocaleString() : '-';
    }
    if (this.liveScore) {
      const score = progress.score !== undefined ? (progress.score / 100).toFixed(2) : '-';
      const prefix = progress.score !== undefined && progress.score > 0 ? '+' : '';
      this.liveScore.textContent = `${prefix}${score}`;
    }
    if (this.liveTime) {
      const secs = progress.time ? (progress.time / 1000).toFixed(1) : '-';
      this.liveTime.textContent = `${secs}s`;
    }
    if (this.livePV) {
      this.livePV.textContent = progress.pv || '-';
    }
  
    // Also update the engine info with live data
    if (this.engineInfo && progress.depth !== undefined) {
      const secs = progress.time ? (progress.time / 1000).toFixed(1) : '-';
      const nodesStr = progress.nodes?.toLocaleString() || '-';
      this.engineInfo.textContent = 'Tiefe: ' + progress.depth + ' | Knoten: ' + nodesStr + ' | ' + secs + 's';
    }
    }

    // Update engine info with live data (compat method)
    updateAnalysisStats(data: { depth?: number; maxDepth?: number; nodes?: number; score?: number; time?: number }): void {
    if (this.liveDepth) this.liveDepth.textContent = data.depth?.toString() || '-';
    if (this.liveNodes) this.liveNodes.textContent = data.nodes?.toLocaleString() || '-';
    if (this.liveTime && data.time) this.liveTime.textContent = `${(data.time / 1000).toFixed(1)}s`;
    if (this.liveScore && data.score !== undefined) {
      const prefix = data.score > 0 ? '+' : '';
      this.liveScore.textContent = `${prefix}${(data.score / 100).toFixed(2)}`;
    }
    if (this.engineInfo) {
      const secs = (data.time ?? 0) / 1000;
      this.engineInfo.textContent = 'Tiefe: ' + (data.depth ?? '-') + ' | Knoten: ' + (data.nodes?.toLocaleString() ?? '-') + ' | ' + secs.toFixed(1) + 's';
    }
    }

  togglePanel(): boolean {
    if (!this.panel) return false;
    const isHidden = this.panel.classList.contains('hidden');
    if (isHidden) {
      this.panel.classList.remove('hidden');
    } else {
      this.panel.classList.add('hidden');
    }
    return !isHidden;
  }

  showAnalysisPrompt(): void {
    showModal(
      'Partie analysieren?',
      'Möchtest du die gesamte Partie von der KI analysieren lassen? Dies zeigt dir deine Genauigkeit und Fehler an.',
      [
        { text: 'Abbrechen', class: 'btn-secondary' },
        {
          text: 'Analysieren',
          class: 'btn-primary',
          callback: () => this.startFullAnalysis(),
        },
      ]
    );
  }

  async startFullAnalysis(): Promise<void> {
    if (!this.game || !this.game.moveHistory || this.game.moveHistory.length === 0) {
      this.isAnalyzing = false;
      return;
    }

    const { analyzeGame, classifyMove } = PostGameAnalyzer;

    this.isAnalyzing = true;
    showModal('Ganganalyse', 'Die KI analysiert die Stellungen...', []);

    const states = this.collectBoardStates();
    const results: AnalysisResult[] = [];
    const worker = this.game.aiController?.aiWorkers?.[0];
    if (!worker) return;

    for (let i = 0; i < states.length; i++) {
      const boardArr = states[i];
      const turn = i % 2 === 0 ? 'white' : 'black';

      // Update progress modal
      showModal('Ganganalyse', `Analysiere Stellung ${i + 1} von ${states.length}...`, []);

      const analysis: AnalysisResult = await new Promise(resolve => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'analysis') {
            worker.removeEventListener('message', handler);
            resolve(e.data.data);
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({
          data: {
            board: boardArr,
            color: turn,
            depth: 4,
            moveNumber: i,
            isAnalysis: true,
          },
        });
      });

      results.push(analysis);

      // Classify move if we have a previous result
      if (i > 0) {
        const move = this.game.moveHistory[i - 1];
        const prevResult = results[i - 1];
        const currentResult = results[i];

        const prevScore = prevResult.score ?? 0;
        const currentScore = currentResult.score ?? 0;

        const bestEval =
          prevResult.topMoves && prevResult.topMoves[0]
            ? (prevResult.topMoves[0].score ?? 0)
            : prevScore;

        const prevEvalMover = turn === 'black' ? prevScore : -prevScore;
        const currentEvalMover = turn === 'black' ? -currentScore : currentScore;
        const bestEvalMover = turn === 'black' ? bestEval : -bestEval;

        move.classification = classifyMove(prevEvalMover, currentEvalMover, bestEvalMover);
        move.evalScore = currentResult.score;
      }
    }

    this.isAnalyzing = false;
    closeModal();

    const whiteStats = analyzeGame(this.game.moveHistory, 'white');
    const blackStats = analyzeGame(this.game.moveHistory, 'black');

    updateMoveHistoryUI(this.game);
    renderEvalGraph(this.game);

    this.showSummaryModal(whiteStats, blackStats);
  }

  collectBoardStates(): unknown[][] {
    const states = [];
    const tempBoard = JSON.parse(JSON.stringify(this.game.board));
    states.unshift(JSON.parse(JSON.stringify(tempBoard)));

    for (let i = this.game.moveHistory.length - 1; i >= 0; i--) {
      const move = this.game.moveHistory[i];
      this.undoMoveOnBoard(tempBoard, move);
      states.unshift(JSON.parse(JSON.stringify(tempBoard)));
    }
    return states;
  }

  undoMoveOnBoard(board: unknown[][], move: unknown): void {
     
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = move as any;
    const { from, to, piece, captured, specialMove } = m;

    // Move piece back
    board[from.r][from.c] = {
      type: piece.type,
      hasMoved: piece.hasMoved || false,
      ...piece,
    };

    // Handle special moves
    if (specialMove) {
      if (specialMove.type === 'castling') {
        const { rookFrom, rookTo } = specialMove;
        const rook = board[rookTo.r][rookTo.c] as Record<string, unknown> | null;
        if (rook) {
          rook.hasMoved = specialMove.rookHadMoved || false;
        }
        board[rookFrom.r][rookFrom.c] = rook;
        board[rookTo.r][rookTo.c] = null;
        if (to.r !== rookTo.r || to.c !== rookTo.c) {
          board[to.r][to.c] = null;
        }
      } else if (specialMove.type === 'enPassant') {
        const { capturedPawnPos, capturedPawn } = specialMove;
        board[capturedPawnPos.r][capturedPawnPos.c] = {
          type: 'p',
          hasMoved: true,
          ...capturedPawn,
        };
        board[to.r][to.c] = null;
      }
    } else {
      board[to.r][to.c] = captured
        ? {
            type: captured.type || 'p',
            hasMoved: true,
            ...captured,
          }
        : null;
    }
  }

  showSummaryModal(white: PlayerStats, black: PlayerStats): void {
    const getAccuracyClass = (acc: number) =>
      acc >= 85 ? 'accuracy-high' : acc >= 60 ? 'accuracy-mid' : 'accuracy-low';

    const content = `
        <div class="analysis-summary">
          <div class="player-stats">
            <h3>Weiß</h3>
            <div class="accuracy ${getAccuracyClass(white.accuracy)}">${white.accuracy}%</div>
            ${this.renderStatCounts(white.counts)}
          </div>
          <div class="player-stats">
            <h3>Schwarz</h3>
            <div class="accuracy ${getAccuracyClass(black.accuracy)}">${black.accuracy}%</div>
            ${this.renderStatCounts(black.counts)}
          </div>
        </div>
      `;

    showModal('Analyse abgeschlossen', content, [
      { text: 'Schließen', class: 'btn-secondary' },
      {
        text: 'Partie durchsehen',
        class: 'btn-primary',
        callback: () => {
          if (this.game.gameController && this.game.gameController.jumpToMove) {
            this.game.gameController.jumpToMove(0);
          }
        },
      },
    ]);
  }

  renderStatCounts(counts: Record<string, number>): string {
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(
        ([quality, count]) => `
        <div class="stat-row">
          <span class="stat-label" style="color: ${PostGameAnalyzer.QUALITY_METADATA[quality as PostGameAnalyzer.MoveQuality].color}">${PostGameAnalyzer.QUALITY_METADATA[quality as PostGameAnalyzer.MoveQuality].label}</span>
          <span class="stat-count">${count}</span>
        </div>
      `
      )
      .join('');
  }
}

