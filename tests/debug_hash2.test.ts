import { describe, it, expect } from 'vitest';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import type { Square, PieceType } from '../js/types/game.js';

describe('Debug Hash Compare', () => {
  it('should compare hashes', () => {
    const initialBoard = Array(9).fill(null).map(() => Array(9).fill(null));
    const pieceTypes = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r', 'a'];
    pieceTypes.forEach((type, c) => {
      initialBoard[0][c] = { type: type, color: 'black', hasMoved: false };
      initialBoard[8][c] = { type: type, color: 'white', hasMoved: false };
    });
    for (let c = 0; c < 9; c++) {
      initialBoard[1][c] = { type: 'p', color: 'black', hasMoved: false };
      initialBoard[7][c] = { type: 'p', color: 'white', hasMoved: false };
    }

    const book = new OpeningBook();

    const moveHistory: { from: Square; to: Square; piece: PieceType; captured?: PieceType; promotion?: PieceType }[] = [
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' },      // White e4
      { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' },      // Black e5
      { from: { r: 7, c: 3 }, to: { r: 5, c: 3 }, piece: 'p' },      // White d4
      { from: { r: 1, c: 3 }, to: { r: 3, c: 3 }, piece: 'p' },      // Black d5
      { from: { r: 5, c: 4 }, to: { r: 4, c: 4 }, piece: 'p' },      // White e4->e5
      { from: { r: 3, c: 3 }, to: { r: 4, c: 4 }, piece: 'p', captured: 'p' }, // Black d5xe4
    ];

    book.applyGameResult(moveHistory, 'white', 'win', initialBoard);

    // Now check what hash my test simulation produces for move 2
    const board = initialBoard.map(row => [...row]);
    board[5][4] = board[7][4]; board[7][4] = null; // White e4
    board[3][4] = board[1][4]; board[1][4] = null; // Black e5
    
    const testHash = book.getBoardHash(board, 'white');
    console.log('Test hash for move 2:', testHash);
    
    // Check stored hashes
    console.log('Stored hashes:');
    for (const hash of Object.keys(book.data.positions)) {
      if (hash.includes('bp..................................wp')) {
        console.log('  Matching stored hash:', hash);
        console.log('  Match?', hash === testHash);
      }
    }

    // Also check the actual board string representation
    console.log('Test board state after e4,e5:');
    let boardStr = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        boardStr += p ? `${p.color[0]}${p.type}` : '..';
      }
    }
    boardStr += 'w';
    console.log('Test board hash:', boardStr);
    
    expect(true).toBe(true); // Just for debug
  });
});
