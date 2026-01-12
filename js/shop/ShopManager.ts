import { SHOP_PIECES, PIECE_VALUES } from '../config.js';
import { PIECE_SVGS } from '../chess-pieces.js';
import { PHASES, type Game } from '../gameEngine.js';
import * as UI from '../ui.js';

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

      UI.updateShopUI(this.game);
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

      UI.updateShopUI(this.game);

      // Update 3D board if active
      if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
        (window as any).battleChess3D.addPiece(pieceType, color, r, c);
      }
    }
  }

  /**
   * Shows upgrade options for a specific piece.
   */
  showUpgradeOptions(r: number, c: number): void {
    const piece = this.game.board[r][c];
    if (!piece) return;

    const upgrades = this.getAvailableUpgrades(piece.type);
    if (upgrades.length === 0) {
      if (this.game.log) this.game.log('Keine Upgrades für diese Figur verfügbar.');
      return;
    }

    const modalTitle = `Upgrade für ${Object.values(SHOP_PIECES).find(p => p.symbol === piece.type)?.name || piece.type}`;
    let content =
      '<div class="upgrade-options" style="display: flex; flex-direction: column; gap: 1rem;">';

    upgrades.forEach(up => {
      const currentVal = PIECE_VALUES[piece.type] || 0;
      const targetVal = PIECE_VALUES[up.symbol] || 0;
      const cost = targetVal - currentVal;
      const canAfford = this.game.points >= cost;

      content += `
        <button class="btn upgrade-btn ${canAfford ? 'btn-primary' : 'btn-disabled'}" 
                style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; text-align: left;"
                ${!canAfford ? 'disabled' : ''}
                onclick="window.gameController.shopManager.upgradePiece(${r}, ${c}, '${up.symbol}')">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px;">${(PIECE_SVGS as any)[piece.color][up.symbol]}</div>
            <div>
              <div style="font-weight: bold;">${up.name}</div>
              <div style="font-size: 0.8rem; opacity: 0.8;">Upgrade-Kosten: ${cost} Pkt</div>
            </div>
          </div>
          ${canAfford ? '<span>Upgrade ➔</span>' : '<span style="color: var(--accent-danger);">Zu teuer</span>'}
        </button>
      `;
    });

    content += '</div>';

    (UI as any).showModal(modalTitle, content, [
      { text: 'Abbrechen', class: 'btn-secondary', callback: () => {} },
    ]);
  }

  /**
   * Returns list of available upgrades for a piece type.
   */
  private getAvailableUpgrades(type: string): any[] {
    const upgrades: Record<string, string[]> = {
      q: ['e'], // Queen -> Angel
      r: ['c'], // Rook -> Chancellor
      b: ['a'], // Bishop -> Archbishop
      n: ['a', 'c', 'e'], // Knight -> Archbishop, Chancellor or Angel
    };

    const symbols = upgrades[type] || [];
    return symbols
      .map(sym => Object.values(SHOP_PIECES).find(p => p.symbol === sym))
      .filter(Boolean);
  }

  /**
   * Upgrades a piece on the board.
   */
  upgradePiece(r: number, c: number, targetType: string): void {
    const piece = this.game.board[r][c];
    if (!piece) return;

    const currentVal = PIECE_VALUES[piece.type] || 0;
    const targetVal = PIECE_VALUES[targetType] || 0;
    const cost = targetVal - currentVal;

    if (this.game.points >= cost) {
      this.game.points -= cost;
      piece.type = targetType as any;

      if (this.game.log)
        this.game.log(
          `${piece.color === 'white' ? 'Weiß' : 'Schwarz'} hat eine Figur zu ${targetType} verbessert.`
        );

      UI.updateShopUI(this.game);
      (UI as any).renderBoard(this.game);
      (UI as any).closeModal();

      // Update 3D board if active
      if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
        (window as any).battleChess3D.removePiece(r, c);
        (window as any).battleChess3D.addPiece(targetType, piece.color, r, c);
      }
    }
  }
}
