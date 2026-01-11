/**
 * Engine Analysis UI Component
 */
import * as PostGameAnalyzer from '../tutor/PostGameAnalyzer.js';
import type { Game } from '../gameEngine.js';

export class AnalysisUI {
  private app: any;
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
  isAnalyzing: boolean = false;

  constructor(app: any) {
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
  }

  get game(): Game {
    return this.app.game;
  }

  update(analysis: any): void {
    const { score, topMoves, depth, nodes } = analysis;

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

  updatePanel(score: number, topMoves: any[], depth: number, nodes: number): void {
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
    import('../ui.js').then(UI => {
      (UI as any).showModal(
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
    });
  }

  async startFullAnalysis(): Promise<void> {
    if (!this.game || !this.game.moveHistory || this.game.moveHistory.length === 0) {
      this.isAnalyzing = false;
      return;
    }

    const UI = await import('../ui.js');
    const { analyzeGame, classifyMove } = PostGameAnalyzer;

    this.isAnalyzing = true;
    (UI as any).showModal('Ganganalyse', 'Die KI analysiert die Stellungen...', [], false);

    const states = this.collectBoardStates();
    const results: any[] = [];
    const worker = (this.game as any).aiController.aiWorkers[0];

    for (let i = 0; i < states.length; i++) {
      const boardArr = states[i];
      const turn = i % 2 === 0 ? 'white' : 'black';

      // Update progress modal
      (UI as any).showModal(
        'Ganganalyse',
        `Analysiere Stellung ${i + 1} von ${states.length}...`,
        [],
        false
      );

      const analysis = await new Promise(resolve => {
        const handler = (e: any) => {
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

        const bestEval =
          prevResult.topMoves && prevResult.topMoves[0]
            ? prevResult.topMoves[0].score
            : prevResult.score;

        const prevEvalMover = turn === 'black' ? prevResult.score : -prevResult.score;
        const currentEvalMover = turn === 'black' ? -currentResult.score : currentResult.score;
        const bestEvalMover = turn === 'black' ? bestEval : -bestEval;

        (move as any).classification = (classifyMove as any)(
          prevEvalMover,
          currentEvalMover,
          bestEvalMover
        );
        (move as any).evalScore = currentResult.score;
      }
    }

    this.isAnalyzing = false;
    (UI as any).closeModal();

    const whiteStats = (analyzeGame as any)(this.game.moveHistory, 'white');
    const blackStats = (analyzeGame as any)(this.game.moveHistory, 'black');

    (UI as any).updateMoveHistoryUI(this.game);
    (UI as any).renderEvalGraph(this.game);

    this.showSummaryModal(whiteStats, blackStats);
  }

  collectBoardStates(): any[] {
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

  undoMoveOnBoard(board: any[][], move: any): void {
    const { from, to, piece, captured, specialMove } = move;

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
        const rook = board[rookTo.r][rookTo.c];
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

  showSummaryModal(white: any, black: any): void {
    import('../ui.js').then(UI => {
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

      (UI as any).showModal('Analyse abgeschlossen', content, [
        { text: 'Schließen', class: 'btn-secondary' },
        {
          text: 'Partie durchsehen',
          class: 'btn-primary',
          callback: () => {
            if ((this.game as any).gameController && (this.game as any).gameController.jumpToMove) {
              (this.game as any).gameController.jumpToMove(0);
            }
          },
        },
      ]);
    });
  }

  renderStatCounts(counts: any): string {
    const { QUALITY_METADATA } = PostGameAnalyzer as any;
    return Object.entries(counts)
      .filter(([_, count]: [any, any]) => count > 0)
      .map(
        ([quality, count]) => `
        <div class="stat-row">
          <span class="stat-label" style="color: ${QUALITY_METADATA[quality].color}">${QUALITY_METADATA[quality].label}</span>
          <span class="stat-count">${count}</span>
        </div>
      `
      )
      .join('');
  }
}
