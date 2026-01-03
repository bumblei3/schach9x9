import { BOARD_SIZE } from '../config.js';
import { logger } from '../logger.js';

export class OpeningBook {
  constructor(data = { positions: {} }) {
    this.data = data;
  }

  /**
   * Load book data
   */
  load(data) {
    this.data = data || { positions: {} };
  }

  /**
   * Query for a move
   */
  getMove(board, moveNumber) {
    // Only use book for first 12 moves (increased from 10)
    if (moveNumber >= 12) {
      return null;
    }

    const hash = this.getBoardHash(board, moveNumber % 2 === 0 ? 'white' : 'black');

    if (!this.data.positions[hash]) {
      return null;
    }

    const position = this.data.positions[hash];
    const moves = position.moves;

    if (!moves || moves.length === 0) {
      return null;
    }

    // Weighted random selection
    const totalWeight = moves.reduce((sum, m) => sum + m.weight, 0);
    let random = Math.random() * totalWeight;

    for (const move of moves) {
      random -= move.weight;
      if (random <= 0) {
        logger.debug(
          `[Opening Book] Selected: ${move.from.r},${move.from.c} -> ${move.to.r},${move.to.c} (${move.weight}%)`
        );
        return { from: move.from, to: move.to };
      }
    }

    // Fallback
    return { from: moves[0].from, to: moves[0].to };
  }

  /**
   * Add a move to the book
   */
  addMove(board, turn, move) {
    const hash = this.getBoardHash(board, turn);

    if (!this.data.positions[hash]) {
      this.data.positions[hash] = { moves: [], seenCount: 0 };
    }

    const pos = this.data.positions[hash];
    pos.seenCount++;

    // Check if move exists
    const existingMove = pos.moves.find(
      m =>
        m.from.r === move.from.r &&
        m.from.c === move.from.c &&
        m.to.r === move.to.r &&
        m.to.c === move.to.c
    );

    if (existingMove) {
      existingMove.games++;
      // Weight recalculation needed externally or periodically
    } else {
      pos.moves.push({
        from: move.from,
        to: move.to,
        weight: 1, // Initial weight
        games: 1,
      });
    }
  }

  /**
   * Merge another book into this one
   */
  merge(otherBook) {
    if (!otherBook || !otherBook.data || !otherBook.data.positions) return;

    for (const [hash, pos] of Object.entries(otherBook.data.positions)) {
      if (!this.data.positions[hash]) {
        this.data.positions[hash] = JSON.parse(JSON.stringify(pos));
      } else {
        const myPos = this.data.positions[hash];
        myPos.seenCount += pos.seenCount;

        for (const move of pos.moves) {
          const myMove = myPos.moves.find(
            m =>
              m.from.r === move.from.r &&
              m.from.c === move.from.c &&
              m.to.r === move.to.r &&
              m.to.c === move.to.c
          );

          if (myMove) {
            myMove.games += move.games;
            // Weight requires recalculation
          } else {
            myPos.moves.push(JSON.parse(JSON.stringify(move)));
          }
        }
      }
    }
  }

  /**
   * Generate board hash
   */
  getBoardHash(board, turn) {
    let hash = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        hash += piece ? `${piece.color[0]}${piece.type}` : '..';
      }
    }
    hash += turn[0];
    return hash;
  }
}

// Singleton instance for backward compatibility or global usage
export const openingBook = new OpeningBook();

// Export legacy functions for compatibility if needed (deprecated)
export function setOpeningBook(bookData) {
  openingBook.load(bookData);
}

export function queryOpeningBook(board, moveNumber) {
  return openingBook.getMove(board, moveNumber);
}
