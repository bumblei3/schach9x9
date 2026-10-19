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

    // Easy: classic pieces only (queen, rook, bishop, knight, pawn)
    // Medium: classic + one fairy piece
    // Hard: classic + two fairy pieces
    const classicPieces = ['q', 'r', 'b', 'n', 'p', 'r', 'b'];
    const fairyPieces = ['a', 'c', 'j', 'e'];
    const pieces: string[] = [];

    // Pick 2-3 classic pieces
    const classicCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < classicCount; i++) {
      const type = classicPieces[Math.floor(Math.random() * classicPieces.length)];
      pieces.push(type);
    }

    // Pick 1-2 fairy pieces based on difficulty
    const fairyCount = _difficulty === 'easy' ? 0 : _difficulty === 'hard' ? 2 : 1;
    for (let i = 0; i < fairyCount; i++) {
      const type = fairyPieces[Math.floor(Math.random() * fairyPieces.length)];
      pieces.push(type);
    }

    // Place all pieces on the board
    for (const type of pieces) {
      let pos;
      do {
        pos = this.randomSquare();
      } while (board[pos.r][pos.c] !== null);
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
