/**
 * Puzzle Generator for Schach 9x9
 * Generates puzzles (e.g., Mate in 2) from board positions
 */

import { BOARD_SIZE } from './config.js';
import * as AIEngine from './aiEngine.js';
import { deepCopy } from './utils.js';
import type { Board, Player, Piece } from './types/game.js';
import type { MoveResult } from './aiEngine.js';

export class PuzzleGenerator {
  /**
   * Converts a 9x9 board to a string representation (81 chars + turn)
   */
  static boardToString(board: Board, turn: Player): string {
    let str = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        str += piece ? `${piece.color[0]}${piece.type}` : '..';
      }
    }
    str += turn[0];
    return str;
  }

  /**
   * Converts the string representation back to a 9x9 board
   */
  static stringToBoard(str: string): { board: Board; turn: Player } {
    const board: Board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / BOARD_SIZE);
      const c = i % BOARD_SIZE;
      const pieceStr = str.substring(i * 2, i * 2 + 2);
      if (pieceStr !== '..') {
        board[r][c] = {
          color: pieceStr[0] === 'w' ? 'white' : 'black',
          type: pieceStr[1] as any, // Cast to PieceType if necessary
          hasMoved: true, // Assumption for puzzles
        } as Piece;
      }
    }
    const turn: Player = str[162] === 'w' ? 'white' : 'black';
    return { board, turn };
  }

  /**
   * Finds a forced mate in X moves
   * @param board
   * @param turn
   * @param depth - Number of full moves (e.g., 2 for Mate in 2)
   * @returns Array of moves for the solution or null
   */
  static findMateSequence(board: Board, turn: Player, depth: number): MoveResult[] | null {
    return this._searchMate(deepCopy(board), turn, depth * 2);
  }

  private static _searchMate(board: Board, turn: Player, ply: number): MoveResult[] | null {
    const moves = AIEngine.getAllLegalMoves(board, turn);
    const opponentColor: Player = turn === 'white' ? 'black' : 'white';

    for (const move of moves) {
      // Apply move
      const fromPiece = board[move.from.r][move.from.c];
      const targetPiece = board[move.to.r][move.to.c];
      board[move.to.r][move.to.c] = fromPiece;
      board[move.from.r][move.from.c] = null;

      // Check if checkmate
      const isMate =
        AIEngine.getAllLegalMoves(board, opponentColor).length === 0 &&
        AIEngine.isInCheck(board, opponentColor);

      if (isMate) {
        if (ply >= 1) {
          // Undo move
          board[move.from.r][move.from.c] = fromPiece;
          board[move.to.r][move.to.c] = targetPiece;
          return [move];
        }
      }

      if (ply > 1) {
        // Check all opponent responses
        const responses = AIEngine.getAllLegalMoves(board, opponentColor);
        let allResponsesLeadToMate = responses.length > 0;
        let fastestSolution: MoveResult[] | null = null;

        for (const response of responses) {
          // Apply response
          const rPiece = board[response.from.r][response.from.c];
          const rtPiece = board[response.to.r][response.to.c];
          board[response.to.r][response.to.c] = rPiece;
          board[response.from.r][response.from.c] = null;

          const followUp = this._searchMate(board, turn, ply - 2);

          // Undo response
          board[response.from.r][response.from.c] = rPiece;
          board[response.to.r][response.to.c] = rtPiece;

          if (!followUp) {
            allResponsesLeadToMate = false;
            break;
          } else {
            if (!fastestSolution || followUp.length < fastestSolution.length) {
              fastestSolution = followUp;
            }
          }
        }

        if (allResponsesLeadToMate && fastestSolution) {
          // Undo move before returning
          board[move.from.r][move.from.c] = fromPiece;
          board[move.to.r][move.to.c] = targetPiece;
          return [move, ...fastestSolution];
        }
      }

      // Undo move
      board[move.from.r][move.from.c] = fromPiece;
      board[move.to.r][move.to.c] = targetPiece;
    }

    return null;
  }
}
