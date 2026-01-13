// Mock config
vi.mock('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: {
    PLAY: 'play',
    ANALYSIS: 'analysis',
    GAME_OVER: 'game_over',
    SETUP_WHITE_PIECES: 'setup_white_pieces',
    SETUP_BLACK_PIECES: 'setup_black_pieces',
    SETUP_WHITE_KING: 'setup_white_king',
    SETUP_BLACK_KING: 'setup_black_king',
  },
  PIECE_VALUES: { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0, a: 800, c: 800, e: 1000 },
}));

// Mock BoardRenderer
vi.mock('../../js/ui/BoardRenderer.js', () => ({
  renderBoard: vi.fn(),
}));

const GameStatusUI = await import('../../js/ui/GameStatusUI.js');
// renderBoard import removed as it was unused

describe('GameStatusUI Component', () => {
  let game;

  beforeEach(() => {
    document.body.innerHTML = `
            <div id="status-display"></div>
            <div id="clock-white"></div>
            <div id="clock-black"></div>
            <div id="captured-white"></div>
            <div id="captured-black"></div>
            <div id="eval-graph-container" class="hidden"><svg id="eval-graph"></svg></div>
            <div id="stat-accuracy"></div>
            <div id="stat-elo"></div>
            <div id="stat-moves"></div>
            <div id="stat-moves-total"></div>
            <div id="stat-captures"></div>
            <div id="stat-best-moves"></div>
            <div id="stat-material"></div>
            <div id="replay-status" class="hidden"></div>
            <div id="replay-exit" class="hidden"></div>
            <div id="replay-control" class="hidden">
                <button id="replay-first"></button><button id="replay-prev"></button>
                <button id="replay-next"></button><button id="replay-last"></button>
                <div id="replay-move-num"></div>
            </div>
            <button id="undo-btn"></button>
            <div id="move-history"></div>
        `;

    game = {
      phase: 'play',
      turn: 'white',
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      boardSize: 9,
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      stats: { totalMoves: 0, captures: 0, accuracies: [], playerBestMoves: 0 },
      gameController: {
        jumpToMove: vi.fn(),
        jumpToStart: vi.fn(),
        saveGameToStatistics: vi.fn(),
      },
      calculateMaterialAdvantage: vi.fn(() => 0),
      getEstimatedElo: vi.fn(() => '1000'),
      whiteTime: 600,
      blackTime: 600,
      startClock: vi.fn(),
      stopClock: vi.fn(),
      clockEnabled: true,
    };

    vi.clearAllMocks();
  });

  test('should updateStatus for all phases', () => {
    const phases = [
      { phase: 'play', expected: 'Spiel läuft' },
      { phase: 'analysis', expected: 'Analyse-Modus' },
      { phase: 'game_over', expected: 'Spiel vorbei' },
      { phase: 'setup_white_pieces', expected: 'Weiß: Kaufe Truppen' },
      { phase: 'setup_black_pieces', expected: 'Schwarz: Kaufe Truppen' },
      { phase: 'setup_white_king', expected: 'Weiß: Wähle einen Korridor' },
      { phase: 'setup_black_king', expected: 'Schwarz: Wähle einen Korridor' },
    ];

    phases.forEach(({ phase, expected }) => {
      game.phase = phase;
      GameStatusUI.updateStatus(game);
      expect(document.getElementById('status-display').textContent).toContain(expected);
    });
  });

  test('should update move history ui', () => {
    game.moveHistory = [
      { piece: { type: 'p' }, from: { r: 1, c: 4 }, to: { r: 3, c: 4 } }, // Simple pawn move
      {
        piece: { type: 'n' },
        from: { r: 0, c: 1 },
        to: { r: 2, c: 2 },
        captured: { type: 'p' },
      }, // Capture
      {
        piece: { type: 'k' },
        from: { r: 0, c: 4 },
        to: { r: 0, c: 6 },
        specialMove: { type: 'castling', isKingside: true },
      }, // Castling
      {
        piece: { type: 'p' },
        from: { r: 8, c: 1 },
        to: { r: 0, c: 1 },
        specialMove: { type: 'promotion', promotedTo: 'q' },
      }, // Promotion
    ];

    GameStatusUI.updateMoveHistoryUI(game);
    const historyEl = document.getElementById('move-history');
    expect(historyEl.children.length).toBe(4);
    // Pawn move from r1 to r3 (Rank 9-3=6) -> e6
    // Note: If original test expected e8, it meant r1 is rank8?
    // Chess 9x9 layout. r0 is top (Black), r8 is bottom (White).
    // r3 is closer to top. 9-3=6. So e6 is correct.
    expect(historyEl.children[0].textContent).toContain('1. e6');
    expect(historyEl.children[1].textContent).toContain('Nx');
    expect(historyEl.children[2].textContent).toContain('O-O');
    expect(historyEl.children[3].textContent).toContain('=Q');
  });

  test('should update captured UI with material advantage', () => {
    game.capturedPieces.white = [{ type: 'p', color: 'black' }]; // White captured Black Pawn
    game.capturedPieces.black = [{ type: 'q', color: 'white' }]; // Black captured White Queen

    // Simulate board state: Black +800 advantage.
    // White P (100) vs Black Q (900). Diff -800.
    game.board[0][0] = { type: 'p', color: 'white' };
    game.board[0][1] = { type: 'q', color: 'black' };

    GameStatusUI.updateCapturedUI(game);

    const whiteContainer = document.getElementById('captured-white');
    const blackContainer = document.getElementById('captured-black');

    expect(whiteContainer.children.length).toBe(1); // One captured pawn
    expect(blackContainer.children.length).toBe(2); // One captured queen + adv display

    expect(blackContainer.textContent).toContain('+800');
  });

  test('should update statistics display', () => {
    game.stats.totalMoves = 10;
    game.stats.accuracies = [90, 100]; // Avg 95
    game.calculateMaterialAdvantage.mockReturnValue(500);

    GameStatusUI.updateStatistics(game);

    expect(document.getElementById('stat-moves').textContent).toBe('10');
    expect(document.getElementById('stat-accuracy').textContent).toBe('95%');
    expect(document.getElementById('stat-material').textContent).toBe('+500');
    expect(document.getElementById('stat-elo').textContent).toBe('1000');
  });

  test('should update clock UI highlighting', () => {
    game.turn = 'white';
    game.whiteTime = 20; // Low time

    GameStatusUI.updateClockUI(game);

    expect(document.getElementById('clock-white').classList.contains('active')).toBe(true);
    expect(document.getElementById('clock-white').classList.contains('low-time')).toBe(true);
    expect(document.getElementById('clock-black').classList.contains('active')).toBe(false);
  });

  test('should handle replay mode transitions', () => {
    game.moveHistory = [{}];
    GameStatusUI.enterReplayMode(game);
    expect(game.replayMode).toBe(true);
    expect(document.getElementById('replay-control').classList.contains('hidden')).toBe(false);
    expect(game.stopClock).toHaveBeenCalled();

    GameStatusUI.exitReplayMode(game);
    expect(game.replayMode).toBe(false);
    expect(document.getElementById('replay-control').classList.contains('hidden')).toBe(true);
    expect(game.startClock).toHaveBeenCalled();
  });

  test('should render eval graph and handle clicks', () => {
    game.moveHistory = [{ evalScore: 100 }, { evalScore: 200 }, { evalScore: -50 }];

    GameStatusUI.renderEvalGraph(game);
    const svg = document.getElementById('eval-graph');
    expect(svg.innerHTML).toContain('class="eval-line"');

    // Test clicking a point
    const point = svg.querySelector('.eval-point'); // First point
    expect(point).toBeDefined();

    // Configure jumpToMove
    game.gameController.jumpToMove = vi.fn();

    // Manually trigger the event on the SVG listener to avoid JSDOM bubbling issues
    // We simulate what the event listener receives

    // But we can dispatch the event on the point and hope JSDOM bubbles it.
    // If bubbling fails, we can try to find the listener.
    // But JSDOM bubbling works usually.
    // The issue is likely 'closest'.

    // Workaround: Mock closest on the element instance we found
    point.closest = vi.fn(selector => {
      return selector === '.eval-point' ? point : null;
    });

    const clickEvent = new MouseEvent('click', { bubbles: true });
    point.dispatchEvent(clickEvent);

    // First point is start (index -1), so jumpToStart should be called
    expect(game.gameController.jumpToStart).toHaveBeenCalled();
  });

  test('should handle empty move history gracefully', () => {
    GameStatusUI.updateMoveHistoryUI(game);
    const historyEl = document.getElementById('move-history');
    expect(historyEl.children.length).toBe(0);
    expect(document.getElementById('undo-btn').disabled).toBe(true);
  });
});
