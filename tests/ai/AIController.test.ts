import { describe, expect, test, beforeEach, vi } from 'vitest';
import { Game } from '../../js/gameEngine.js';
import { PHASES } from '../../js/config.js';
import * as MoveExecutor from '../../js/move/MoveExecutor.js';
import { getBestMove } from '../../js/aiEngine.js';

// --- MOCKS ---
vi.mock('../../js/ui.js', () => ({
  updateCapturedUI: vi.fn(),
  updateStatus: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateStatistics: vi.fn(),
  renderBoard: vi.fn(),
  showShop: vi.fn(),
  updateShopUI: vi.fn(),
  animateMove: vi.fn(() => Promise.resolve()),
  animateCheck: vi.fn(),
  animateCheckmate: vi.fn(),
  showPromotionModal: vi.fn(),
  showGameEnd: vi.fn(),
  renderEvalGraph: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../js/sounds.js', () => ({
  soundManager: {
    playSound: vi.fn(),
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playGameStart: vi.fn(),
    playGameEnd: vi.fn(),
    playError: vi.fn(),
  },
}));

vi.mock('../../js/effects.js', () => ({
  particleSystem: { spawnParticles: vi.fn() },
  screenShake: vi.fn(),
  confettiSystem: { trigger: vi.fn() },
}));

vi.mock('../../js/puzzleManager.js', () => ({
  puzzleManager: { active: false, checkMove: vi.fn() },
}));

describe('AI Integration: Self-Play', () => {
  let game: Game;
  let moveController: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DOM
    document.getElementById = vi.fn((_id: string) => {
      return {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        textContent: '',
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
          toggle: vi.fn(),
        },
        style: {},
        scrollTop: 0,
        scrollHeight: 0,
        addEventListener: vi.fn(),
      } as any;
    });
    document.body.innerHTML = '<div id="game-container"></div>';

    // Setup Game
    game = new Game(15, 'classic');

    // game.init() does not exist in gameEngine.js Game class
    // but MoveExecutor expects game.gameController to exist for saving
    (game as any).gameController = {
      saveGame: vi.fn(),
      updateStatus: vi.fn(),
      checkGameState: vi.fn(),
    };

    // Mock moveController
    moveController = {
      updateUndoRedoButtons: vi.fn(),
      playSound: vi.fn(),
      handleMove: vi.fn(), // We won't use handleMove full pipeline, but MoveExecutor directly
    };

    // Disable window interaction
    (global as any).window.battleChess3D = { enabled: false };
  });

  test('Self-Play: 10 Moves without crash', async () => {
    // Ensure phase is PLAY
    game.phase = PHASES.PLAY;

    // Loop 10 ply (5 full moves)
    for (let i = 0; i < 10; i++) {
      const turn = game.turn;
      // AI Search (Depth 1 for speed)
      const bestMove = await getBestMove(game.board, turn, 1, 'beginner');

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
