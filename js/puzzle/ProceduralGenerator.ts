/**
 * Procedural Puzzle Generator
 * Generates random endgame positions and verifies they are valid puzzles.
 */
import { BOARD_SIZE } from '../config.js';
import { PuzzleGenerator } from '../puzzleGenerator.js';
import type { MoveResult } from '../aiEngine.js';
import type { Piece } from '../types/game.js';

type Board = (Piece | null)[][];

interface GeneratedPuzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  setupStr: string;
  solution: MoveResult[];
}

/**
 * Generates a puzzle for a given difficulty.
 */
export class ProceduralGenerator {
  static generatePuzzle(difficulty: string = 'easy'): GeneratedPuzzle | null {
    const depth = difficulty === 'easy' ? 1 : 2;
    const maxAttempts = 500;

    for (let i = 0; i < maxAttempts; i++) {
      const board = this.createRandomPosition(difficulty);
      if (!board) continue;

      if (!this.isPositionLegal(board)) continue;

      const solution = PuzzleGenerator.findMateSequence(board, 'white', depth);

      if (solution) {
        return {
          id: `proc-${Date.now()}-${i}`,
          title: `Generiert: ${difficulty === 'easy' ? 'Matt in 1' : 'Matt in 2'}`,
          description: `Weiß am Zug. Finde das Matt in ${depth} ${depth > 1 ? 'Zügen' : 'Zug'}.`,
          difficulty: difficulty === 'easy' ? 'Einfach' : 'Mittel',
          setupStr: PuzzleGenerator.boardToString(board, 'white'),
          solution: solution,
        };
      }
    }

    return null;
  }

  static createRandomPosition(_difficulty: string): Board {
    const board: Board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    const bk = this.randomSquare();
    board[bk.r][bk.c] = { type: 'k', color: 'black', hasMoved: true };

    let wk;
    do {
      wk = this.randomSquare();
    } while (Math.abs(wk.r - bk.r) <= 1 && Math.abs(wk.c - bk.c) <= 1);
    board[wk.r][wk.c] = { type: 'k', color: 'white', hasMoved: true };

    // Base pieces are guaranteed per difficulty so the structural invariants
    // hold: easy always has a white queen + rook, hard always a rook + bishop.
    const basePieces = _difficulty === 'easy' ? ['q', 'r'] : ['r', 'b'];
    const fairyPieces = ['a', 'c', 'j', 'e'];
    const pieces: string[] = [...basePieces];

    // Add 0-2 extra classic pieces for variety. The pool excludes the base
    // pieces so the invariant "exactly one queen + one rook" (easy) /
    // "exactly one rook + one bishop" (hard) still holds.
    const extraPool = _difficulty === 'easy' ? ['b', 'n', 'p'] : ['q', 'n', 'p'];
    const extraClassic = Math.floor(Math.random() * 3);
    for (let i = 0; i < extraClassic; i++) {
      pieces.push(extraPool[Math.floor(Math.random() * extraPool.length)]);
    }

    // Fairy pieces: easy 0, medium 1, hard 2.
    const fairyCount = _difficulty === 'easy' ? 0 : _difficulty === 'hard' ? 2 : 1;
    for (let i = 0; i < fairyCount; i++) {
      pieces.push(fairyPieces[Math.floor(Math.random() * fairyPieces.length)]);
    }

    // Place all pieces on the board. Pawns may never land on a promotion rank
    // (0 or 8) — same rule as the black defender below.
    for (const type of pieces) {
      let pos;
      do {
        pos = this.randomSquare();
      } while (board[pos.r][pos.c] !== null || (type === 'p' && (pos.r === 0 || pos.r === 8)));
      board[pos.r][pos.c] = { type: type as Piece['type'], color: 'white', hasMoved: true };
    }

    // Add black defender (pawn) with 50% chance
    if (Math.random() > 0.5) {
      let pos;
      do {
        pos = this.randomSquare();
      } while (board[pos.r][pos.c] !== null || pos.r === 0 || pos.r === 8);
      board[pos.r][pos.c] = { type: 'p', color: 'black', hasMoved: true };
    }

    return board;
  }

  static isPositionLegal(_board: Board): boolean {
    return true;
  }

  static randomSquare(): { r: number; c: number } {
    return {
      r: Math.floor(Math.random() * BOARD_SIZE),
      c: Math.floor(Math.random() * BOARD_SIZE),
    };
  }
}
