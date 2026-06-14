import { describe, it, expect } from 'vitest';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import type { Square, PieceType } from '../js/types/game.js';

describe('Debug Hash', () => {
  it('should show hashes', () => {
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

    console.log('Stored positions:');
    for (const [hash, pos] of Object.entries(book.data.positions)) {
      console.log(`Hash: ${hash}`);
      console.log(`  Moves: ${JSON.stringify(pos.moves)}`);
      console.log(`  Seen: ${pos.seenCount}`);
    }

    expect(Object.keys(book.data.positions).length).toBeGreaterThan(0);
  });
});
