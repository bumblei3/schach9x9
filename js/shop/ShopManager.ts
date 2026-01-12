import { SHOP_PIECES, PIECE_VALUES } from '../config.js';
import { PIECE_SVGS } from '../chess-pieces.js';
import { PHASES, type Game } from '../gameEngine.js';
import { updateShopUI } from '../ui.js';

/**
 * Manages the shop logic during the setup phase.
 */
export class ShopManager {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /**
   * Selects a piece from the shop to be placed.
   * @param {string} pieceType - The type of the piece to select.
   */
  selectShopPiece(pieceType: string): void {
    if (!pieceType) return;
    const cost = (PIECE_VALUES as any)[pieceType];

    // Check if player has enough points
    if (cost > this.game.points) {
      if (this.game.log) this.game.log('Nicht genug Punkte!');
      return;
    }

    this.game.selectedShopPiece = pieceType;

    // Update UI highlights
    document.querySelectorAll('.shop-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.shop-btn[data-piece="${pieceType}"]`);
    if (btn) btn.classList.add('selected');

    const displayEl = document.getElementById('selected-piece-display');
    if (displayEl) {
      // Find the piece info from SHOP_PIECES by matching the symbol
      const pieceInfo = Object.values(SHOP_PIECES).find(p => p.symbol === pieceType);

      // Get SVG for display
      const svg = (PIECE_SVGS as any)['white'][pieceType];

      displayEl.innerHTML = `Ausgewählt: <div style="display:inline-block;width:30px;height:30px;vertical-align:middle;">${svg}</div> ${pieceInfo ? pieceInfo.name : pieceType} (${cost})`;
    }
  }

  /**
   * Places a selected shop piece on the board.
   * @param {number} r - Row index.
   * @param {number} c - Column index.
   */
  placeShopPiece(r: number, c: number): void {
    // If no piece selected, try to remove/sell existing piece
    if (!this.game.selectedShopPiece) {
      this.handleSellPiece(r, c);
      return;
    }

    // Handle buying/placing new piece
    this.handleBuyPiece(r, c);
  }

  handleSellPiece(r: number, c: number): void {
    const piece = this.game.board[r][c];
    const isWhiteTurn = (this.game.phase as any) === PHASES.SETUP_WHITE_PIECES;
    const color = isWhiteTurn ? 'white' : 'black';

    // Can only remove own non-king pieces
    if (piece && piece.color === color && piece.type !== 'k') {
      // Look up piece value
      const pieceEntry = Object.values(SHOP_PIECES).find(p => p.symbol === piece.type);
      const cost = pieceEntry ? pieceEntry.points : 0;

      this.game.points += cost;
      this.game.board[r][c] = null;

      updateShopUI(this.game);
      if (this.game.log) this.game.log('Figur entfernt, Punkte erstattet.');

      // Update 3D board if active
      if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
        (window as any).battleChess3D.removePiece(r, c);
      }
    } else {
      if (this.game.log) this.game.log('Bitte zuerst eine Figur im Shop auswählen!');
    }
  }

  handleBuyPiece(r: number, c: number): void {
    const isWhiteTurn = (this.game.phase as any) === PHASES.SETUP_WHITE_PIECES;
    const color = isWhiteTurn ? 'white' : 'black';
    const colStart = isWhiteTurn
      ? (this.game as any).whiteCorridor
      : (this.game as any).blackCorridor;

    if (typeof colStart !== 'number') return;

    // Fixed row ranges for 9x9 board
    // Black: Rows 0-2
    // White: Rows 6-8
    const rowStart = isWhiteTurn ? 6 : 0;

    // Validate placement area (must be in own corridor)
    if (r < rowStart || r >= rowStart + 3 || c < colStart || c >= colStart + 3) {
      if (this.game.log) this.game.log('Muss im eigenen Korridor platziert werden!');
      return;
    }

    // Check if square is occupied
    if (this.game.board[r][c]) {
      if (this.game.log) this.game.log('Feld besetzt!');
      return;
    }

    const cost = (PIECE_VALUES as any)[this.game.selectedShopPiece!];
    if (this.game.points >= cost) {
      const pieceType = this.game.selectedShopPiece!;

      this.game.board[r][c] = {
        type: pieceType as any,
        color: color,
        hasMoved: false,
      };
      this.game.points -= cost;

      // Clear selection after placing (one-time placement per click)
      this.game.selectedShopPiece = null;

      // Deselect all shop buttons
      document.querySelectorAll('.shop-item').forEach(btn => btn.classList.remove('selected'));

      updateShopUI(this.game);

      // Update 3D board if active
      if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
        (window as any).battleChess3D.addPiece(pieceType, color, r, c);
      }
    }
  }
}
