import {
  PHASES,
  PIECE_VALUES,
  type Player,
  type Game,
  type Piece,
  type MoveHistoryEntry,
  type Square,
  type PieceWithMoved,
} from './gameEngine.js';
import { campaignManager } from './campaign/CampaignManager.js';
import {
  checkDraw,
  isInsufficientMaterial,
  getBoardHash,
  calculateMaterialAdvantage,
} from './move/MoveValidator.js';
import {
  executeMove as executeMoveFromExecutor,
  finishMove as finishMoveFromExecutor,
} from './move/MoveExecutor.js';
import {
  undoMove as undoMoveFromManager,
  saveGame as saveGameFromManager,
  loadGame as loadGameFromManager,
  enterReplayMode as enterReplayModeFromManager,
  exitReplayMode as exitReplayModeFromManager,
  reconstructBoardAtMove as reconstructBoardAtMoveFromManager,
  undoMoveForReplay as undoMoveForReplayFromManager,
} from './move/GameStateManager.js';
import * as UI from './ui.js';

/**
 * Orchestrator for move-related logic, delegating to specialized sub-modules.
 * Maintains backward compatibility with the original MoveController API.
 */
export class MoveController {
  private game: Game;
  public redoStack: MoveHistoryEntry[];

  constructor(game: Game) {
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
      const move = this.game.validMoves.find((m: Square) => m.r === r && m.c === c);

      if (move) {
        const from: Square = { r: this.game.selectedSquare!.r, c: this.game.selectedSquare!.c };

        const finalizeMove = async () => {
          // Track accuracy for human player
          const isHumanMove = this.game.isAI ? this.game.turn === 'white' : true;
          if (isHumanMove) {
            this.game.stats.playerMoves++;
            if (this.game.isTutorMove && this.game.isTutorMove(move)) {
              this.game.stats.playerBestMoves++;
            }
            if (this.game.tutorController?.handlePlayerMove) {
              this.game.tutorController.handlePlayerMove(from, move);
            }
          }
          await this.executeMove(from, move);
        };

        // 🎯 KI-Mentor (Coach) - Proaktive Warnung vor Fehlern
        if (this.game.kiMentorEnabled && this.game.tutorController?.analyzePlayerMovePreExecution) {
          const analysis = await this.game.tutorController.analyzePlayerMovePreExecution({
            from,
            to: move,
          });
          if (analysis && this.game.tutorController.showBlunderWarning) {
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
  public async executeMove(
    from: Square,
    to: Square,
    isUndoRedo: boolean = false,
    promotionType?: string
  ): Promise<void> {
    return executeMoveFromExecutor(this.game, this, from, to, isUndoRedo, promotionType);
  }

  /**
   * Finalizes the move, switches turns, and checks for game over
   */
  public finishMove(): void {
    return finishMoveFromExecutor(this.game);
  }

  /**
   * Undoes the last move
   */
  public undoMove(): void {
    return undoMoveFromManager(this.game, this);
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
    if (!move) return;
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
  public showPromotionUI(r: number, c: number, color: string, moveRecord: MoveHistoryEntry): void {
    UI.showPromotionUI(this.game, r, c, color as Player, moveRecord, () => this.finishMove());
  }

  /**
   * Animates a move
   */
  public async animateMove(from: Square, to: Square, piece: PieceWithMoved | null): Promise<void> {
    // BoardRenderer.animateMove expects Piece, but PieceWithMoved extends Piece.
    // The null case is handled by the caller — this cast is safe.
    const animFn = (UI as any).animateMove as (
      g: Game,
      f: Square,
      t: Square,
      p: Piece
    ) => Promise<void>;
    await animFn(this.game, from, to, piece as Piece);
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
  public checkDraw(): boolean {
    return checkDraw(this.game);
  }

  /**
   * Checks for insufficient material
   */
  public isInsufficientMaterial(): boolean {
    return isInsufficientMaterial(this.game);
  }

  /**
   * Gets a hash of the current board state
   */
  public getBoardHash(): string {
    return getBoardHash(this.game);
  }

  /**
   * Saves the current game state
   */
  public saveGame(): void {
    return saveGameFromManager(this.game);
  }

  /**
   * Loads a saved game state
   */
  public loadGame(): boolean {
    return loadGameFromManager(this.game);
  }

  /**
   * Calculates the current material advantage
   */
  public calculateMaterialAdvantage(): number {
    return calculateMaterialAdvantage(this.game);
  }

  /**
   * Returns the material value of a piece
   */
  public getMaterialValue(piece: PieceWithMoved | null): number {
    if (!piece) return 0;
    let baseValue = PIECE_VALUES[piece.type] || 0;

    // RPG Bonus in Campaign
    if (this.game.mode === 'campaign' && piece.color === this.game.playerColor) {
      const xp = campaignManager.getUnitXp(piece.type);
      if (xp.level > 1) {
        // +10% value per level above 1
        baseValue *= 1 + (xp.level - 1) * 0.1;
      }

      // Champion bonus
      const state = (campaignManager as any).state;
      if (state.championType === piece.type) {
        baseValue += 0.5; // Flat hero bonus
      }
    }

    return baseValue;
  }

  /**
   * Enters replay mode
   */
  public enterReplayMode(): void {
    return enterReplayModeFromManager(this.game, this);
  }

  /**
   * Exits replay mode
   */
  public exitReplayMode(): void {
    return exitReplayModeFromManager(this.game);
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
    reconstructBoardAtMoveFromManager(this.game, this.game.replayPosition);
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

  public reconstructBoardAtMove(moveIndex: number): void {
    return reconstructBoardAtMoveFromManager(this.game, moveIndex);
  }

  public undoMoveForReplay(move: MoveHistoryEntry): void {
    return undoMoveForReplayFromManager(this.game, move);
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
