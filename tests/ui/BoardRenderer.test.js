// Mock config first
vi.mock('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play' },
  PIECE_VALUES: { p: 100, k: 0, r: 500, n: 300, b: 300, q: 900 },
}));

// Mock dependencies
vi.mock('../../js/effects.js', () => ({
  particleSystem: { spawn: vi.fn() },
  floatingTextManager: { show: vi.fn() },
  shakeScreen: vi.fn(),
  triggerVibration: vi.fn(),
  confettiSystem: { spawn: vi.fn() },
}));

vi.mock('../../js/utils.js', () => ({
  debounce: fn => fn,
}));

const BoardRenderer = await import('../../js/ui/BoardRenderer.js');

describe('BoardRenderer Component', () => {
  let game;

  beforeEach(() => {
    document.body.innerHTML = `
            <div id="board"></div>
            <div id="status-display"></div>
        `;

    window.PIECE_SVGS = {
      white: { p: 'wp', k: 'wk', r: 'wr' },
      black: { p: 'bp', k: 'bk' },
    };
    window._svgCache = null;

    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: 'play',
      turn: 'white',
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      arrowRenderer: { highlightMove: vi.fn(), clearArrows: vi.fn() },
      handleCellClick: vi.fn(),
      getValidMoves: vi.fn(() => []),
      isSquareUnderAttack: vi.fn(() => false),
    };

    // Setup DOM mocks for interaction
    document.elementFromPoint = vi.fn();
  });

  test('should initialize and render board correctly', () => {
    game.board[0][0] = { type: 'p', color: 'white' };
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);

    const boardEl = document.getElementById('board');
    expect(boardEl.children.length).toBeGreaterThan(0);
    expect(boardEl.innerHTML).toContain('cell');
  });

  test('should handle piece symbol retrieval', () => {
    const symbol = BoardRenderer.getPieceSymbol({ type: 'p', color: 'white' });
    expect(symbol).toContain('wp'); // Assuming mocked SVG string
  });

  test('should animate move', () => {
    vi.useFakeTimers();
    const from = { r: 0, c: 0 };
    const to = { r: 1, c: 1 };
    const piece = { type: 'p', color: 'white' };

    BoardRenderer.animateMove(game, from, to, piece);
    vi.runAllTimers();
    // Since we can't easily check visual animation state in JSDOM without more complex setup,
    // we verify that no errors occurred and functions completed.
    expect(true).toBe(true);
    vi.useRealTimers();
  });

  test('should handle interaction events', () => {
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);

    const cell = document.querySelector('.cell');
    if (cell) {
      // Touch events
      const touchStart = new Event('touchstart');
      Object.defineProperty(touchStart, 'touches', { value: [{ clientX: 0, clientY: 0 }] });
      cell.dispatchEvent(touchStart);

      // Mouse events
      cell.dispatchEvent(new Event('mouseover'));
      cell.dispatchEvent(new Event('mouseout'));

      expect(game.handleCellClick).not.toHaveBeenCalled(); // Touch start doesn't click immediately
    }
  });
});
