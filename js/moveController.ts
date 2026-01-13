import { PHASES, PIECE_VALUES, type Player } from './gameEngine.js';
import * as MoveValidator from './move/MoveValidator.js';
import * as MoveExecutor from './move/MoveExecutor.js';
import * as GameStateManager from './move/GameStateManager.js';
import * as UI from './ui.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any

/**
 * Orchestrator for move-related logic, delegating to specialized sub-modules.
 * Maintains backward compatibility with the original MoveController API.
 */
export class MoveController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private game: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redoStack: any[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(game: any) {
    this.game = game;
    this.redoStack = [];
  }

  public async handlePlayClick(r: number, c: number): Promise<void> {
    const clickedPiece = this.game.board[r][c];
    const isCurrentPlayersPiece = clickedPiece && clickedPiece.color === this.game.turn;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const move = this.game.validMoves.find((m: any) => m.r === r && m.c === c);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async executeMove(
    from: any,
    to: any,
    isUndoRedo: boolean = false,
    promotionType?: string
  ): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveExecutor as any).executeMove(this.game, this, from, to, isUndoRedo, promotionType);
  }

  /**
   * Finalizes the move, switches turns, and checks for game over
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public finishMove(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveExecutor as any).finishMove(this.game);
  }

  /**
   * Undoes the last move
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public undoMove(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).undoMove(this.game, this);
  }

  /**
   * Redoes the last undone move
   */
  public async redoMove(): Promise<void> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public showPromotionUI(r: number, c: number, color: string, moveRecord: any): void {
    UI.showPromotionUI(this.game, r, c, color as Player, moveRecord, () => this.finishMove());
  }

  /**
   * Animates a move
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async animateMove(from: any, to: any, piece: any): Promise<void> {
    await UI.animateMove(this.game, from, to, piece);
  }

  /**
   * Updates the UI buttons for undo and redo
   */
  public updateUndoRedoButtons(): void {
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public checkDraw(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveValidator as any).checkDraw(this.game);
  }

  /**
   * Checks for insufficient material
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public isInsufficientMaterial(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveValidator as any).isInsufficientMaterial(this.game);
  }

  /**
   * Gets a hash of the current board state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getBoardHash(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveValidator as any).getBoardHash(this.game);
  }

  /**
   * Saves the current game state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public saveGame(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).saveGame(this.game);
  }

  /**
   * Loads a saved game state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public loadGame(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).loadGame(this.game);
  }

  /**
   * Calculates the current material advantage
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public calculateMaterialAdvantage(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (MoveValidator as any).calculateMaterialAdvantage(this.game);
  }

  /**
   * Returns the material value of a piece
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getMaterialValue(piece: any): number {
    return PIECE_VALUES[piece.type] || 0;
  }

  /**
   * Enters replay mode
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public enterReplayMode(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).enterReplayMode(this.game, this);
  }

  /**
   * Exits replay mode
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public exitReplayMode(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).exitReplayMode(this.game);
  }

  public replayFirst(): void {
    if (!this.game.replayMode) this.enterReplayMode();
    this.game.replayPosition = -1;
    this.updateReplayUI();
  }

  public replayPrevious(): void {
    if (!this.game.replayMode) this.enterReplayMode();
    if (this.game.replayPosition > -1) {
      this.game.replayPosition--;
      this.updateReplayUI();
    }
  }

  public replayNext(): void {
    if (!this.game.replayMode) this.enterReplayMode();
    if (this.game.replayPosition < this.game.moveHistory.length - 1) {
      this.game.replayPosition++;
      this.updateReplayUI();
    }
  }

  public replayLast(): void {
    if (!this.game.replayMode) this.enterReplayMode();
    this.game.replayPosition = this.game.moveHistory.length - 1;
    this.updateReplayUI();
  }

  public updateReplayUI(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GameStateManager as any).reconstructBoardAtMove(this.game, this.game.replayPosition);
    const replayMoveNum = document.getElementById('replay-move-num');
    if (replayMoveNum) replayMoveNum.textContent = String(this.game.replayPosition + 1);

    const first = document.getElementById('replay-first') as HTMLButtonElement;
    const prev = document.getElementById('replay-prev') as HTMLButtonElement;
    const next = document.getElementById('replay-next') as HTMLButtonElement;
    const last = document.getElementById('replay-last') as HTMLButtonElement;

    if (first) first.disabled = this.game.replayPosition === -1;
    if (prev) prev.disabled = this.game.replayPosition === -1;
    if (next) next.disabled = this.game.replayPosition === this.game.moveHistory.length - 1;
    if (last) last.disabled = this.game.replayPosition === this.game.moveHistory.length - 1;

    UI.renderBoard(this.game);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public reconstructBoardAtMove(moveIndex: number): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).reconstructBoardAtMove(this.game, moveIndex);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public undoMoveForReplay(move: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (GameStateManager as any).undoMoveForReplay(this.game, move);
  }

  /**
   * Sets the visual theme
   */
  public setTheme(themeName: string): void {
    this.game.currentTheme = themeName;
    this.applyTheme(themeName);
    localStorage.setItem('chess_theme', themeName);
  }

  public applyTheme(themeName: string): void {
    document.body.setAttribute('data-theme', themeName);
  }
}
