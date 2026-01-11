import { logger } from '../logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class OpeningBook {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(data: any = { positions: {} }) {
    this.data = data;
  }

  /**
   * Load book data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load(data: any): void {
    this.data = data || { positions: {} };
  }

  /**
   * Query for a move
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMove(board: any, moveNumber: number): any | null {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalWeight = moves.reduce((sum: number, m: any) => sum + m.weight, 0);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addMove(board: any, turn: string, move: any): void {
    const hash = this.getBoardHash(board, turn);

    if (!this.data.positions[hash]) {
      this.data.positions[hash] = { moves: [], seenCount: 0 };
    }

    const pos = this.data.positions[hash];
    pos.seenCount++;

    // Check if move exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingMove = pos.moves.find(
      (m: any) =>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  merge(otherBook: any): void {
    if (!otherBook || !otherBook.data || !otherBook.data.positions) return;

    for (const [hash, pos] of Object.entries(otherBook.data.positions)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!this.data.positions[hash]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.data.positions[hash] = JSON.parse(JSON.stringify(pos));
      } else {
        const myPos = this.data.positions[hash];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        myPos.seenCount += (pos as any).seenCount;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const move of (pos as any).moves) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const myMove = myPos.moves.find(
            (m: any) =>
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
   * Detects board size from the array rather than using constant
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getBoardHash(board: any, turn: string): string {
    // Detect actual board size from the array
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

// Singleton instance for backward compatibility or global usage
export const openingBook = new OpeningBook();

// Export legacy functions for compatibility if needed (deprecated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setOpeningBook(bookData: any): void {
  openingBook.load(bookData);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function queryOpeningBook(board: any, moveNumber: number): any {
  return openingBook.getMove(board, moveNumber);
}
