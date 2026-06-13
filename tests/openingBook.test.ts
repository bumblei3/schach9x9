import { describe, expect, it, vi, beforeEach } from 'vitest';
import { setOpeningBook, queryOpeningBook, OpeningBook } from '../js/ai/OpeningBook.js';
import { logger } from '../js/logger.js';
import { type Piece } from '../js/gameEngine.js';
import { PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN, PIECE_KING, COLOR_WHITE, COLOR_BLACK } from '../js/ai/BoardDefinitions.js';

// Mock logger to avoid clutter
vi.spyOn(logger, 'debug').mockImplementation(function () {});

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

  describe('applyGameResult', () => {
    let book: OpeningBook;
    let initialBoard: (Piece | null)[][];

    beforeEach(() => {
      book = new OpeningBook();
      // Standard 9x9 starting position
      initialBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      // Back rank pieces
      const pieceTypes = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r', 'a'];
      pieceTypes.forEach((type, c) => {
        initialBoard[0][c] = { type: type as any, color: 'black', hasMoved: false };
        initialBoard[8][c] = { type: type as any, color: 'white', hasMoved: false };
      });
      // Pawns
      for (let c = 0; c < 9; c++) {
        initialBoard[1][c] = { type: 'p', color: 'black', hasMoved: false };
        initialBoard[7][c] = { type: 'p', color: 'white', hasMoved: false };
      }
    });

    it('should add winning moves with increased weight for white win', () => {
      // White plays e4 (7,4 -> 5,4), black plays e5 (1,4 -> 3,4)
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },      // White e4
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },      // Black e5
        { from: { r: 7, c: 3 }, to: { r: 5, c: 3 }, piece: 'p' as const },      // White d4
        { from: { r: 1, c: 3 }, to: { r: 3, c: 3 }, piece: 'p' as const },      // Black d5
        { from: { r: 5, c: 4 }, to: { r: 4, c: 4 }, piece: 'p' as const },      // White e4xd5
        { from: { r: 3, c: 3 }, to: { r: 4, c: 4 }, piece: 'p' as const, captured: 'p' as const }, // Black d5xe4
      ];

      book.applyGameResult(moveHistory, 'white', 'win', initialBoard);

      // Check that white's winning moves got +2 weight
      // Move 0: White e4
      let hash = book.getBoardHash(initialBoard, 'white');
      let pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      let move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 4 && m.to.r === 5 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3); // base 1 + 2 for win = 3
      expect(move!.games).toBe(1);

      // Move 2: White d4
      // Need to simulate board after 2 moves (e4, e5)
      let board = initialBoard.map(row => [...row]);
      board[5][4] = board[7][4]; board[7][4] = null; // White e4
      board[3][4] = board[1][4]; board[1][4] = null; // Black e5
      hash = book.getBoardHash(board, 'white');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 3 && m.to.r === 5 && m.to.c === 3);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3);

      // Move 4: White e4->e5
      // Board after moves 0-3 (e4, e5, d4, d5)
      board = board.map(row => [...row]);
      board[5][3] = board[7][3]; board[7][3] = null; // White d4
      board[3][3] = board[1][3]; board[1][3] = null; // Black d5
      // Hash is computed BEFORE move 4, so use this board state
      hash = book.getBoardHash(board, 'white');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 5 && m.from.c === 4 && m.to.r === 4 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3);
    });

    it('should add losing moves with decreased weight for white loss', () => {
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },      // White e4 (move 0)
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },      // Black e5 (move 1)
        { from: { r: 7, c: 3 }, to: { r: 6, c: 3 }, piece: 'p' as const },      // White d3 (move 2, bad)
        { from: { r: 1, c: 3 }, to: { r: 3, c: 3 }, piece: 'p' as const },      // Black d5 (move 3)
      ];

      book.applyGameResult(moveHistory, 'white', 'loss', initialBoard);

      // Move 0: White e4 - hash from initial position, turn='white'
      let hash = book.getBoardHash(initialBoard, 'white');
      let pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      let move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 4 && m.to.r === 5 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(0); // base 1 - 1 = 0 (white lost)

      // Move 1: Black e5 - hash after White e4, turn='black'
      let board = initialBoard.map(row => [...row]);
      board[5][4] = board[7][4]; board[7][4] = null; // White e4
      hash = book.getBoardHash(board, 'black');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 1 && m.from.c === 4 && m.to.r === 3 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3); // base 1 + 2 = 3 (black won!)

      // Move 2: White d3 - hash after White e4, Black e5, turn='white'
      board = board.map(row => [...row]);
      board[3][4] = board[1][4]; board[1][4] = null; // Black e5
      hash = book.getBoardHash(board, 'white');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 3 && m.to.r === 6 && m.to.c === 3);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(0); // base 1 - 1 = 0 (white lost)

      // Move 3: Black d5 - hash after White e4, Black e5, White d3, turn='black'
      board = board.map(row => [...row]);
      board[6][3] = board[7][3]; board[7][3] = null; // White d3
      hash = book.getBoardHash(board, 'black');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 1 && m.from.c === 3 && m.to.r === 3 && m.to.c === 3);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3); // base 1 + 2 = 3 (black won!)
    });

    it('should not change weights for drawn games', () => {
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },      // White e4 (move 0)
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },      // Black e5 (move 1)
      ];

      book.applyGameResult(moveHistory, 'white', 'draw', initialBoard);

      // Move 0: White e4 - hash from initial position, turn='white'
      let hash = book.getBoardHash(initialBoard, 'white');
      let pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      let move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 4 && m.to.r === 5 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(1); // base 1 + 0 = 1 (draw)

      // Move 1: Black e5 - hash after White e4, turn='black'
      const board = initialBoard.map(row => [...row]);
      board[5][4] = board[7][4]; board[7][4] = null; // White e4
      hash = book.getBoardHash(board, 'black');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 1 && m.from.c === 4 && m.to.r === 3 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(1); // base 1 + 0 = 1 (draw)
    });

    it('should handle promotion moves correctly', () => {
      // White promotes pawn to queen
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },
        { from: { r: 5, c: 4 }, to: { r: 4, c: 4 }, piece: 'p' as const },
        { from: { r: 3, c: 4 }, to: { r: 4, c: 4 }, piece: 'p' as const, captured: 'p' as const },
        { from: { r: 4, c: 4 }, to: { r: 0, c: 4 }, piece: 'p' as const, promotion: 'q' as const }, // promotion
      ];

      book.applyGameResult(moveHistory, 'white', 'win', initialBoard);

      // Simulate board up to promotion move (move 4)
      // Moves 0-3: e4, e5, e4->e5, exd4 (black captures)
      // Wait, let's trace:
      // Move 0: White e4 (7,4->5,4)
      // Move 1: Black e5 (1,4->3,4)
      // Move 2: White e4->e5 (5,4->4,4) - forward, but e5 occupied? Illegal but recorded
      // Move 3: Black e5xe4 (3,4->4,4) - capture
      // Move 4: White e5->e8 promotion (4,4->0,4) with promotion to queen
      
      // Board BEFORE move 4: after moves 0-3
      const board = initialBoard.map(row => [...row]);
      board[5][4] = board[7][4]; board[7][4] = null; // White e4
      board[3][4] = board[1][4]; board[1][4] = null; // Black e5
      board[4][4] = board[5][4]; board[5][4] = null; // White e4->e5
      board[4][4] = board[3][4]; board[3][4] = null; // Black captures on e5
      
      // Hash for move 4 (promotion) with turn='white' (since move index 4 is even -> white)
      const hash = book.getBoardHash(board, 'white');
      const pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      // Should have recorded the promotion move with win bonus
      const move = pos!.moves.find(m => m.from.r === 4 && m.from.c === 4 && m.to.r === 0 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3);
    });

    it('should increment games count for repeated moves', () => {
      // Same game played twice (white wins both)
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },      // White e4 (move 0)
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },      // Black e5 (move 1)
      ];

      book.applyGameResult(moveHistory, 'white', 'win', initialBoard);
      book.applyGameResult(moveHistory, 'white', 'win', initialBoard);

      // Move 0: White e4 - hash from initial position, turn='white'
      let hash = book.getBoardHash(initialBoard, 'white');
      let pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      let move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 4 && m.to.r === 5 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.games).toBe(2); // Played twice
      expect(move!.weight).toBe(5); // 1 + 2 + 2 = 5 (base + win + win)

      // Move 1: Black e5 - hash after White e4, turn='black'
      const board = initialBoard.map(row => [...row]);
      board[5][4] = board[7][4]; board[7][4] = null; // White e4
      hash = book.getBoardHash(board, 'black');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 1 && m.from.c === 4 && m.to.r === 3 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.games).toBe(2);
      expect(move!.weight).toBe(0); // 1 - 1 - 1 = -1 -> clamped to 0 (black lost both games)
    });

    it('should handle black win correctly (black moves get bonus)', () => {
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const },      // White e4 (move 0)
        { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const },      // Black e5 (move 1)
        { from: { r: 7, c: 3 }, to: { r: 5, c: 3 }, piece: 'p' as const },      // White d4 (move 2)
        { from: { r: 1, c: 3 }, to: { r: 2, c: 3 }, piece: 'p' as const },      // Black d4 (move 3, winning move)
      ];

      book.applyGameResult(moveHistory, 'black', 'win', initialBoard);

      // Move 0: White e4 - hash from initial position, turn='white' (white lost -> -1)
      let hash = book.getBoardHash(initialBoard, 'white');
      let pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      let move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 4 && m.to.r === 5 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(0); // base 1 - 1 = 0 (white lost)

      // Move 1: Black e5 - hash after White e4, turn='black' (black won -> +2)
      let board = initialBoard.map(row => [...row]);
      board[5][4] = board[7][4]; board[7][4] = null; // White e4
      hash = book.getBoardHash(board, 'black');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 1 && m.from.c === 4 && m.to.r === 3 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3); // base 1 + 2 = 3 (black won)

      // Move 2: White d4 - hash after White e4, Black e5, turn='white' (white lost -> -1)
      board = board.map(row => [...row]);
      board[3][4] = board[1][4]; board[1][4] = null; // Black e5
      hash = book.getBoardHash(board, 'white');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 3 && m.to.r === 5 && m.to.c === 3);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(0); // base 1 - 1 = 0 (white lost)

      // Move 3: Black d4 - hash after White e4, Black e5, White d4, turn='black' (black won -> +2)
      board = board.map(row => [...row]);
      board[5][3] = board[7][3]; board[7][3] = null; // White d4
      hash = book.getBoardHash(board, 'black');
      pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      move = pos!.moves.find(m => m.from.r === 1 && m.from.c === 3 && m.to.r === 2 && m.to.c === 3);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3); // base 1 + 2 = 3 (black won)
    });

    it('should handle empty move history gracefully', () => {
      book.applyGameResult([], 'white', 'win', initialBoard);
      expect(Object.keys(book.data.positions).length).toBe(0);
    });

    it('should handle single move game', () => {
      const moveHistory = [
        { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const }, // White e4
      ];

      book.applyGameResult(moveHistory, 'white', 'win', initialBoard);

      const hash = book.getBoardHash(initialBoard, 'white');
      const pos = book.data.positions[hash];
      expect(pos).toBeDefined();
      const move = pos!.moves.find(m => m.from.r === 7 && m.from.c === 4 && m.to.r === 5 && m.to.c === 4);
      expect(move).toBeDefined();
      expect(move!.weight).toBe(3);
      expect(move!.games).toBe(1);
    });

    it('should handle all piece types correctly in applyGameResult', () => {
      // Test that pieceCharToNum switch covers all piece types
      const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e', 'j'] as const;
      const startRow = 7;
      const startCol = 0;

      // Create a fresh book for each piece type test
      const testBook = new OpeningBook();

      for (let i = 0; i < pieceTypes.length; i++) {
        const pieceType = pieceTypes[i];
        const moveHistory = [
          { from: { r: startRow, c: startCol + i }, to: { r: startRow - 2, c: startCol + i }, piece: pieceType },
        ];

        testBook.applyGameResult(moveHistory, 'white', 'win', initialBoard);

        const boardState = initialBoard.map(row => [...row]);
        boardState[startRow - 2][startCol + i] = boardState[startRow][startCol + i];
        boardState[startRow][startCol + i] = null;

        const hash = testBook.getBoardHash(boardState, 'white'); // Move index 1 would be black, but we only have 1 move
        // Wait - the hash is computed BEFORE the move is made, so turn is 'white' for move 0
        const hashBeforeMove = testBook.getBoardHash(initialBoard, 'white');
        const pos = testBook.data.positions[hashBeforeMove];
        
        expect(pos).toBeDefined();
        // The move should be recorded with weight 3 (base 1 + 2 for win)
        const move = pos!.moves.find(
          m => m.from.r === startRow && m.from.c === startCol + i && 
               m.to.r === startRow - 2 && m.to.c === startCol + i
        );
        expect(move).toBeDefined();
        expect(move!.weight).toBe(3);
        expect(move!.games).toBe(1);
      }
    });

    it('should handle pieces with captured field correctly for all types', () => {
      const testBook = new OpeningBook();
      const pieceTypes = ['n', 'b', 'r', 'q', 'k', 'a', 'c', 'e', 'j'] as const;

      for (let i = 0; i < pieceTypes.length; i++) {
        const pieceType = pieceTypes[i];
        const moveHistory = [
          { from: { r: 7, c: 4 }, to: { r: 5, c: 4 }, piece: 'p' as const }, // White e4
          { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, piece: 'p' as const }, // Black e5
          { from: { r: 7, c: 4 + i }, to: { r: 3, c: 4 + i }, piece: pieceType, captured: 'p' as const }, // Capture
        ];

        testBook.applyGameResult(moveHistory, 'white', 'win', initialBoard);

        // Simulate board state before capture move (move index 2 = white)
        const board = initialBoard.map(row => [...row]);
        board[5][4] = board[7][4]; board[7][4] = null; // White e4
        board[3][4] = board[1][4]; board[1][4] = null; // Black e5

        const hash = testBook.getBoardHash(board, 'white');
        const pos = testBook.data.positions[hash];
        expect(pos).toBeDefined();

        const move = pos!.moves.find(
          m => m.from.r === 7 && m.from.c === 4 + i && m.to.r === 3 && m.to.c === 4 + i
        );
        expect(move).toBeDefined();
        expect(move!.weight).toBe(3); // Winner's move gets +2
      }
    });

    it('should handle promotion to all piece types', () => {
      // Test that pieceCharToNum switch covers all piece types for promotion
      const promotionTypes = ['q', 'r', 'b', 'n', 'a', 'c', 'e', 'j'] as const;
      const testBook = new OpeningBook();

      for (let i = 0; i < promotionTypes.length; i++) {
        const promotionType = promotionTypes[i];
        // Create a fresh board with a pawn on 7th rank ready to promote
        const promoBoard = initialBoard.map(row => [...row]);
        promoBoard[1][4 + i] = { type: 'p', color: 'white', hasMoved: false };
        // Clear path
        promoBoard[2][4 + i] = null;
        promoBoard[3][4 + i] = null;
        promoBoard[4][4 + i] = null;
        promoBoard[5][4 + i] = null;
        promoBoard[6][4 + i] = null;

        const moveHistory = [
          { from: { r: 1, c: 4 + i }, to: { r: 0, c: 4 + i }, piece: 'p' as const, promotion: promotionType },
        ];

        testBook.applyGameResult(moveHistory, 'white', 'win', promoBoard);

        // Hash before promotion move (white to move)
        const hash = testBook.getBoardHash(promoBoard, 'white');
        const pos = testBook.data.positions[hash];
        expect(pos).toBeDefined();

        const move = pos!.moves.find(
          m => m.from.r === 1 && m.from.c === 4 + i && m.to.r === 0 && m.to.c === 4 + i
        );
        expect(move).toBeDefined();
        expect(move!.weight).toBe(3); // Winner's move gets +2
        
        // Verify the promoted piece was correctly created on the board
        // by checking the internal board state after applyGameResult
        // (we can't easily check the internal board, but the fact that it didn't throw is good)
      }
    });
  });
});
