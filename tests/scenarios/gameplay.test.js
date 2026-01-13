// Mock audio
const mockAudioContext = vi.fn().mockImplementation(function () {
  return {
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: {
        value: 0,
        exponentialRampToValueAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
      },
    })),
    createOscillator: vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    })),
    destination: {},
  };
});

vi.stubGlobal('AudioContext', mockAudioContext);

// We need to use real modules mostly, but mock UI rendering effectively
vi.mock('../../js/ui/BoardRenderer.js', () => ({
  renderBoard: vi.fn(),
  initBoardUI: vi.fn(),
  animateMove: vi.fn((g, f, t, p, cb) => cb && cb()),
  highlightLastMove: vi.fn(),
  clearHighlights: vi.fn(),
  getPieceSymbol: vi.fn(() => 'X'),
  getPieceText: vi.fn(() => 'X'),
}));

// Import what we need
const { Game, PHASES } = await import('../../js/gameEngine.js');
const { GameController } = await import('../../js/gameController.js');
const { MoveController } = await import('../../js/moveController.js');

describe('Gameplay Scenarios', () => {
  let game;
  let controller;

  beforeEach(() => {
    // Setup DOM for Tutorial and Game
    document.body.innerHTML = `
            <div id="tutorial-overlay"></div>
            <div id="tutorial-steps"></div>
            <button id="tutorial-prev"></button>
            <button id="tutorial-next"></button>
            <button id="tutorial-close"></button>
            <span id="tutorial-current-step"></span>
            <span id="tutorial-total-steps"></span>
            
            <div id="status-display"></div>
            <div id="shop-panel"></div>
            <div id="shop-items"></div>
            <div id="points-display"></div>
            <div id="selected-piece-display"></div>
            <div id="board-wrapper"><div id="board"></div></div>
        `;

    game = new Game(10, 'classic');
    controller = new GameController(game);
    const moveController = new MoveController(game);

    game.gameController = controller;
    game.moveController = moveController;

    // Circular dependencies manual wiring
    controller.moveController = moveController;

    // Manual Patching of Game prototype (normally done in App.js)
    game.handlePlayClick = (r, c) => moveController.handlePlayClick(r, c);
    game.executeMove = (from, to) => moveController.executeMove(from, to);
    game.animateMove = (f, t, p) => moveController.animateMove(f, t, p);

    // Mock necessary controller dependencies if they aren't fully mocked yet
    controller.shopManager = { updateShopUI: vi.fn() };
    controller.statisticsManager = { updateStats: vi.fn(), recordGameStart: vi.fn() };
    controller.timeManager = { startClock: vi.fn(), stopClock: vi.fn(), switchTurn: vi.fn() };

    // Disable search time limits for reliable testing
    game.aiMoveTime = 50;

    // Initialize game to set phase/turn
    controller.initGame(10, 'classic');
  });

  test('Mock Game Sequence: Scholar Mate attempt', async () => {
    // 1. White moves pawn
    controller.handleCellClick(7, 4); // Select King Pawn
    // Note: game logic is complex, we are just verifying that the game controller flows

    expect(game.phase).toBe(PHASES.PLAY);
    expect(game.turn).toBe('white');

    // 2. Mock valid moves response for the selected pawn
    game.getValidMoves = vi.fn(() => [{ r: 5, c: 4 }]);

    // 3. Click destination
    await controller.handleCellClick(5, 4);

    // Verify turn switch
    expect(game.turn).toBe('black');
  });
});
