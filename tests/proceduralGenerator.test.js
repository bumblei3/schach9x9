

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
  let ProceduralGenerator;
  let PuzzleGenerator;

  beforeAll(async () => {
    // Import module AFTER mocking
    const pgModule = await import('../js/puzzleGenerator.js');
    PuzzleGenerator = pgModule.PuzzleGenerator;

    const procModule = await import('../js/puzzle/ProceduralGenerator.js');
    ProceduralGenerator = procModule.ProceduralGenerator;
  });

  test('generatePuzzle returns null if no solution found', () => {
    PuzzleGenerator.findMateSequence.mockReturnValue(null);
    const puzzle = ProceduralGenerator.generatePuzzle('easy');
    expect(puzzle).toBeNull();
  });

  test('generatePuzzle returns puzzle if solution found', () => {
    PuzzleGenerator.findMateSequence.mockReturnValue([
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
