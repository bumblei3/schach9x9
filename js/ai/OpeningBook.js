import { BOARD_SIZE } from '../config.js';
import { logger } from '../logger.js';

// Opening book (loaded from main thread)
let openingBook = null;

export function setOpeningBook(book) {
  openingBook = book;
}

/**
 * Query opening book for a move
 * Returns a move or null if position not in book
 */
export function queryOpeningBook(board, moveNumber) {
  if (!openingBook || !openingBook.positions) {
    return null;
  }

  // Only use book for first 10 moves
  if (moveNumber >= 10) {
    return null;
  }

  const hash = getBoardStringHash(board, moveNumber % 2 === 0 ? 'white' : 'black');

  if (!openingBook.positions[hash]) {
    return null;
  }

  const position = openingBook.positions[hash];
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

  // Fallback to first move
  return { from: moves[0].from, to: moves[0].to };
}

/**
 * Generate a simple string hash for the board (must match trainer)
 */
function getBoardStringHash(board, turn) {
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
