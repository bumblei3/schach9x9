
import { PHASES } from '../js/config.js';

// Setup JSDOM body
document.body.innerHTML = `
    <div id="board-wrapper"><div id="board"></div></div>
    <div id="status-display"></div>
    <div id="points-display"></div>
    <div id="selected-piece-display"></div>
    <div id="clock-white">05:00</div>
    <div id="clock-black">05:00</div>
    <div id="chess-clock" class="hidden"></div>
    <div id="game-over-overlay" class="hidden"><div id="winner-text"></div></div>
    <div id="move-history"></div>
    <div id="captured-white"></div>
    <div id="captured-black"></div>
    <div id="ai-toggle"></div>
    <input type="checkbox" id="ai-toggle">
    <select id="difficulty-select"><option value="beginner">Beginner</option></select>
    <div id="move-history-panel" class="hidden"></div>
    <div id="captured-pieces-panel" class="hidden"></div>
    <div id="draw-offer-overlay" class="hidden"><div id="draw-offer-message"></div></div>
`;

// Mock dependencies
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateStatistics: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(),
  addCapturedPiece: vi.fn(),
  showPromotionUI: vi.fn((game, r, c, color, moveRecord, callback) => {
    if (game && game.board && game.board[r] && game.board[r][c]) {
      game.board[r][c].type = 'e';
    }
    callback();
  }),
  showShop: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playGameOver: vi.fn(),
    playGameStart: vi.fn(),
    init: vi.fn(),
  },
}));

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(() => 0),
  findKing: vi.fn(() => ({ r: 0, c: 0 })),
  getBestMove: vi.fn().mockResolvedValue(null),
}));

const { Game } = await import('../js/gameEngine.js');
const { GameController } = await import('../js/gameController.js');
const { MoveController } = await import('../js/moveController.js');

describe('Controller Logic Deep Dive', () => {
  let game;
  let gameController;
  let moveController;

  beforeEach(() => {
    vi.useFakeTimers();
    game = new Game(15, 'classic');
    game.clockEnabled = true;
    game.whiteTime = 300; // 5 minutes in seconds
    game.blackTime = 300;

    gameController = new GameController(game);
    moveController = new MoveController(game);
    game.gameController = gameController;
    game.moveController = moveController;

    // Mock gameStartTime to avoid "skipping statistics save"
    game.gameStartTime = Date.now();
    game.lastMoveTime = Date.now();

    vi.clearAllMocks();
    global.alert = vi.fn(); // Mock alert for save/load
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Clock Mechanics', () => {
    test('should decrement clock and timeout', () => {
      gameController.startClock();
      expect(game.whiteTime).toBe(300);

      const startNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(startNow + 1000);
      vi.advanceTimersByTime(1000); // Trigger the interval tick

      // Delta is 1s, so whiteTime should be 299
      expect(game.whiteTime).toBeLessThan(300);
      expect(game.whiteTime).toBeCloseTo(299, 0);

      // Advance to timeout
      Date.now.mockReturnValue(startNow + 301000);
      vi.advanceTimersByTime(100);

      expect(game.whiteTime).toBe(0);
      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(document.getElementById('winner-text').textContent).toContain(
        'Schwarz gewinnt durch Zeitüberschreitung'
      );
    });

    test('should switch clocks on turn change', () => {
      gameController.startClock();

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
      vi.advanceTimersByTime(1000);

      expect(game.whiteTime).toBeCloseTo(299, 0);
      expect(game.blackTime).toBe(300);

      // Switch turn
      game.turn = 'black';
      game.lastMoveTime = Date.now(); // Update to now (now + 1000)

      Date.now.mockReturnValue(now + 2000);
      vi.advanceTimersByTime(1000);

      expect(game.whiteTime).toBeCloseTo(299, 0);
      expect(game.blackTime).toBeCloseTo(299, 0);
    });
  });

  describe('State Persistence (Save/Load)', () => {
    test('should save and load state correctly via localStorage', () => {
      const spySet = vi.spyOn(Storage.prototype, 'setItem');
      const spyGet = vi.spyOn(Storage.prototype, 'getItem');

      game.points = 10;
      gameController.saveGame();

      expect(spySet).toHaveBeenCalledWith('schach9x9_save_autosave', expect.any(String));
      const savedData = JSON.parse(spySet.mock.calls[0][1]);
      expect(savedData.points).toBe(10);

      // Mock load
      spyGet.mockReturnValue(JSON.stringify(savedData));
      game.points = 0;
      gameController.loadGame();
      expect(game.points).toBe(10);

      spySet.mockRestore();
      spyGet.mockRestore();
    });
  });

  describe('Move Controller Logical Execution', () => {
    test('should execute pawn promotion (automatic to Angel)', async () => {
      // In moveController.js line 181, it promotes automatically to 'e'
      game.board[1][4] = { type: 'p', color: 'white', hasMoved: true };
      game.turn = 'white';

      await moveController.executeMove({ r: 1, c: 4 }, { r: 0, c: 4 });

      expect(game.board[0][4].type).toBe('e'); // 'e' is Angel
    });

    test('should execute queenside castling', async () => {
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };
      game.board[8][1] = null;
      game.board[8][2] = null;
      game.board[8][3] = null;
      game.turn = 'white';

      await moveController.executeMove({ r: 8, c: 4 }, { r: 8, c: 2 });

      expect(game.board[8][2].type).toBe('k');
      expect(game.board[8][3].type).toBe('r');
    });
  });
});
