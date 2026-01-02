import { setOpeningBook, queryOpeningBook } from '../js/ai/OpeningBook.js';
import { logger } from '../js/logger.js';
import { jest } from '@jest/globals';

// Mock logger to avoid clutter
jest.spyOn(logger, 'debug').mockImplementation(() => {});

describe('OpeningBook', () => {
  const mockBoard = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // Helper to setup board for hash generation test
  // board[r][c] = { type: 'p', color: 'white' }
  const _setupBoard = () => {
    const board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    board[8][4] = { type: 'k', color: 'white' };
    board[0][4] = { type: 'k', color: 'black' };
    return board;
  };

  const _mockBookData = {
    positions: {
      // Simplified hash for: White King at 8,4; Black King at 0,4; White to move (w)
      // The hash generation loop is: r0..r8, c0..c8.
      // r0c4 = bk, r8c4 = wk.
      // We need to construct the hash string carefully or just trust the internal logic if we can mock it?
      // Actually, let's rely on the fact that we can pass a hash if we knew it.
      // But queryOpeningBook calculates the hash internally.
      // Let's create a known board state and calculate what the hash SHOULD be based on code reading.
      // Hash logic: iterate r0->8, c0->8. piece: color[0] + type. empty: '..'. append turn[0].
      // r0c4 is 'bk', r8c4 is 'wk'. all others '..'
      // So tons of '..' then 'w' at end.
    },
  };

  // Let's create a simpler test that doesn't rely on the perfect hash string construction
  // by mocking the internal getBoardStringHash if possible?
  // No, valid tests should treat internals as black box if possible, OR we replicate the logic.
  // The logic is simple enough.

  it('should return null if no book is loaded', () => {
    setOpeningBook(null);
    expect(queryOpeningBook(mockBoard, 0)).toBeNull();
  });

  it('should return null if move number is >= 10', () => {
    setOpeningBook({ positions: {} });
    expect(queryOpeningBook(mockBoard, 10)).toBeNull();
  });

  it('should find a move for a valid position', () => {
    // Construct a specific board
    const board = Array(9)
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

    setOpeningBook(book);
    const move = queryOpeningBook(board, 0); // Move 0 is white

    expect(move).toEqual({ from: { r: 4, c: 4 }, to: { r: 3, c: 4 } });
  });

  it('should respect weights in random selection', () => {
    // We can mock Math.random to verify selection logic
    const board = Array(9)
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
    setOpeningBook(book);

    // Mock random to pick the first move (low weight)
    // total weight 100. < 10 picks first.
    jest.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 * 100 = 5
    const move1 = queryOpeningBook(board, 0);
    expect(move1).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });

    // Mock random to pick second
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 * 100 = 50
    const move2 = queryOpeningBook(board, 0);
    expect(move2).toEqual({ from: { r: 2, c: 2 }, to: { r: 3, c: 3 } });

    jest.restoreAllMocks();
  });
});
