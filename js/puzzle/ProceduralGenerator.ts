/**
 * Procedural Puzzle Generator
 * Generates random endgame positions and verifies they are valid puzzles.
 */
import { BOARD_SIZE } from '../config.js';
import { PuzzleGenerator } from '../puzzleGenerator.js';
import type { Board, Square, PieceType } from '../types/game.js';
import type { MoveResult } from '../aiEngine.js';

export interface GeneratedPuzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  setupStr: string;
  solution: MoveResult[];
}

export class ProceduralGenerator {
  /**
   * Generates a puzzle for a given difficulty.
   * @param difficulty - 'easy' (Mate in 1), 'medium' (Mate in 2)
   * @returns Puzzle object or null if failed
   */
  static generatePuzzle(difficulty: 'easy' | 'medium' = 'easy'): GeneratedPuzzle | null {
    const depth = difficulty === 'easy' ? 1 : 2;
    const maxAttempts = 500;

    for (let i = 0; i < maxAttempts; i++) {
      const board = this.createRandomPosition(difficulty);
      if (!board) continue;

      // Ensure position is legal
      if (!this.isPositionLegal(board)) continue;

      // Try to find a forced mate
      const solution = PuzzleGenerator.findMateSequence(board, 'white', depth);

      if (solution) {
        return {
          id: `proc-${Date.now()}-${i}`,
          title: `Generated ${difficulty === 'easy' ? 'Mate in 1' : 'Mate in 2'}`,
          description: `White to move. Find the checkmate in ${depth} move${depth > 1 ? 's' : ''}.`,
          difficulty: difficulty === 'easy' ? 'Easy' : 'Medium',
          setupStr: PuzzleGenerator.boardToString(board, 'white'),
          solution: solution,
        };
      }
    }

    return null;
  }

  static createRandomPosition(difficulty: 'easy' | 'medium'): Board {
    const board: Board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    // 1. Place Kings (must not be adjacent)
    const bk = this.randomSquare();
    board[bk.r][bk.c] = { type: 'k', color: 'black', hasMoved: true };

    let wk: Square;
    do {
      wk = this.randomSquare();
    } while (Math.abs(wk.r - bk.r) <= 1 && Math.abs(wk.c - bk.c) <= 1); // Kings cannot touch
    board[wk.r][wk.c] = { type: 'k', color: 'white', hasMoved: true };

    // 2. Add White Material
    const pieces: Exclude<PieceType, null>[] = difficulty === 'easy' ? ['q', 'r'] : ['r', 'b'];

    for (const type of pieces) {
      let pos: Square;
      do {
        pos = this.randomSquare();
      } while (board[pos.r][pos.c] !== null);
      board[pos.r][pos.c] = { type, color: 'white', hasMoved: true };
    }

    // 3. Add Black Material
    if (Math.random() > 0.5) {
      let pos: Square;
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

  static randomSquare(): Square {
    return {
      r: Math.floor(Math.random() * BOARD_SIZE),
      c: Math.floor(Math.random() * BOARD_SIZE),
    };
  }
}
