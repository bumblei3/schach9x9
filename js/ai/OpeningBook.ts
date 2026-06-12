/**
 * Opening Book for Schach 9x9
 * Manages opening book data with weighted random move selection
 */

import { logger } from '../logger.js';
import type { Square, Piece } from '../gameEngine.js';
import { Game } from '../gameEngine.js';
import { makeMove } from './MoveGenerator.js';
import { PieceType, Player } from '../types/game.js';
import {
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_CHANCELLOR,
  PIECE_ANGEL,
  PIECE_NIGHTRIDER,
  COLOR_WHITE,
  COLOR_BLACK,
  coordsToIndex,
} from './BoardDefinitions.js';

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
  getMove(board: (Piece | null)[][], turn: string): { from: Square; to: Square } | null {
    if (!board || board.length === 0) return turn ? turn[0] : '';

    const hash = this.getBoardHash(board, turn);

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

  /**
   * Apply game result to update opening book weights.
   * Called after each game to reinforce moves that led to victory.
   */
  applyGameResult(
    moveHistory: { from: Square; to: Square; piece: PieceType; captured?: PieceType; promotion?: PieceType }[],
    playerColor: Player,
    result: 'win' | 'loss' | 'draw',
    initialBoard: (Piece | null)[][]
  ): void {
    // Helper: map piece char to internal piece number (without color)
    const pieceCharToNum = (ch: PieceType): number => {
      switch (ch) {
        case 'p': return PIECE_PAWN;
        case 'n': return PIECE_KNIGHT;
        case 'b': return PIECE_BISHOP;
        case 'r': return PIECE_ROOK;
        case 'q': return PIECE_QUEEN;
        case 'k': return PIECE_KING;
        case 'a': return PIECE_ARCHBISHOP;
        case 'c': return PIECE_CHANCELLOR;
        case 'e': return PIECE_ANGEL;
        case 'j': return PIECE_NIGHTRIDER;
        default: return PIECE_NONE;
      }
    };

    // Helper: create a piece number from char and color
    const makePiece = (ch: PieceType, color: Player): number =>
      pieceCharToNum(ch) | (color === 'white' ? COLOR_WHITE : COLOR_BLACK);

    // Deep copy board to avoid mutating original
    const board = initialBoard.map(row => [...row]);

    for (let i = 0; i < moveHistory.length; i++) {
      const move = moveHistory[i];
      const moverColor = i % 2 === 0 ? 'white' : 'black';

      // Calculate weight delta based on game result
      let delta = 0;
      if (result === 'win' && moverColor === playerColor) {
        delta = +2; // winning move gets bonus
      } else if (result === 'loss' && moverColor !== playerColor) {
        delta = -1; // losing move gets small penalty
      }
      // draw: delta = 0

      // Current hash before making the move
      const turn = moverColor;
      const hash = this.getBoardHash(board, turn);
      let pos = this.data.positions[hash];
      if (!pos) {
        pos = { moves: [], seenCount: 0 };
        this.data.positions[hash] = pos;
      }
      pos.seenCount++;

      // Convert our move to internal format for comparison
      const moveFrom = { r: move.from.r, c: move.from.c };
      const moveTo = { r: move.to.r, c: move.to.c };

      // Find existing move in book
      let existing = pos.moves.find(
        (m) =>
          m.from.r === moveFrom.r &&
          m.from.c === moveFrom.c &&
          m.to.r === moveTo.r &&
          m.to.c === moveTo.c
      );

      const baseWeight = 1;
      const newWeight = Math.max(0, baseWeight + delta);

      if (existing) {
        existing.weight = Math.max(0, existing.weight + delta);
        existing.games++;
      } else {
        // Add new move with weighted initial weight
        pos.moves.push({
          from: moveFrom,
          to: moveTo,
          weight: newWeight,
          games: 1,
        });
      }

      // Apply move to board (simple update, assuming no castling/en passant/promotion handling)
      const piece = board[move.from.r][move.from.c];
      if (piece) {
        board[move.to.r][move.to.c] = piece;
        board[move.from.r][move.from.c] = null;
        // Handle promotion
        if (move.promotion) {
          const promoted = makePiece(move.promotion, moverColor);
          board[move.to.r][move.to.c] = promoted;
        }
        // Capture is implicit because we overwrote the target square
      }
    }
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
  return openingBook.getMove(board, moveNumber % 2 === 0 ? 'white' : 'black');
}