import { PHASES, PIECE_VALUES } from './gameEngine.js';
import * as MoveValidator from './move/MoveValidator.js';
import * as MoveExecutor from './move/MoveExecutor.js';
import * as GameStateManager from './move/GameStateManager.js';
import * as UI from './ui.js';

/**
 * Orchestrator for move-related logic, delegating to specialized sub-modules.
 * Maintains backward compatibility with the original MoveController API.
 */
export class MoveController {
  constructor(game) {
    this.game = game;
    this.redoStack = [];
  }

  async handlePlayClick(r, c) {
    const clickedPiece = this.game.board[r][c];
    const isCurrentPlayersPiece = clickedPiece && clickedPiece.color === this.game.turn;

    // 1. If clicking own piece, always select it
    if (isCurrentPlayersPiece) {
      this.game.selectedSquare = { r, c };
      this.game.validMoves = this.game.getValidMoves(r, c, clickedPiece);
      UI.renderBoard(this.game);
      return;
    }

    // 2. If we have a selected piece belonging to us, check if we want to move/capture
    const selectedPiece = this.game.selectedSquare
      ? this.game.board[this.game.selectedSquare.r][this.game.selectedSquare.c]
      : null;
    const isSelectedMine = selectedPiece && selectedPiece.color === this.game.turn;

    if (isSelectedMine && this.game.validMoves) {
      // getValidMoves returns destination squares {r, c}
      const move = this.game.validMoves.find(m => m.r === r && m.c === c);

      if (move) {
        const from = { ...this.game.selectedSquare };

        const finalizeMove = async () => {
          // Track accuracy for human player
          const isHumanMove = this.game.isAI ? this.game.turn === 'white' : true;
          if (isHumanMove) {
            this.game.stats.playerMoves++;
            if (this.game.isTutorMove && this.game.isTutorMove(move)) {
              this.game.stats.playerBestMoves++;
            }
            if (this.game.tutorController && this.game.tutorController.handlePlayerMove) {
              this.game.tutorController.handlePlayerMove(from, move);
            }
          }
          await this.executeMove(from, move);
        };

        // 🎯 KI-Mentor (Coach) - Proaktive Warnung vor Fehlern
        if (this.game.kiMentorEnabled && this.game.tutorController) {
          const analysis = await this.game.tutorController.analyzePlayerMovePreExecution({
            from,
            to: move,
          });
          if (analysis) {
            this.game.tutorController.showBlunderWarning(analysis, finalizeMove);
            return;
          }
        }

        await finalizeMove();
        return;
      }
    }

    // 3. If clicking an enemy piece (and not capturing it), select it to show threats
    if (clickedPiece) {
      this.game.selectedSquare = { r, c };
      this.game.validMoves = this.game.getValidMoves(r, c, clickedPiece);
      UI.renderBoard(this.game);
      return;
    }

    // 4. Otherwise deselect
    this.game.selectedSquare = null;
    this.game.validMoves = null;
    UI.renderBoard(this.game);
  }

  /**
   * Executes a move on the board
   * @param {Object} from Source square {r, c}
   * @param {Object} to Destination square {r, c}
   * @param {boolean} isUndoRedo Whether this move is from an undo/redo operation
   */
  async executeMove(from, to, isUndoRedo = false) {
    return MoveExecutor.executeMove(this.game, this, from, to, isUndoRedo);
  }

  /**
   * Finalizes the move, switches turns, and checks for game over
   */
  finishMove() {
    return MoveExecutor.finishMove(this.game, this);
  }

  /**
   * Undoes the last move
   */
  undoMove() {
    return GameStateManager.undoMove(this.game, this);
  }

  /**
   * Redoes the last undone move
   */
  async redoMove() {
    if (
      this.redoStack.length === 0 ||
      (this.game.phase !== PHASES.PLAY && this.game.phase !== PHASES.ANALYSIS)
    ) {
      return;
    }
    const move = this.redoStack.pop();
    this.game.selectedSquare = move.from;
    const piece = this.game.board[move.from.r][move.from.c];
    if (piece) {
      this.game.validMoves = this.game.getValidMoves(move.from.r, move.from.c, piece);
    }
    await this.executeMove(move.from, move.to, true);
    this.updateUndoRedoButtons();
  }

  /**
   * Shows the promotion UI
   */
  showPromotionUI(r, c, color, moveRecord) {
    UI.showPromotionUI(this.game, r, c, color, moveRecord, () => this.finishMove());
  }

  /**
   * Animates a move
   */
  async animateMove(from, to, piece) {
    await UI.animateMove(this.game, from, to, piece);
  }

  /**
   * Updates the UI buttons for undo and redo
   */
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      const canUndo =
        this.game.moveHistory.length > 0 &&
        (this.game.phase === PHASES.PLAY || this.game.phase === PHASES.ANALYSIS);
      undoBtn.disabled = !canUndo;
      undoBtn.textContent = `⏮ Rückgängig${this.game.moveHistory.length > 0 ? ` (${this.game.moveHistory.length})` : ''}`;
    }

    if (redoBtn) {
      const canRedo =
        this.redoStack.length > 0 &&
        (this.game.phase === PHASES.PLAY || this.game.phase === PHASES.ANALYSIS);
      redoBtn.disabled = !canRedo;
      redoBtn.textContent = `⏭ Wiederholen${this.redoStack.length > 0 ? ` (${this.redoStack.length})` : ''}`;
    }
  }

  /**
   * Checks for a draw
   */
  checkDraw() {
    return MoveValidator.checkDraw(this.game);
  }

  /**
   * Checks for insufficient material
   */
  isInsufficientMaterial() {
    return MoveValidator.isInsufficientMaterial(this.game);
  }

  /**
   * Gets a hash of the current board state
   */
  getBoardHash() {
    return MoveValidator.getBoardHash(this.game);
  }

  /**
   * Saves the current game state
   */
  saveGame() {
    return GameStateManager.saveGame(this.game);
  }

  /**
   * Loads a saved game state
   */
  loadGame() {
    return GameStateManager.loadGame(this.game);
  }

  /**
   * Calculates the current material advantage
   */
  calculateMaterialAdvantage() {
    return MoveValidator.calculateMaterialAdvantage(this.game);
  }

  /**
   * Returns the material value of a piece
   */
  getMaterialValue(piece) {
    return PIECE_VALUES[piece.type] || 0;
  }

  /**
   * Enters replay mode
   */
  enterReplayMode() {
    return GameStateManager.enterReplayMode(this.game, this);
  }

  /**
   * Exits replay mode
   */
  exitReplayMode() {
    return GameStateManager.exitReplayMode(this.game);
  }

  replayFirst() {
    if (!this.game.replayMode) this.enterReplayMode();
    this.game.replayPosition = -1;
    this.updateReplayUI();
  }

  replayPrevious() {
    if (!this.game.replayMode) this.enterReplayMode();
    if (this.game.replayPosition > -1) {
      this.game.replayPosition--;
      this.updateReplayUI();
    }
  }

  replayNext() {
    if (!this.game.replayMode) this.enterReplayMode();
    if (this.game.replayPosition < this.game.moveHistory.length - 1) {
      this.game.replayPosition++;
      this.updateReplayUI();
    }
  }

  replayLast() {
    if (!this.game.replayMode) this.enterReplayMode();
    this.game.replayPosition = this.game.moveHistory.length - 1;
    this.updateReplayUI();
  }

  updateReplayUI() {
    GameStateManager.reconstructBoardAtMove(this.game, this.game.replayPosition);
    const replayMoveNum = document.getElementById('replay-move-num');
    if (replayMoveNum) replayMoveNum.textContent = this.game.replayPosition + 1;

    const first = document.getElementById('replay-first');
    const prev = document.getElementById('replay-prev');
    const next = document.getElementById('replay-next');
    const last = document.getElementById('replay-last');

    if (first) first.disabled = this.game.replayPosition === -1;
    if (prev) prev.disabled = this.game.replayPosition === -1;
    if (next) next.disabled = this.game.replayPosition === this.game.moveHistory.length - 1;
    if (last) last.disabled = this.game.replayPosition === this.game.moveHistory.length - 1;

    UI.renderBoard(this.game);
  }

  reconstructBoardAtMove(moveIndex) {
    return GameStateManager.reconstructBoardAtMove(this.game, moveIndex);
  }

  undoMoveForReplay(move) {
    return GameStateManager.undoMoveForReplay(this.game, move);
  }

  /**
   * Sets the visual theme
   */
  setTheme(themeName) {
    this.game.currentTheme = themeName;
    this.applyTheme(themeName);
    localStorage.setItem('chess_theme', themeName);
  }

  applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
  }
}
