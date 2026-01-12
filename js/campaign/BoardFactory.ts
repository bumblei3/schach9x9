import { Board, Piece, PieceType, Player } from '../types/game.js';

export class BoardFactory {
  static createEmptyBoard(rows: number = 9, cols: number = 9): Board {
    return Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));
  }

  /**
   * Creates the board for "Der Aufstand" (The Uprising)
   * Player (White): Standard King setup (or just King + Pawns?)
   * Opponent (Black): Army of Pawns + King
   */
  static createLevel1Board(): Board {
    const board = this.createEmptyBoard(9, 9);

    // --- White (Player) ---
    // Standard King position for 9x9 (Row 7, Col 4 if 0-indexed? No, White is bottom)
    // White King is usually placed manually in setup, but for fixed levels we place it.
    // Let's place White King at standard start: Row 7 (index), Col 4
    // Actually in 9x9, White is usually at rows 6-8.
    // Let's give the player a standard-ish small army or just a King + some support?
    // Description says: "Defeat the peasant army".
    // Let's give player a King and 3 Pawns? Or a full 9x9 setup?
    // Let's go with: Player has King + 2 Knights + 2 Rooks (The "Royalty" vs "Peasants")

    // Note: Board indices: 0 is top (Black), 8 is bottom (White)

    // White King
    board[8][4] = { type: 'k', color: 'white', hasMoved: false };

    // White Knights
    board[8][1] = { type: 'n', color: 'white', hasMoved: false };
    board[8][7] = { type: 'n', color: 'white', hasMoved: false };

    // White Rooks
    board[8][0] = { type: 'r', color: 'white', hasMoved: false };
    board[8][8] = { type: 'r', color: 'white', hasMoved: false };

    // White Pawns (Soldiers)
    for (let c = 2; c <= 6; c++) {
      board[7][c] = { type: 'p', color: 'white', hasMoved: false };
    }

    // --- Black (Opponent - The Uprising) ---
    // King
    board[0][4] = { type: 'k', color: 'black', hasMoved: false };

    // LOTS of Pawns (The Peasants)
    // Rows 1 and 2 full of pawns?
    for (let c = 0; c < 9; c++) {
      board[1][c] = { type: 'p', color: 'black', hasMoved: false };
      if (c % 2 === 0) {
        // Staggered second row
        board[2][c] = { type: 'p', color: 'black', hasMoved: false };
      }
    }

    return board;
  }

  static createLevel2Board(): Board {
    // "The Cavalry": 4 Knights vs Player
    const board = this.createEmptyBoard(9, 9);

    // White: Standard-ish
    board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    board[7][4] = { type: 'p', color: 'white', hasMoved: false };
    board[7][3] = { type: 'p', color: 'white', hasMoved: false };
    board[7][5] = { type: 'p', color: 'white', hasMoved: false };

    // Black: King + 4 Knights
    board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    board[2][2] = { type: 'n', color: 'black', hasMoved: false };
    board[2][6] = { type: 'n', color: 'black', hasMoved: false };
    board[3][3] = { type: 'n', color: 'black', hasMoved: false };
    board[3][5] = { type: 'n', color: 'black', hasMoved: false };

    return board;
  }
}
