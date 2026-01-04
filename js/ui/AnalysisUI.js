import * as PostGameAnalyzer from '../tutor/PostGameAnalyzer.js';
import { logger } from '../logger.js';
import * as UI from '../ui.js';

/**
 * UI Controller for Post-Game Analysis
 */
export class AnalysisUI {
  constructor(game) {
    this.game = game;
    this.isAnalyzing = false;
    this.analysisProgress = 0;
    this.results = {
      white: null,
      black: null,
    };
  }

  /**
   * Shows the initial analysis prompt or starts it automatically
   */
  showAnalysisPrompt() {
    UI.showModal(
      'Partie analysieren?',
      'Möchtest du eine vollständige Analyse dieser Partie durchführen? Dies berechnet Genauigkeit und klassifiziert jeden Zug.',
      [
        { text: 'Später', class: 'btn-secondary' },
        { text: 'Analyse starten', class: 'btn-primary', callback: () => this.startFullAnalysis() },
      ]
    );
  }

  /**
   * Starts the background analysis loop
   */
  async startFullAnalysis() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;
    this.analysisProgress = 0;

    const moveHistory = this.game.moveHistory;
    if (moveHistory.length === 0) {
      this.isAnalyzing = false;
      return;
    }

    // Show progress modal
    this.showProgressModal();

    // Use AI worker from controller
    const aiController = this.game.gameController.aiController;
    if (!aiController) {
      logger.error('AI Controller not found for analysis');
      this.isAnalyzing = false;
      return;
    }

    try {
      // Collect all board states first by undoing from current state
      const boardStates = this.collectBoardStates();
      const totalPositions = boardStates.length;

      for (let i = 0; i < totalPositions; i++) {
        const board = boardStates[i];
        const turn = i % 2 === 0 ? 'white' : 'black';

        // 1. Analyze position to get eval and best move
        const analysis = await this.requestAnalysis(aiController, board, turn);

        if (i < moveHistory.length) {
          // This is the position BEFORE move i
          moveHistory[i].preMoveEval = analysis.score;
          moveHistory[i].bestPossibleScore = analysis.topMoves[0]?.score || analysis.score;
          moveHistory[i].suggestedMove = analysis.topMoves[0]?.move;
        }

        if (i > 0) {
          // This is the position AFTER move i-1
          // We need the eval from moveHistory[i-1].piece.color's perspective
          const previousMoverColor = moveHistory[i - 1].piece.color;
          // If analysis was done for turn (e.g. black), and previous mover was white,
          // then white's eval after move is -analysis.score.
          moveHistory[i - 1].evalScore =
            previousMoverColor === turn ? analysis.score : -analysis.score;

          // Now we can classify move i-1
          const m = moveHistory[i - 1];
          m.classification = PostGameAnalyzer.classifyMove(
            m.preMoveEval,
            m.evalScore,
            m.bestPossibleScore
          );
        }

        this.updateProgress(i + 1, totalPositions);
      }

      this.finishAnalysis();
    } catch (error) {
      logger.error('Error during full analysis:', error);
      UI.showToast('Fehler bei der Analyse', 'error');
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Collects all board states from start to end by temporarily undoing moves on a copy
   */
  collectBoardStates() {
    const states = [];
    const tempGame = {
      board: JSON.parse(JSON.stringify(this.game.board)),
      moveHistory: [...this.game.moveHistory],
    };

    // Work backwards from current state
    for (let i = this.game.moveHistory.length; i >= 0; i--) {
      states[i] = JSON.parse(JSON.stringify(tempGame.board));
      if (i > 0) {
        const move = this.game.moveHistory[i - 1];
        this.undoMoveOnBoard(tempGame.board, move);
      }
    }
    return states;
  }

  /**
   * Helper to undo a move on a board array (minimal implementation)
   */
  undoMoveOnBoard(board, move) {
    const piece = board[move.to.r][move.to.c];
    if (!piece) return;

    board[move.from.r][move.from.c] = piece;
    board[move.to.r][move.to.c] = move.capturedPiece
      ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
      : null;

    piece.hasMoved = move.piece.hasMoved;
    piece.type = move.piece.type;

    if (move.specialMove) {
      if (move.specialMove.type === 'castling') {
        const rook = board[move.specialMove.rookTo.r][move.specialMove.rookTo.c];
        if (rook) {
          board[move.specialMove.rookFrom.r][move.specialMove.rookFrom.c] = rook;
          board[move.specialMove.rookTo.r][move.specialMove.rookTo.c] = null;
          rook.hasMoved = move.specialMove.rookHadMoved;
        }
      } else if (move.specialMove.type === 'enPassant') {
        board[move.specialMove.capturedPawnPos.r][move.specialMove.capturedPawnPos.c] = {
          type: 'p',
          color: move.specialMove.capturedPawn.color,
          hasMoved: true,
        };
      }
    }
  }

  /**
   * Requests single position analysis from AI worker
   */
  requestAnalysis(aiController, board, color) {
    return new Promise(resolve => {
      const worker = aiController.aiWorkers[0]; // Use first worker
      const originalHandler = worker.onmessage;

      worker.onmessage = e => {
        const { type, data } = e.data;
        if (type === 'analysis') {
          worker.onmessage = originalHandler;
          resolve(data);
        }
      };

      worker.postMessage({
        type: 'analyze',
        data: {
          board,
          color,
          depth: 3, // Fast but decent depth for full game
          topMovesCount: 1,
        },
      });
    });
  }

  getBoardStateAt(moveIndex) {
    const moveController = this.game.gameController.moveController;
    // Reconstruct temporarily (this might be slow if done naive, but reconstruction logic is in MoveController)
    return moveController.reconstructBoardAtMove(moveIndex - 1);
  }

  showProgressModal() {
    const content = `
        <div class="post-game-analysis-overlay">
            <p>Die Engine analysiert deine Partie...</p>
            <div class="analysis-progress-container">
                <div id="analysis-progress-fill" class="analysis-progress-fill"></div>
            </div>
            <p id="analysis-status-text">Lade...</p>
        </div>
      `;
    UI.showModal('Ganganalyse', content, [], false);
  }

  updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    const fill = document.getElementById('analysis-progress-fill');
    const text = document.getElementById('analysis-status-text');
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `Zug ${current} von ${total} (${percent}%)`;
  }

  finishAnalysis() {
    UI.hideModal(); // Hide progress

    const whiteStats = PostGameAnalyzer.analyzeGame(this.game.moveHistory, 'white');
    const blackStats = PostGameAnalyzer.analyzeGame(this.game.moveHistory, 'black');

    this.showSummaryModal(whiteStats, blackStats);

    // Update UI history to show badges
    UI.updateMoveHistoryUI(this.game);
    UI.renderEvalGraph(this.game);
  }

  showSummaryModal(white, black) {
    const getAccuracyClass = acc => {
      if (acc >= 85) return 'accuracy-high';
      if (acc >= 70) return 'accuracy-mid';
      return 'accuracy-low';
    };

    const renderCounts = counts => {
      const qualities = Object.keys(PostGameAnalyzer.QUALITY_METADATA);
      return qualities
        .map(q => {
          if (counts[q] === 0 && (q === 'brilliant' || q === 'great' || q === 'book')) return '';
          const meta = PostGameAnalyzer.QUALITY_METADATA[q];
          return `
                <div class="move-quality-row">
                    <div class="quality-badge">
                        <span class="quality-icon" style="background: ${meta.color}">${meta.symbol}</span>
                        <span>${meta.label}</span>
                    </div>
                    <strong>${counts[q]}</strong>
                </div>
              `;
        })
        .join('');
    };

    const content = `
        <div class="post-game-analysis-overlay">
            <div class="analysis-summary-grid">
                <div class="analysis-stat-card">
                    <div class="analysis-stat-value ${getAccuracyClass(white.accuracy)}">${white.accuracy}%</div>
                    <div class="analysis-stat-label">Genauigkeit Weiß</div>
                </div>
                <div class="analysis-stat-card">
                    <div class="analysis-stat-value ${getAccuracyClass(black.accuracy)}">${black.accuracy}%</div>
                    <div class="analysis-stat-label">Genauigkeit Schwarz</div>
                </div>
            </div>

            <div style="display: flex; gap: 20px; width: 100%;">
                <div style="flex: 1;">
                    <h5 style="text-align: center; margin-bottom: 10px;">Weiß</h5>
                    <div class="move-quality-table">${renderCounts(white.counts)}</div>
                </div>
                <div style="flex: 1;">
                    <h5 style="text-align: center; margin-bottom: 10px;">Schwarz</h5>
                    <div class="move-quality-table">${renderCounts(black.counts)}</div>
                </div>
            </div>
        </div>
      `;

    UI.showModal('Analyse abgeschlossen', content, [
      {
        text: 'Partie durchsehen',
        class: 'btn-primary',
        callback: () => this.game.gameController.jumpToMove(0),
      },
      { text: 'Schließen', class: 'btn-secondary' },
    ]);
  }
}
