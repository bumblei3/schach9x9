/**
 * Engine Analysis UI Component
 */
import * as PostGameAnalyzer from '../tutor/PostGameAnalyzer.js';

export class AnalysisUI {
  constructor(game) {
    this.game = game;
    this.bar = document.getElementById('evaluation-bar');
    this.fill = document.getElementById('eval-fill');
    this.text = document.getElementById('eval-text');
    this.marker = document.getElementById('eval-marker');

    this.panel = document.getElementById('analysis-panel');
    this.panelScore = document.getElementById('analysis-score-value'); // Wait, check index.html IDs
    this.topMovesContainer = document.getElementById('top-moves-content');
    this.panelBarValue = document.getElementById('eval-bar'); // Bar inside panel
    this.evalScoreValue = document.getElementById('eval-score');

    this.engineInfo = document.getElementById('analysis-engine-info');
  }

  update(analysis) {
    const { score, topMoves, depth, nodes } = analysis;

    this.updateBar(score);
    this.updatePanel(score, topMoves, depth, nodes);
  }

  updateBar(score) {
    if (!this.bar || !this.fill) return;

    // Convert score (centi-pawns) to percentage
    // 0 is 50%. +500 is 100%. -500 is 0%.
    // Clamp between -1000 and 1000
    const clampedScore = Math.max(-1000, Math.min(1000, score));
    const percentage = 50 + clampedScore / 20; // 1000 / 20 = 50. So 50+50=100.

    this.fill.style.height = `${percentage}%`;

    const displayScore = (score / 100).toFixed(1);
    const prefix = score > 0 ? '+' : '';
    if (this.text) this.text.textContent = prefix + displayScore;

    this.bar.classList.remove('hidden');
  }

  updatePanel(score, topMoves, depth, nodes) {
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
          // Highlight or show move?
          // For now just console
          console.log('Top move clicked:', item.dataset);
        });
      });
    }

    // Update engine info
    if (this.engineInfo) {
      this.engineInfo.textContent = `Tiefe: ${depth || '-'} | Knoten: ${nodes || '-'}`;
    }
  }

  togglePanel() {
    if (!this.panel) return;
    const isHidden = this.panel.classList.contains('hidden');
    if (isHidden) {
      this.panel.classList.remove('hidden');
    } else {
      this.panel.classList.add('hidden');
    }
    return !isHidden;
  }

  /**
   * Post-Game Analysis Methods (Legacy Support)
   */

  showAnalysisPrompt() {
    import('../ui.js').then(UI => {
      UI.showModal(
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

  async startFullAnalysis() {
    if (!this.game || !this.game.moveHistory || this.game.moveHistory.length === 0) {
      this.isAnalyzing = false;
      return;
    }

    const UI = await import('../ui.js');
    const { analyzeGame, classifyMove } = PostGameAnalyzer;

    this.isAnalyzing = true;
    UI.showModal('Ganganalyse', 'Die KI analysiert die Stellungen...', [], false);

    const states = this.collectBoardStates();
    const results = [];
    const worker = this.game.aiController.aiWorkers[0];

    for (let i = 0; i < states.length; i++) {
      const boardArr = states[i];
      const turn = i % 2 === 0 ? 'white' : 'black';

      // Update progress modal
      UI.showModal(
        'Ganganalyse',
        `Analysiere Stellung ${i + 1} von ${states.length}...`,
        [],
        false
      );

      const analysis = await new Promise(resolve => {
        const handler = e => {
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
            depth: 4, // Reduced from 8 to speed up analysis
            moveNumber: i,
            isAnalysis: true
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

        move.classification = classifyMove(prevEvalMover, currentEvalMover, bestEvalMover);
        move.evalScore = currentResult.score;
      }
    }

    this.isAnalyzing = false;
    UI.closeModal();

    const whiteStats = analyzeGame(this.game.moveHistory, 'white');
    const blackStats = analyzeGame(this.game.moveHistory, 'black');

    UI.updateMoveHistoryUI(this.game);
    UI.renderEvalGraph(this.game);

    this.showSummaryModal(whiteStats, blackStats);
  }

  collectBoardStates() {
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

  undoMoveOnBoard(board, move) {
    const { from, to, piece, capturedPiece, specialMove } = move;

    // Move piece back with all properties
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
        // The king was at 'to' before undo, ensure it's removed
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
      // Normal move or regular capture
      board[to.r][to.c] = capturedPiece
        ? {
          type: capturedPiece.type || 'p', // Fallback for some tests
          hasMoved: true,
          ...capturedPiece,
        }
        : null;
    }
  }

  showSummaryModal(white, black) {
    import('../ui.js').then(UI => {
      const getAccuracyClass = acc =>
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

      UI.showModal('Analyse abgeschlossen', content, [
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
    });
  }

  renderStatCounts(counts) {
    const { QUALITY_METADATA } = PostGameAnalyzer;
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
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
