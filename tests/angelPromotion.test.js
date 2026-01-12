

// Mock AudioContext
global.window.AudioContext = vi.fn().mockImplementation(() => ({
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: {
      value: 0,
      linearRampToValueAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }),
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    type: 'sine',
  }),
  currentTime: 0,
  destination: {},
}));
global.window.webkitAudioContext = global.window.AudioContext;

// Mock PIECE_SVGS
global.window.PIECE_SVGS = {
  white: { p: 'wp', n: 'wn', b: 'wb', r: 'wr', q: 'wq', k: 'wk', e: 'we' },
  black: { p: 'bp', n: 'bn', b: 'bb', r: 'br', q: 'bq', k: 'bk', e: 'be' },
};

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(() => Promise.resolve(0)),
  findKing: vi.fn(() => ({ r: 0, c: 0 })), // Mock findKing
}));

vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateStatus: vi.fn(),
  showPromotionUI: vi.fn((g, r, c, col, mr, cb) => {
    if (g.board[r][c]) {
      g.board[r][c].type = 'e';
    }
    if (cb) cb();
  }),
  animateMove: vi.fn().mockResolvedValue(),
  updateStatistics: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  animateCheck: vi.fn(),
  animateCheckmate: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playGameOver: vi.fn(),
  },
}));

const { Game, BOARD_SIZE } = await import('../js/gameEngine.js');
const MoveExecutor = await import('../js/move/MoveExecutor.js');

describe('Angel Piece and Promotion', () => {
  let game;
  let moveController;

  beforeEach(() => {
    // Setup JSDOM elements
    document.body.innerHTML = `
            <div id="game-over-overlay" class="hidden"></div>
            <div id="winner-text"></div>
            <div id="promotion-overlay" class="hidden"></div>
            <div id="winner-text"></div>
            <div id="promotion-overlay" class="hidden"></div>
            <div id="promotion-options"></div>
            <div id="log-panel"></div>
            <div id="ai-status"></div>
            <div id="tutorial-panel" class="hidden">
                <div id="tutorial-title"></div>
                <div id="tutorial-content"></div>
                <div id="tutorial-steps"></div>
                <div id="tutorial-controls">
                    <button id="prev-step-btn"></button>
                    <button id="next-step-btn"></button>
                    <button id="close-tutorial-btn"></button>
                </div>
            </div>
        `;

    game = new Game(15, 'classic');
    moveController = {
      handleGameEnd: vi.fn(),
      updateMoveHistory: vi.fn(),
      updateStatus: vi.fn(),
      updateUndoRedoButtons: vi.fn(),
      redoStack: [],
      game: game,
    };
    game.gameController = { saveGameToStatistics: vi.fn(), handleGameEnd: vi.fn() }; // Mock
    game.log = vi.fn(); // Mock log
    game.arrowRenderer = { clearArrows: vi.fn() }; // Mock arrow renderer

    // Setup board for testing
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    // Place Kings to satisfy validation
    game.board[4][0] = { type: 'k', color: 'black', hasMoved: false };
    game.board[4][8] = { type: 'k', color: 'white', hasMoved: false };
  });

  test('Angel should move like a Queen', () => {
    // Place Angel at center
    game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

    // Check diagonal move
    const moves = game.getValidMoves(4, 4, game.board[4][4]);
    const diagonalMove = moves.find(m => m.r === 0 && m.c === 0);
    expect(diagonalMove).toBeDefined();

    // Check orthogonal move
    const orthogonalMove = moves.find(m => m.r === 4 && m.c === 0);
    expect(orthogonalMove).toBeDefined();
  });

  test('Angel should move like a Knight', () => {
    // Place Angel at center
    game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

    // Check knight jump
    const moves = game.getValidMoves(4, 4, game.board[4][4]);
    const knightMove = moves.find(m => m.r === 6 && m.c === 5);
    expect(knightMove).toBeDefined();
  });

  test('Angel should capture enemy pieces', () => {
    // Place Angel
    game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

    // Place enemy pawn for diagonal capture (Queen-like)
    game.board[2][2] = { type: 'p', color: 'black', hasMoved: false };

    // Place enemy pawn for knight capture
    game.board[6][5] = { type: 'p', color: 'black', hasMoved: false };

    const moves = game.getValidMoves(4, 4, game.board[4][4]);

    // Check diagonal capture
    expect(moves.find(m => m.r === 2 && m.c === 2)).toBeDefined();

    // Check knight capture
    expect(moves.find(m => m.r === 6 && m.c === 5)).toBeDefined();
  });

  test('Angel should be blocked by friendly pieces (Queen movement)', () => {
    game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
    // Place friendly piece in path
    game.board[4][2] = { type: 'p', color: 'white', hasMoved: false };

    const moves = game.getValidMoves(4, 4, game.board[4][4]);

    // Should not be able to move to [4][2] or beyond [4][1], [4][0]
    expect(moves.find(m => m.r === 4 && m.c === 2)).toBeUndefined();
    expect(moves.find(m => m.r === 4 && m.c === 1)).toBeUndefined();
  });

  test('Angel should jump over pieces (Knight movement)', () => {
    game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
    // Place blocking pieces around
    game.board[4][3] = { type: 'p', color: 'white', hasMoved: false };
    game.board[3][4] = { type: 'p', color: 'white', hasMoved: false };

    const moves = game.getValidMoves(4, 4, game.board[4][4]);

    // Should still be able to jump to knight square
    expect(moves.find(m => m.r === 2 && m.c === 3)).toBeDefined();
  });

  test('Angel should deliver check', () => {
    // White Angel
    game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
    // Black King
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

    expect(game.isInCheck('black')).toBe(true);
  });

  test('Pawn should automatically promote to Angel', async () => {
    // Place white pawn near end
    game.board[1][0] = { type: 'p', color: 'white', hasMoved: true };
    // Clear path
    game.board[0][0] = null;

    // Execute move
    const from = { r: 1, c: 0 };
    const to = { r: 0, c: 0 };

    await MoveExecutor.executeMove(game, moveController, from, to);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if piece at to is Angel
    const promotedPiece = game.board[0][0];
    expect(promotedPiece).not.toBeNull();
    expect(promotedPiece.type).toBe('e');
    expect(promotedPiece.color).toBe('white');
  });

  test('Black pawn should promote to Angel on last rank', async () => {
    // Place black pawn near white's end
    game.board[7][4] = { type: 'p', color: 'black', hasMoved: true };
    game.board[8][4] = null;
    game.turn = 'black';

    await MoveExecutor.executeMove(game, moveController, { r: 7, c: 4 }, { r: 8, c: 4 });
    await new Promise(resolve => setTimeout(resolve, 0));

    const promotedPiece = game.board[8][4];
    expect(promotedPiece).not.toBeNull();
    expect(promotedPiece.type).toBe('e');
    expect(promotedPiece.color).toBe('black');
  });

  describe('Angel Edge Cases', () => {
    test('Angel can move from corner to opposite corner (Queen-like)', () => {
      game.board[0][0] = { type: 'e', color: 'white', hasMoved: false };

      const moves = game.getValidMoves(0, 0, game.board[0][0]);
      const diagonalCorner = moves.find(m => m.r === 8 && m.c === 8);

      expect(diagonalCorner).toBeDefined();
    });

    test('Angel can jump over pieces at board edge (Knight-like)', () => {
      game.board[0][0] = { type: 'e', color: 'white', hasMoved: false };
      // Place blocking pieces
      game.board[0][1] = { type: 'p', color: 'white', hasMoved: false };
      game.board[1][0] = { type: 'p', color: 'white', hasMoved: false };

      const moves = game.getValidMoves(0, 0, game.board[0][0]);
      // Knight jump from corner
      const knightMove = moves.find(m => m.r === 2 && m.c === 1);

      expect(knightMove).toBeDefined();
    });

    test('Angel in corner has both Queen and Knight moves', () => {
      game.board[8][8] = { type: 'e', color: 'white', hasMoved: false };

      const moves = game.getValidMoves(8, 8, game.board[8][8]);

      // Should have diagonal moves (Queen-like)
      const diagonalMove = moves.find(m => m.r === 7 && m.c === 7);
      // Should have knight moves
      const knightMove = moves.find(m => m.r === 6 && m.c === 7);

      expect(diagonalMove).toBeDefined();
      expect(knightMove).toBeDefined();
      expect(moves.length).toBeGreaterThan(10);
    });
  });

  describe('Angel Check and Checkmate Scenarios', () => {
    test('Angel can deliver checkmate with King support', () => {
      // Setup: White Angel and King vs Black King in corner
      game.board = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null));
      game.board[0][0] = { type: 'k', color: 'black', hasMoved: true };
      game.board[1][2] = { type: 'e', color: 'white', hasMoved: true };
      game.board[2][1] = { type: 'k', color: 'white', hasMoved: true };

      expect(game.isInCheck('black')).toBe(true);
      expect(game.isCheckmate('black')).toBe(true);
    });

    test('Angel cannot move if it would expose own King to check', () => {
      // Setup: White Angel blocking check from Black Queen
      game.board = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null));
      game.board[4][4] = { type: 'k', color: 'white', hasMoved: true };
      game.board[4][5] = { type: 'e', color: 'white', hasMoved: true };
      game.board[4][8] = { type: 'q', color: 'black', hasMoved: true };
      game.board[0][0] = { type: 'k', color: 'black', hasMoved: true };

      const moves = game.getValidMoves(4, 5, game.board[4][5]);

      // Angel can only move along the line between King and Queen
      // or capture the Queen
      const invalidMove = moves.find(m => m.r === 2 && m.c === 4);
      expect(invalidMove).toBeUndefined();
    });

    test('Angel can block check with Queen-like move', () => {
      game.board = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null));
      game.board[4][4] = { type: 'k', color: 'white', hasMoved: true };
      game.board[2][2] = { type: 'e', color: 'white', hasMoved: true };
      game.board[0][4] = { type: 'r', color: 'black', hasMoved: true };
      game.board[8][8] = { type: 'k', color: 'black', hasMoved: true };

      const moves = game.getValidMoves(2, 2, game.board[2][2]);
      // Can block at (1, 4), (2, 4), (3, 4)
      const blockMove = moves.find(m => m.r === 2 && m.c === 4);

      expect(blockMove).toBeDefined();
    });

    test('Angel can block check with Knight-like jump', () => {
      game.board = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null));
      // Setup: King at 0,0, Rook at 0,5 checking along rank 0
      game.board[0][0] = { type: 'k', color: 'white', hasMoved: true };
      game.board[0][5] = { type: 'r', color: 'black', hasMoved: true };

      // Angel at 2,1 can jump to 0,2 (Knight move) to block
      game.board[2][1] = { type: 'e', color: 'white', hasMoved: true };

      // Add black king to avoid invalid board state
      game.board[8][8] = { type: 'k', color: 'black', hasMoved: true };

      const moves = game.getValidMoves(2, 1, game.board[2][1]);

      // Knight jump to block at (0, 2)
      // 0,2 is on the path between 0,0 and 0,5
      const blockMove = moves.find(m => m.r === 0 && m.c === 2);

      expect(blockMove).toBeDefined();
    });
  });

  describe('Angel vs Angel', () => {
    test('Angel can capture enemy Angel with Queen move', () => {
      game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
      game.board[4][7] = { type: 'e', color: 'black', hasMoved: false };

      const moves = game.getValidMoves(4, 4, game.board[4][4]);
      const captureMove = moves.find(m => m.r === 4 && m.c === 7);

      expect(captureMove).toBeDefined();
    });

    test('Angel can capture enemy Angel with Knight jump', () => {
      game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
      game.board[6][5] = { type: 'e', color: 'black', hasMoved: false };

      const moves = game.getValidMoves(4, 4, game.board[4][4]);
      const captureMove = moves.find(m => m.r === 6 && m.c === 5);

      expect(captureMove).toBeDefined();
    });

    test('Two Angels can coexist on the board', () => {
      game.board[2][2] = { type: 'e', color: 'white', hasMoved: true };
      game.board[6][6] = { type: 'e', color: 'black', hasMoved: true };

      const whiteMoves = game.getValidMoves(2, 2, game.board[2][2]);
      const blackMoves = game.getValidMoves(6, 6, game.board[6][6]);

      expect(whiteMoves.length).toBeGreaterThan(0);
      expect(blackMoves.length).toBeGreaterThan(0);
    });
  });

  describe('Angel Performance and Move Generation', () => {
    test('Angel move generation should be fast', () => {
      game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

      const startTime = performance.now();
      const moves = game.getValidMoves(4, 4, game.board[4][4]);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should take less than 10ms
      expect(moves.length).toBeGreaterThan(20); // Angel has many moves
    });

    test('Angel should have maximum moves in center of empty board', () => {
      game.board = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null));
      game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
      // Add kings to avoid game-over logic
      game.board[0][0] = { type: 'k', color: 'black', hasMoved: true };
      game.board[8][8] = { type: 'k', color: 'white', hasMoved: true };

      const moves = game.getValidMoves(4, 4, game.board[4][4]);

      // Queen moves: 4 directions × 8 squares each (approx) + Knight moves: 8
      // Total should be substantial
      expect(moves.length).toBeGreaterThan(30);
    });

    test('Multiple promotions to Angel in same game', async () => {
      // Promote first white pawn
      game.board[1][0] = { type: 'p', color: 'white', hasMoved: true };
      await MoveExecutor.executeMove(game, moveController, { r: 1, c: 0 }, { r: 0, c: 0 });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(game.board[0][0].type).toBe('e');

      // Switch to black and promote
      game.board[7][4] = { type: 'p', color: 'black', hasMoved: true };
      game.turn = 'black';
      await MoveExecutor.executeMove(game, moveController, { r: 7, c: 4 }, { r: 8, c: 4 });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(game.board[8][4].type).toBe('e');

      // Promote second white pawn
      game.board[1][8] = { type: 'p', color: 'white', hasMoved: true };
      game.turn = 'white';
      await MoveExecutor.executeMove(game, moveController, { r: 1, c: 8 }, { r: 0, c: 8 });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(game.board[0][8].type).toBe('e');

      // Count Angels on board
      let angelCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (game.board[r][c]?.type === 'e') angelCount++;
        }
      }
      expect(angelCount).toBe(3);
    });
  });
});
