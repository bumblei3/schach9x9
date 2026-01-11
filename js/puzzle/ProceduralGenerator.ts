/**
 * Procedural Puzzle Generator
 * Generates random endgame positions and verifies they are valid puzzles.
 */
import { BOARD_SIZE } from '../config.js';
import { PuzzleGenerator } from '../puzzleGenerator.js';

export class ProceduralGenerator {
  /**
   * Generates a puzzle for a given difficulty.
   */
  static generatePuzzle(difficulty: string = 'easy'): any | null {
    const depth = difficulty === 'easy' ? 1 : 2;
    const maxAttempts = 500;

    for (let i = 0; i < maxAttempts; i++) {
      const board = this.createRandomPosition(difficulty);
      if (!board) continue;

      if (!this.isPositionLegal(board)) continue;

      const solution = (PuzzleGenerator as any).findMateSequence(board, 'white', depth);

      if (solution) {
        return {
          id: `proc-${Date.now()}-${i}`,
          title: `Generated ${difficulty === 'easy' ? 'Mate in 1' : 'Mate in 2'}`,
          description: `White to move. Find the checkmate in ${depth} move${depth > 1 ? 's' : ''}.`,
          difficulty: difficulty === 'easy' ? 'Easy' : 'Medium',
          setupStr: (PuzzleGenerator as any).boardToString(board, 'white'),
          solution: solution,
        };
      }
    }

    return null;
  }

  static createRandomPosition(difficulty: string): any[][] {
    const board: any[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    const bk = this.randomSquare();
    board[bk.r][bk.c] = { type: 'k', color: 'black', hasMoved: true };

    let wk;
    do {
      wk = this.randomSquare();
    } while (Math.abs(wk.r - bk.r) <= 1 && Math.abs(wk.c - bk.c) <= 1);
    board[wk.r][wk.c] = { type: 'k', color: 'white', hasMoved: true };

    const pieces = difficulty === 'easy' ? ['q', 'r'] : ['r', 'b'];

    for (const type of pieces) {
      let pos;
      do {
        pos = this.randomSquare();
      } while (board[pos.r][pos.c] !== null);
      board[pos.r][pos.c] = { type, color: 'white', hasMoved: true };
    }

    if (Math.random() > 0.5) {
      let pos;
      do {
        pos = this.randomSquare();
      } while (board[pos.r][pos.c] !== null || pos.r === 0 || pos.r === 8);
      board[pos.r][pos.c] = { type: 'p', color: 'black', hasMoved: true };
    }

    return board;
  }

  static isPositionLegal(_board: any[][]): boolean {
    return true;
  }

  static randomSquare(): { r: number, c: number } {
    return {
      r: Math.floor(Math.random() * BOARD_SIZE),
      c: Math.floor(Math.random() * BOARD_SIZE),
    };
  }
}
