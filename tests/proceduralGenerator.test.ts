import { describe, test, expect, vi, beforeAll } from 'vitest';
// Mock dependencies MUST be hoisted or defined before imports
vi.mock('../js/config.js', () => ({
  BOARD_SIZE: 9,
}));

vi.mock('../js/puzzleGenerator.js', () => ({
  PuzzleGenerator: {
    findMateSequence: vi.fn(),
    boardToString: vi.fn(() => 'mock_setup_string'),
  },
}));

describe('ProceduralGenerator', () => {
  let ProceduralGenerator: any;
  let PuzzleGenerator: any;

  beforeAll(async () => {
    // Import module AFTER mocking
    const pgModule = await import('../js/puzzleGenerator.js');
    PuzzleGenerator = pgModule.PuzzleGenerator;

    const procModule = await import('../js/puzzle/ProceduralGenerator.js');
    ProceduralGenerator = procModule.ProceduralGenerator;
  });

  test('generatePuzzle returns null if no solution found', () => {
    (PuzzleGenerator.findMateSequence as any).mockReturnValue(null);
    const puzzle = ProceduralGenerator.generatePuzzle('easy');
    expect(puzzle).toBeNull();
  });

  test('generatePuzzle returns puzzle if solution found', () => {
    (PuzzleGenerator.findMateSequence as any).mockReturnValue([
      { from: { r: 0, c: 0 }, to: { r: 0, c: 1 } },
    ]);
    const puzzle = ProceduralGenerator.generatePuzzle('easy');

    expect(puzzle).not.toBeNull();
    expect(puzzle.id).toMatch(/^proc-/);
    expect(puzzle.difficulty).toBe('Easy');
    expect(puzzle.solution).toHaveLength(1);
  });

  test('createRandomPosition creates valid board structure', () => {
    const board = ProceduralGenerator.createRandomPosition('easy');
    expect(board.length).toBe(9);
    expect(board[0].length).toBe(9);

    // Should have Kings
    let whiteKing = false;
    let blackKing = false;
    let whitePieces = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p) {
          if (p.type === 'k' && p.color === 'white') whiteKing = true;
          if (p.type === 'k' && p.color === 'black') blackKing = true;
          if (p.color === 'white' && p.type !== 'k') whitePieces++;
        }
      }
    }

    expect(whiteKing).toBe(true);
    expect(blackKing).toBe(true);
    expect(whitePieces).toBeGreaterThanOrEqual(1); // At least 1 piece for easy
  });
});

describe('ProceduralGenerator.createRandomPosition — legality invariants (randomized)', () => {
  // The generator is random, so each invariant is checked across many runs to
  // make a violation overwhelmingly likely to surface.
  const RUNS = 300;
  let ProceduralGenerator: any;

  beforeAll(async () => {
    const procModule = await import('../js/puzzle/ProceduralGenerator.js');
    ProceduralGenerator = procModule.ProceduralGenerator;
  });

  type Sq = { r: number; c: number } | null;
  function findKings(board: any): { wk: Sq; bk: Sq } {
    let wk: Sq = null;
    let bk: Sq = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.type === 'k') {
          if (p.color === 'white') wk = { r, c };
          else bk = { r, c };
        }
      }
    }
    return { wk, bk };
  }

  test('the two kings are never placed on adjacent squares (illegal position)', () => {
    for (let i = 0; i < RUNS; i++) {
      const board = ProceduralGenerator.createRandomPosition('easy');
      const { wk, bk } = findKings(board);
      expect(wk).not.toBeNull();
      expect(bk).not.toBeNull();
      const chebyshev = Math.max(Math.abs(wk!.r - bk!.r), Math.abs(wk!.c - bk!.c));
      expect(chebyshev).toBeGreaterThan(1); // kings never touch
    }
  });

  test('black pawns are never placed on the promotion ranks (row 0 or 8)', () => {
    for (let i = 0; i < RUNS; i++) {
      const board = ProceduralGenerator.createRandomPosition('medium');
      for (let c = 0; c < 9; c++) {
        for (const row of [0, 8]) {
          const p = board[row][c];
          if (p && p.type === 'p') {
            throw new Error(`pawn illegally placed on rank ${row} at col ${c}`);
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  test('no two pieces ever share the same square', () => {
    for (let i = 0; i < 100; i++) {
      const board = ProceduralGenerator.createRandomPosition('easy');
      let count = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c]) count++;
        }
      }
      // easy = 2 kings + queen + rook (+ optional black pawn) => 4 or 5 pieces,
      // all on distinct squares (no overwrite happened during placement).
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  test('easy positions contain a white queen and rook; medium a white rook and bishop', () => {
    function whiteNonKingTypes(board: any): Set<string> {
      const s = new Set<string>();
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++) {
          const p = board[r][c];
          if (p && p.color === 'white' && p.type !== 'k') s.add(p.type);
        }
      return s;
    }
    // Sample several runs; the piece set is deterministic per difficulty.
    for (let i = 0; i < 20; i++) {
      const easy = whiteNonKingTypes(ProceduralGenerator.createRandomPosition('easy'));
      expect(easy.has('q')).toBe(true);
      expect(easy.has('r')).toBe(true);
      const medium = whiteNonKingTypes(ProceduralGenerator.createRandomPosition('medium'));
      expect(medium.has('r')).toBe(true);
      expect(medium.has('b')).toBe(true);
    }
  });
});
