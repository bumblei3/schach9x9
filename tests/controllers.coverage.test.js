
import { setupJSDOM, createMockGame } from './test-utils.js';
import { PHASES } from '../js/config.js';

// Mocks for dependencies
vi.mock('../js/ui.js', () => ({
  initBoardUI: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  renderBoard: vi.fn(),
  showShop: vi.fn(),
  showModal: vi.fn(),
  showPromotionUI: vi.fn(),
  showToast: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  getPieceText: vi.fn(piece => piece ? piece.type : ''),
  showMoveQuality: vi.fn(),
  showTutorSuggestions: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playGameOver: vi.fn(),
    playMove: vi.fn(),
    playGameStart: vi.fn(),
    playCapture: vi.fn(),
  },
}));

vi.mock('../js/storage.js', () => ({
  storageManager: { saveGame: vi.fn(), loadGame: vi.fn(), loadStateIntoGame: vi.fn() },
}));

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(),
  see: vi.fn(() => 0),
  isSquareAttacked: vi.fn(() => false),
  findKing: vi.fn(() => ({ r: 0, c: 0 })),
  isInCheck: vi.fn(() => false),
  getAllLegalMoves: vi.fn(() => []),
  getParamsForElo: vi.fn(() => ({ maxDepth: 4, elo: 2500 })),
}));

// Use top-level await
const { GameController } = await import('../js/gameController.js');
const { AIController } = await import('../js/aiController.js');
const { TutorController } = await import('../js/tutorController.js');
const { storageManager } = await import('../js/storage.js');
const UI = await import('../js/ui.js');
const { evaluatePosition } = await import('../js/aiEngine.js');

describe('Controllers Coverage Expansion', () => {
  let game, gc, ac, tc;

  beforeEach(() => {
    setupJSDOM();
    game = createMockGame();
    gc = new GameController(game);
    ac = new AIController(game);
    tc = new TutorController(game);
    vi.clearAllMocks();
  });

  describe('GameController', () => {
    test('tickClock should handle white timeout', () => {
      game.whiteTime = 0.05;
      game.turn = 'white';
      game.phase = PHASES.PLAY;
      game.lastMoveTime = Date.now() - 100;

      gc.tickClock();
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });

    test('tickClock should handle black timeout', () => {
      game.blackTime = 0.05;
      game.turn = 'black';
      game.phase = PHASES.PLAY;
      game.lastMoveTime = Date.now() - 100;

      gc.tickClock();
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });

    test('resign should handle black resigning', () => {
      game.phase = PHASES.PLAY;
      gc.resign('black');
      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(document.getElementById('winner-text').textContent).toContain('Weiß gewinnt');
    });

    test('handleCellClick should do nothing in GAME_OVER', () => {
      game.phase = PHASES.GAME_OVER;
      gc.handleCellClick(0, 0);
      expect(game.handleCellClick).not.toHaveBeenCalled();
    });

    test('offerDraw should handle human offer', () => {
      game.phase = PHASES.PLAY;
      gc.offerDraw('white');
      expect(game.drawOffered).toBe(true);
      expect(game.drawOfferedBy).toBe('white');
    });

    test('acceptDraw should end game', () => {
      game.drawOffered = true;
      gc.acceptDraw();
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });

    test('saveGame should call storageManager', () => {
      gc.saveGame();
      expect(storageManager.saveGame).toHaveBeenCalledWith(game);
    });

    test('loadGame should handle successful load', () => {
      storageManager.loadGame.mockReturnValue({ some: 'state' });
      storageManager.loadStateIntoGame.mockReturnValue(true);

      gc.loadGame();
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('geladen'));
    });
  });

  describe('AIController', () => {
    test('aiEvaluateDrawOffer should accept if losing', async () => {
      game.drawOffered = true;
      evaluatePosition.mockResolvedValue(-500);

      await ac.aiEvaluateDrawOffer();
      expect(game.acceptDraw).toHaveBeenCalled();
    });

    test('aiShouldOfferDraw should return true if slightly losing', async () => {
      game.moveHistory = Array(30).fill({});
      evaluatePosition.mockResolvedValue(-200);

      expect(await ac.aiShouldOfferDraw()).toBe(true);
    });

    test('aiShouldResign should return true if losing badly', async () => {
      evaluatePosition.mockResolvedValue(-2000);
      expect(await ac.aiShouldResign()).toBe(true);
    });

    test('analyzePosition should create worker and send message', () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      global.Worker = vi.fn().mockImplementation(function () {
        return mockWorker;
      });
      global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
      game.analysisMode = true;

      ac.analyzePosition();

      expect(global.Worker).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'analyze' })
      );
    });

    test('aiMove should evaluate draw offer if pending', async () => {
      game.drawOffered = true;
      game.drawOfferedBy = 'white';
      const spy = vi.spyOn(ac, 'aiEvaluateDrawOffer').mockImplementation(() => Promise.resolve());
      vi.spyOn(ac, 'aiShouldResign').mockResolvedValue(false);
      vi.spyOn(ac, 'aiShouldOfferDraw').mockResolvedValue(false);

      await ac.aiMove();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('TutorController', () => {
    test('checkBlunder should trigger modal on large eval drop', async () => {
      const moveRecord = {
        from: { r: 6, c: 4 },
        to: { r: 4, c: 4 },
        evalScore: -300,
        piece: { color: 'white' },
      };
      game.lastEval = 0;
      game.board[6][4] = { type: 'p', color: 'white' };

      await tc.checkBlunder(moveRecord);

      expect(UI.showModal).toHaveBeenCalledWith(
        expect.stringContaining('Fehler'),
        expect.any(String),
        expect.any(Array)
      );
    });

    test('detectTacticalPatterns should detect fork', () => {
      const knight = { type: 'n', color: 'white' };
      game.board[4][4] = knight;
      game.board[2][3] = { type: 'r', color: 'black' };
      game.board[2][5] = { type: 'q', color: 'black' };
      game.board[6][5] = knight;

      const move = { from: { r: 6, c: 5 }, to: { r: 4, c: 4 } };
      game.getValidMoves.mockReturnValue([
        { r: 2, c: 3 },
        { r: 2, c: 5 },
      ]);

      const patterns = tc.detectTacticalPatterns(move);
      expect(patterns.some(p => p.type === 'fork')).toBe(true);
    });

    test('detectPins should identify a pinned piece', () => {
      const queen = { type: 'q', color: 'white' };
      game.board[4][4] = queen;
      game.board[4][6] = { type: 'r', color: 'black' };
      game.board[4][8] = { type: 'k', color: 'black' };

      game.getValidMoves.mockReturnValue([
        { r: 4, c: 5 },
        { r: 4, c: 6 },
        { r: 4, c: 7 },
        { r: 4, c: 8 },
      ]);

      const pinned = tc.detectPins({ r: 4, c: 4 }, 'white');
      expect(pinned.length).toBeGreaterThan(0);
      expect(pinned[0].pinnedPiece.type).toBe('r');
    });

    test('analyzeStrategicValue should detect center control', () => {
      const move = { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } };
      game.board[6][4] = { type: 'p', color: 'white' };

      const strategy = tc.analyzeStrategicValue(move);
      expect(strategy.some(s => s.type === 'center_control')).toBe(true);
    });
  });
});
