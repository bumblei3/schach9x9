import { jest } from '@jest/globals';
import { setupJSDOM, createMockGame } from './test-utils.js';
import { PHASES } from '../js/config.js';

// Mocks for dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
  initBoardUI: jest.fn(),
  updateStatus: jest.fn(),
  updateShopUI: jest.fn(),
  updateStatistics: jest.fn(),
  updateClockUI: jest.fn(),
  updateClockDisplay: jest.fn(),
  renderBoard: jest.fn(),
  showShop: jest.fn(),
  showModal: jest.fn(),
  showPromotionUI: jest.fn(),
  showToast: jest.fn(),
  updateCapturedUI: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
  soundManager: {
    init: jest.fn(),
    playGameOver: jest.fn(),
    playMove: jest.fn(),
    playGameStart: jest.fn(),
    playCapture: jest.fn(),
  },
}));

jest.unstable_mockModule('../js/storage.js', () => ({
  storageManager: { saveGame: jest.fn(), loadGame: jest.fn(), loadStateIntoGame: jest.fn() },
}));

jest.unstable_mockModule('../js/aiEngine.js', () => ({
  evaluatePosition: jest.fn(),
  see: jest.fn(() => 0),
  isSquareAttacked: jest.fn(() => false),
  findKing: jest.fn(() => ({ r: 0, c: 0 })),
  isInCheck: jest.fn(() => false),
  getAllLegalMoves: jest.fn(() => []),
  getParamsForElo: jest.fn(() => ({ maxDepth: 4, elo: 2500 })),
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
    jest.clearAllMocks();
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
        postMessage: jest.fn(),
        terminate: jest.fn(),
      };
      global.Worker = jest.fn(() => mockWorker);
      global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
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
      const spy = jest.spyOn(ac, 'aiEvaluateDrawOffer').mockImplementation(() => Promise.resolve());
      jest.spyOn(ac, 'aiShouldResign').mockResolvedValue(false);
      jest.spyOn(ac, 'aiShouldOfferDraw').mockResolvedValue(false);

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
