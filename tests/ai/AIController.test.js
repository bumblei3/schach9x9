import { jest } from '@jest/globals';
import { Game } from '../../js/gameEngine.js';
import { PHASES } from '../../js/config.js';

// --- MOCKS ---
jest.unstable_mockModule('../../js/ui.js', () => ({
  updateCapturedUI: jest.fn(),
  updateStatus: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  updateStatistics: jest.fn(),
  renderBoard: jest.fn(),
  showShop: jest.fn(),
  updateShopUI: jest.fn(),
  animateMove: jest.fn(() => Promise.resolve()),
  animateCheck: jest.fn(),
  animateCheckmate: jest.fn(),
  showPromotionModal: jest.fn(),
  showGameEnd: jest.fn(),
  renderEvalGraph: jest.fn(),
}));

jest.unstable_mockModule('../../js/sounds.js', () => ({
  soundManager: {
    playSound: jest.fn(),
    playMove: jest.fn(),
    playCapture: jest.fn(),
    playCheck: jest.fn(),
    playGameStart: jest.fn(),
    playGameEnd: jest.fn(),
    playError: jest.fn(),
  },
}));

jest.unstable_mockModule('../../js/effects.js', () => ({
  particleSystem: { spawnParticles: jest.fn() },
  screenShake: jest.fn(),
  confettiSystem: { trigger: jest.fn() },
}));

jest.unstable_mockModule('../../js/puzzleManager.js', () => ({
  puzzleManager: { active: false, checkMove: jest.fn() },
}));

const UI = await import('../../js/ui.js');
const { soundManager } = await import('../../js/sounds.js');
const MoveExecutor = await import('../../js/move/MoveExecutor.js');
const { getBestMove } = await import('../../js/ai/Search.js');

describe('AI Integration: Self-Play', () => {
  let game;
  let moveController;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DOM
    document.getElementById = jest.fn(id => {
      return {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn(),
          toggle: jest.fn(),
        },
        style: {},
        scrollTop: 0,
        scrollHeight: 0,
        addEventListener: jest.fn(),
      };
    });
    document.body.innerHTML = '<div id="game-container"></div>';

    // Setup Game
    game = new Game(15, 'classic');
    // game.init() does not exist in gameEngine.js Game class
    // but MoveExecutor expects game.gameController to exist for saving
    game.gameController = {
      saveGame: jest.fn(),
      updateStatus: jest.fn(),
      checkGameState: jest.fn(),
    };

    // Mock moveController
    moveController = {
      updateUndoRedoButtons: jest.fn(),
      playSound: jest.fn(),
      handleMove: jest.fn(), // We won't use handleMove full pipeline, but MoveExecutor directly
    };

    // Disable window interaction
    global.window.battleChess3D = { enabled: false };
  });

  test('Self-Play: 10 Moves without crash', async () => {
    // Setup simple board (Pieces already set by init)
    // Ensure phase is PLAY
    game.phase = PHASES.PLAY;

    // Loop 10 ply (5 full moves)
    for (let i = 0; i < 10; i++) {
      const turn = game.turn;
      // AI Search (Depth 1 for speed)
      const bestMove = getBestMove(game.board, turn, 1, 'beginner');

      if (!bestMove) {
        console.log(`AI cannot find move at ply ${i}. Game Over?`);
        break;
      }

      // Execute Move
      await MoveExecutor.executeMove(game, moveController, bestMove.from, bestMove.to);

      // Verify state
      expect(game.moveHistory.length).toBe(i + 1);
      expect(game.turn).not.toBe(turn); // Turn changed
    }

    expect(game.moveHistory.length).toBe(10);
  });
});
