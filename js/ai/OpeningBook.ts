/**
 * Opening Book for Schach 9x9
 * Manages opening book data with weighted random move selection
 */

import { logger } from '../logger.js';
import type { Square, Piece } from '../gameEngine.js';

interface BookMove {
  from: Square;
  to: Square;
  weight: number;
  games: number;
}

interface BookPosition {
  moves: BookMove[];
  seenCount: number;
}

interface BookData {
  positions: Record<string, BookPosition>;
}

/**
 * Opening Book class for managing chess opening data
 */
export class OpeningBook {
  data: BookData;

  constructor(data: BookData = { positions: {} }) {
    this.data = data;
  }

  /**
   * Load book data
   */
  load(data: BookData | null): void {
    this.data = data || { positions: {} };
  }

  /**
   * Query for a move from the opening book
   */
  getMove(board: (Piece | null)[][], moveNumber: number): { from: Square; to: Square } | null {
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
    const totalWeight = moves.reduce((sum: number, m: BookMove) => sum + m.weight, 0);
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
  addMove(board: (Piece | null)[][], turn: string, move: { from: Square; to: Square }): void {
    const hash = this.getBoardHash(board, turn);

    if (!this.data.positions[hash]) {
      this.data.positions[hash] = { moves: [], seenCount: 0 };
    }

    const pos = this.data.positions[hash];
    pos.seenCount++;

    // Check if move exists
    const existingMove = pos.moves.find(
      (m: BookMove) =>
        m.from.r === move.from.r &&
        m.from.c === move.from.c &&
        m.to.r === move.to.r &&
        m.to.c === move.to.c
    );

    if (existingMove) {
      existingMove.games++;
    } else {
      pos.moves.push({
        from: move.from,
        to: move.to,
        weight: 1,
        games: 1,
      });
    }
  }

  /**
   * Merge another book into this one
   */
  merge(otherBook: OpeningBook | null): void {
    if (!otherBook || !otherBook.data || !otherBook.data.positions) return;

    for (const [hash, pos] of Object.entries(otherBook.data.positions)) {
      if (!this.data.positions[hash]) {
        this.data.positions[hash] = JSON.parse(JSON.stringify(pos));
      } else {
        const myPos = this.data.positions[hash];
        myPos.seenCount += pos.seenCount;

        for (const move of pos.moves) {
          const myMove = myPos.moves.find(
            (m: BookMove) =>
              m.from.r === move.from.r &&
              m.from.c === move.from.c &&
              m.to.r === move.to.r &&
              m.to.c === move.to.c
          );

          if (myMove) {
            myMove.games += move.games;
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
  getBoardHash(board: (Piece | null)[][], turn: string): string {
    const size = board ? board.length : 0;
    if (size === 0) return turn ? turn[0] : '';

    let hash = '';
    for (let r = 0; r < size; r++) {
      if (!board[r]) continue;
      for (let c = 0; c < board[r].length; c++) {
        const piece = board[r][c];
        hash += piece ? `${piece.color[0]}${piece.type}` : '..';
      }
    }
    hash += turn ? turn[0] : '';
    return hash;
  }
}

// Singleton instance for backward compatibility
export const openingBook = new OpeningBook();

/**
 * Legacy function for backward compatibility
 */
export function setOpeningBook(bookData: BookData): void {
  openingBook.load(bookData);
}

/**
 * Legacy function for backward compatibility
 */
export function queryOpeningBook(
  board: (Piece | null)[][],
  moveNumber: number
): { from: Square; to: Square } | null {
  return openingBook.getMove(board, moveNumber);
}
