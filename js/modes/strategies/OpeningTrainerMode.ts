import type { GameModeStrategy } from '../GameModeStrategy.js';
import type { GameExtended, GameController } from '../../gameController.js';
import type { Square, Piece } from '../../gameEngine.js';
import { PHASES } from '../../config.js';
import * as UI from '../../ui.js';

/**
 * Opening-trainer play loop.
 *
 * Implements the two-click selection pattern (select own piece → click a
 * valid target) exactly like MoveController, but instead of executing the move
 * on the board it forwards the chosen move to the controller, which checks it
 * against the opening book and shows feedback. The board itself is NEVER
 * mutated by the trainer — it only ever displays book positions.
 */
export class OpeningTrainerModeStrategy implements GameModeStrategy {
  private controller: GameController;

  constructor(controller: GameController) {
    this.controller = controller;
  }

  init(_game: GameExtended, _controller: GameController, _initialPoints: number): void {
    // Board setup is handled by GameController.startOpeningTrainerMode.
  }

  async handleInteraction(
    game: GameExtended,
    _controller: GameController,
    r: number,
    c: number
  ): Promise<boolean> {
    if (game.phase !== PHASES.PLAY) {
      return false;
    }

    // 1. No current selection: select an own piece if present.
    // In any other case (empty/enemy first click) swallow the click so it
    // never falls through to MoveController (which would select an enemy
    // piece and break the trainer loop).
    if (!game.selectedSquare) {
      const piece = game.board[r][c];
      if (piece && piece.color === game.turn) {
        game.selectedSquare = { r, c };
        game.validMoves = game.getValidMoves(r, c, piece);
        UI.renderBoard(game);
      }
      return true;
    }

    // 2. We already have a selection: is this click a valid target move?
    const move = (game.validMoves ?? []).find((m: Square) => m.r === r && m.c === c);
    if (move) {
      const from: Square = { r: game.selectedSquare.r, c: game.selectedSquare.c };
      const to: Square = { r: move.r, c: move.c };
      game.selectedSquare = null;
      game.validMoves = null;
      UI.renderBoard(game);
      this.controller.submitTrainerMove({ from, to });
      return true;
    }

    // 3. Re-select another own piece, or deselect on empty/enemy click.
    const clickedPiece: Piece | null = game.board[r][c];
    if (clickedPiece && clickedPiece.color === game.turn) {
      game.selectedSquare = { r, c };
      game.validMoves = game.getValidMoves(r, c, clickedPiece);
    } else {
      game.selectedSquare = null;
      game.validMoves = null;
    }
    UI.renderBoard(game);
    return true;
  }

  onPhaseEnd(_game: GameExtended, _controller: GameController): void {
    // No phase transitions in opening-trainer mode.
  }
}
