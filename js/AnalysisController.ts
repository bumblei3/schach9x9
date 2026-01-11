import { PHASES } from './gameEngine.js';
import * as UI from './ui.js';

/**
 * Controller for Analysis Mode functionality
 */
export class AnalysisController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public gameController: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public game: any;

  /**
   * @param {GameController} gameController - Reference to the main game controller
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(gameController: any) {
    this.gameController = gameController;
    this.game = gameController.game;
  }

  /**
   * Enters analysis mode
   * @returns {boolean} True if successful
   */
  public enterAnalysisMode(): boolean {
    if (this.game.phase !== PHASES.PLAY) {
      return false;
    }

    // Save current game state
    this.game.analysisBasePosition = {
      board: JSON.parse(JSON.stringify(this.game.board)),
      turn: this.game.turn,
      moveHistory: [...this.game.moveHistory],
      redoStack: [...this.game.redoStack],
      lastMove: this.game.lastMove ? { ...this.game.lastMove } : null,
      lastMoveHighlight: this.game.lastMoveHighlight ? { ...this.game.lastMoveHighlight } : null,
      selectedSquare: this.game.selectedSquare,
      validMoves: this.game.validMoves,
      halfMoveClock: this.game.halfMoveClock,
      positionHistory: [...this.game.positionHistory],
    };

    // Enter analysis mode
    this.game.analysisMode = true;
    this.game.phase = PHASES.ANALYSIS;

    // Stop clock
    this.gameController.stopClock();

    // Clear selection
    this.game.selectedSquare = null;
    this.game.validMoves = null;

    // Show analysis panel
    const analysisPanel = document.getElementById('analysis-panel');
    if (analysisPanel) {
      analysisPanel.classList.remove('hidden');
    }

    UI.updateStatus(this.game);
    UI.renderBoard(this.game);
    UI.renderEvalGraph(this.game);

    this.game.log('🔍 Analyse-Modus aktiviert. Züge lösen keine KI-Reaktion aus.');

    // Start continuous analysis if enabled
    if (this.game.continuousAnalysis && this.game.aiController) {
      this.requestPositionAnalysis();
    }

    return true;
  }

  /**
   * Exits analysis mode and optionally restores the game state
   * @param {boolean} restore - Whether to restore the position from before analysis
   * @returns {boolean} True if successful
   */
  public exitAnalysisMode(restore: boolean = true): boolean {
    if (!this.game.analysisMode) {
      return false;
    }

    if (restore && this.game.analysisBasePosition) {
      // Restore saved position
      this.game.board = JSON.parse(JSON.stringify(this.game.analysisBasePosition.board));
      this.game.turn = this.game.analysisBasePosition.turn;
      this.game.moveHistory = [...this.game.analysisBasePosition.moveHistory];
      this.game.redoStack = [...this.game.analysisBasePosition.redoStack];
      this.game.lastMove = this.game.analysisBasePosition.lastMove
        ? { ...this.game.analysisBasePosition.lastMove }
        : null;
      this.game.lastMoveHighlight = this.game.analysisBasePosition.lastMoveHighlight
        ? { ...this.game.analysisBasePosition.lastMoveHighlight }
        : null;
      this.game.selectedSquare = this.game.analysisBasePosition.selectedSquare;
      this.game.validMoves = this.game.analysisBasePosition.validMoves;
      this.game.halfMoveClock = this.game.analysisBasePosition.halfMoveClock;
      this.game.positionHistory = [...this.game.analysisBasePosition.positionHistory];
    }

    // Exit analysis mode
    this.game.analysisMode = false;
    this.game.phase = PHASES.PLAY;
    this.game.analysisBasePosition = null;
    this.game.analysisVariations = [];

    // Hide analysis panel
    const analysisPanel = document.getElementById('analysis-panel');
    if (analysisPanel) {
      analysisPanel.classList.add('hidden');
    }

    // Restart clock if enabled
    if (this.game.clockEnabled) {
      this.gameController.startClock();
    }

    UI.updateStatus(this.game);
    UI.renderBoard(this.game);
    UI.renderEvalGraph(this.game);

    const message = restore
      ? '🔍 Analyse-Modus beendet. Position wiederhergestellt.'
      : '🔍 Analyse-Modus beendet. Aktuelle Position behalten.';
    this.game.log(message);

    return true;
  }

  public requestPositionAnalysis(): void {
    // Request analysis from AI controller
    if (!this.game.aiController || !this.game.aiController.analyzePosition) {
      return;
    }

    this.game.aiController.analyzePosition();
  }

  public toggleContinuousAnalysis(): void {
    this.game.continuousAnalysis = !this.game.continuousAnalysis;

    if (this.game.continuousAnalysis && this.game.analysisMode) {
      this.requestPositionAnalysis();
      this.game.log('🔄 Kontinuierliche Analyse aktiviert.');
    } else {
      this.game.log('⏸️ Kontinuierliche Analyse deaktiviert.');
    }
  }

  /**
   * Jumps to a specific move in the game history (for analysis).
   * @param {number} moveIndex - Index of the move in moveHistory
   */
  public jumpToMove(moveIndex: number): void {
    if (!this.game.moveController || !this.game.moveController.reconstructBoardAtMove) {
      return;
    }

    this.game.moveController.reconstructBoardAtMove(moveIndex);
    this.game.replayPosition = moveIndex;

    UI.renderBoard(this.game);
    UI.updateStatus(this.game);

    if (this.game.continuousAnalysis) {
      this.requestPositionAnalysis();
    }
  }

  /**
   * Jumps to the initial game position (for analysis).
   */
  public jumpToStart(): void {
    if (!this.game.moveController || !this.game.moveController.reconstructBoardAtMove) {
      return;
    }

    this.game.moveController.reconstructBoardAtMove(0);
    this.game.replayPosition = -1;

    UI.renderBoard(this.game);
    UI.updateStatus(this.game);
  }
}
