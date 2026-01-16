import { describe, expect, it, vi } from 'vitest';
import { setOpeningBook, queryOpeningBook, OpeningBook } from '../js/ai/OpeningBook.js';
import { logger } from '../js/logger.js';
import { type Piece } from '../js/gameEngine.js';

// Mock logger to avoid clutter
vi.spyOn(logger, 'debug').mockImplementation(function () { });

describe('OpeningBook', () => {
  const mockBoard: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  it('should return null if no book is loaded', () => {
    setOpeningBook(null as any);
    expect(queryOpeningBook(mockBoard as any, 0)).toBeNull();
  });

  it('should return null if move number is >= 10', () => {
    setOpeningBook({ positions: {} } as any);
    expect(queryOpeningBook(mockBoard as any, 10)).toBeNull();
  });

  it('should find a move for a valid position', () => {
    // Construct a specific board
    const board: (Piece | null)[][] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    // Place a white pawn at 4,4
    board[4][4] = { type: 'p', color: 'white' };

    // Calculate expected hash
    let hash = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        hash += p ? `${p.color[0]}${p.type}` : '..';
      }
    }
    hash += 'w'; // White to move

    const mockMoves = [{ from: { r: 4, c: 4 }, to: { r: 3, c: 4 }, weight: 100 }];

    const book = {
      positions: {
        [hash]: { moves: mockMoves },
      },
    };

    setOpeningBook(book as any);
    const move = queryOpeningBook(board as any, 0); // Move 0 is white

    expect(move).toEqual({ from: { r: 4, c: 4 }, to: { r: 3, c: 4 } });
  });

  it('should respect weights in random selection', () => {
    // We can mock Math.random to verify selection logic
    const board: (Piece | null)[][] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    let hash = '';
    for (let i = 0; i < 81; i++) hash += '..';
    hash += 'w';

    const mockMoves = [
      { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 10 }, // Range 0-10
      { from: { r: 2, c: 2 }, to: { r: 3, c: 3 }, weight: 90 }, // Range 10-100
    ];

    const book = {
      positions: { [hash]: { moves: mockMoves } },
    };
    setOpeningBook(book as any);

    // Mock random to pick the first move (low weight)
    // total weight 100. < 10 picks first.
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 * 100 = 5
    const move1 = queryOpeningBook(board as any, 0);
    expect(move1).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });

    // Mock random to pick second
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 * 100 = 50
    const move2 = queryOpeningBook(board as any, 0);
    expect(move2).toEqual({ from: { r: 2, c: 2 }, to: { r: 3, c: 3 } });

    vi.restoreAllMocks();
  });

  describe('OpeningBook Class', () => {
    it('should add moves correctly', () => {
      const book = new OpeningBook();
      const board: (Piece | null)[][] = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      const move = { from: { r: 1, c: 1 }, to: { r: 2, c: 2 } };

      book.addMove(board as any, 'white', move);

      const hash = book.getBoardHash(board as any, 'white');
      expect(book.data.positions[hash]).toBeDefined();
      expect(book.data.positions[hash].moves.length).toBe(1);
      expect(book.data.positions[hash].moves[0].games).toBe(1);

      // Add same move
      book.addMove(board as any, 'white', move);
      expect(book.data.positions[hash].moves[0].games).toBe(2);
    });

    it('should merge books correctly with complex weights', () => {
      const book1 = new OpeningBook();
      const book2 = new OpeningBook();
      const board: (Piece | null)[][] = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      const move1 = { from: { r: 1, c: 1 }, to: { r: 2, c: 2 } };
      const move2 = { from: { r: 3, c: 3 }, to: { r: 4, c: 4 } };

      // Book 1: Move 1 seen 2 times
      book1.addMove(board as any, 'white', move1);
      book1.addMove(board as any, 'white', move1);

      // Book 2: Move 1 seen 3 times, Move 2 seen 5 times
      book2.addMove(board as any, 'white', move1);
      book2.addMove(board as any, 'white', move1); // x2
      book2.addMove(board as any, 'white', move1); // x3
      for (let i = 0; i < 5; i++) book2.addMove(board as any, 'white', move2);

      // Merge
      book1.merge(book2);

      const hash = book1.getBoardHash(board as any, 'white');
      const moves = book1.data.positions[hash].moves;

      expect(moves.length).toBe(2);

      const m1 = moves.find((m: any) => m.from.r === 1);
      const m2 = moves.find((m: any) => m.from.r === 3);

      expect(m1!.games).toBe(5); // 2 + 3
      expect(m2!.games).toBe(5); // 0 + 5
    });
  });
});
