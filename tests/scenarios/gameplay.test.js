import { jest } from '@jest/globals';

// Mock audio
global.AudioContext = jest.fn().mockImplementation(() => ({
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: {
      value: 0,
      exponentialRampToValueAtTime: jest.fn(),
      setValueAtTime: jest.fn(),
    },
  })),
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
  })),
  destination: {},
}));

// We need to use real modules mostly, but mock UI rendering effectively
jest.unstable_mockModule('../../js/ui/BoardRenderer.js', () => ({
  renderBoard: jest.fn(),
  initBoardUI: jest.fn(),
  animateMove: jest.fn((g, f, t, p, cb) => cb && cb()),
  highlightLastMove: jest.fn(),
  clearHighlights: jest.fn(),
  getPieceSymbol: jest.fn(() => 'X'),
  getPieceText: jest.fn(() => 'X'),
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
    controller.shopManager = { updateShopUI: jest.fn() };
    controller.statisticsManager = { updateStats: jest.fn(), recordGameStart: jest.fn() };
    controller.timeManager = { startClock: jest.fn(), stopClock: jest.fn(), switchTurn: jest.fn() };

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
    game.getValidMoves = jest.fn(() => [{ r: 5, c: 4 }]);

    // 3. Click destination
    await controller.handleCellClick(5, 4);

    // Verify turn switch
    expect(game.turn).toBe('black');
  });
});
