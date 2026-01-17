import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PHASES } from '../js/config.js';

// Mock dependencies
vi.mock('../js/utils.js', () => ({
  debounce: vi.fn(fn => fn),
  formatTime: vi.fn(t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`),
}));

vi.mock('../js/effects.js', () => ({
  particleSystem: {
    spawn: vi.fn(),
  },
  floatingTextManager: {
    show: vi.fn(),
  },
  shakeScreen: vi.fn(),
  triggerVibration: vi.fn(),
  confettiSystem: { spawn: vi.fn() },
}));

// Import UI module
const UI = await import('../js/ui.js');

describe('UI Module - Advanced Features', () => {
  let game: any;

  beforeEach(() => {
    // Mock Game state
    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: PHASES.PLAY,
      turn: 'white',
      capturedPieces: { white: [], black: [] },
      moveHistory: [],
      stats: {
        totalMoves: 10,
        playerMoves: 5,
        playerBestMoves: 3,
        captures: 2,
        accuracies: [60, 60, 60],
      },
      replayMode: false,
      replayPosition: -1,
      savedGameState: null,
      arrowRenderer: {
        clearArrows: vi.fn(),
        highlightMoves: vi.fn(),
      },
      tutorController: {
        getTutorHints: vi.fn(() => []),
        getSetupTemplates: vi.fn(() => []),
        applySetupTemplate: vi.fn(),
      },
      executeMove: vi.fn(),
      calculateMaterialAdvantage: vi.fn(() => 5),
      startClock: vi.fn(),
      stopClock: vi.fn(),
    };

    document.body.innerHTML = `
            <div id="stat-moves"></div>
            <div id="stat-captures"></div>
            <div id="stat-accuracy"></div>
            <div id="stat-best-moves"></div>
            <div id="stat-material"></div>
            
            <div id="tutor-panel" class="hidden"></div>
            <div id="tutor-suggestions"></div>
            <div id="tutor-overlay" class="hidden">
                <div id="tutor-hints-body"></div>
                <button id="close-tutor-btn">×</button>
            </div>
            
            <div id="replay-status" class="hidden"></div>
            <div id="replay-exit" class="hidden"></div>
            <div id="replay-control" class="hidden"></div>
            <div id="replay-move-num"></div>
            <button id="replay-first"></button>
            <button id="replay-prev"></button>
            <button id="replay-next"></button>
            <button id="replay-last"></button>
            <button id="undo-btn"></button>
            
            <div id="board-wrapper"><div id="board"></div></div>
        `;

    vi.clearAllMocks();
  });

  describe('updateStatistics', () => {
    test('should update all statistical elements', () => {
      UI.updateStatistics(game);

      expect(document.getElementById('stat-moves')!.textContent).toBe('10');
      expect(document.getElementById('stat-captures')!.textContent).toBe('0'); // 0 based on capturedPieces.length
      expect(document.getElementById('stat-accuracy')!.textContent).toBe('60%');
      expect(document.getElementById('stat-best-moves')!.textContent).toBe('3');
      expect(document.getElementById('stat-material')!.textContent).toBe('+5');
      expect(document.getElementById('stat-material')!.classList.contains('positive')).toBe(true);
    });

    test('should handle zero player moves for accuracy', () => {
      game.stats.playerMoves = 0;
      game.stats.accuracies = [];
      UI.updateStatistics(game);
      expect(document.getElementById('stat-accuracy')!.textContent).toBe('--%');
    });
  });

  describe('Replay Mode', () => {
    test('enterReplayMode should save state and update UI', () => {
      game.moveHistory = [{ from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }];
      UI.enterReplayMode(game);

      expect(game.replayMode).toBe(true);
      expect(game.replayPosition).toBe(0);
      expect(game.savedGameState).toBeDefined();
      expect(game.stopClock).toHaveBeenCalled();
      expect(document.getElementById('replay-status')!.classList.contains('hidden')).toBe(false);
    });

    test('exitReplayMode should restore state and update UI', () => {
      game.replayMode = true;
      game.savedGameState = {
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
        turn: 'white',
        selectedSquare: null,
        validMoves: null,
        lastMoveHighlight: null,
      };
      game._previousBoardState = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      UI.exitReplayMode(game);

      expect(game.replayMode).toBe(false);
      expect(game.savedGameState).toBeNull();
      expect(document.getElementById('replay-status')!.classList.contains('hidden')).toBe(true);
    });

    test('updateReplayUI should update button states', () => {
      game.moveHistory = [1, 2, 3];
      game.replayPosition = 1;
      UI.updateReplayUI(game);

      expect(document.getElementById('replay-move-num')!.textContent).toBe('2');
      expect((document.getElementById('replay-first') as HTMLButtonElement).disabled).toBe(false);
      expect((document.getElementById('replay-last') as HTMLButtonElement).disabled).toBe(false);

      game.replayPosition = -1;
      UI.updateReplayUI(game);
      expect((document.getElementById('replay-first') as HTMLButtonElement).disabled).toBe(true);

      game.replayPosition = 2;
      UI.updateReplayUI(game);
      expect((document.getElementById('replay-last') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('Tutor Suggestions - Setup Templates', () => {
    test('should show setup templates in setup phase', async () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      (game.tutorController.getSetupTemplates as any).mockReturnValue([
        { id: 'classic', name: 'Classic', description: 'desc', cost: 15, pieces: ['p'] },
      ]);

      await UI.showTutorSuggestions(game);

      const suggestions = document.getElementById('tutor-suggestions')!;
      expect(suggestions.innerHTML).toContain('Classic');
      expect(suggestions.innerHTML).toContain('Empfohlene Aufstellungen');
    });

    test('should apply template on click', async () => {
      window.confirm = vi.fn(() => true);
      game.phase = PHASES.SETUP_WHITE_PIECES;
      (game.tutorController.getSetupTemplates as any).mockReturnValue([
        { id: 'classic', name: 'Classic', description: 'desc', cost: 15, pieces: ['p'] },
      ]);

      await UI.showTutorSuggestions(game);
      const templateEl = document.querySelector('.setup-template') as HTMLElement;
      templateEl.click();

      expect(game.tutorController.applySetupTemplate).toHaveBeenCalledWith('classic');
    });
  });

  describe('Tutor Suggestions - Gameplay Hints', () => {
    beforeEach(() => {
      game.getTutorHints = vi.fn(() => [
        {
          move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
          score: 150,
          notation: 'e4',
          analysis: {
            category: 'excellent',
            qualityLabel: 'Bester Zug',
            tacticalExplanations: ['Gewinnt Zentrum'],
            strategicExplanations: ['Entwickelt Springer'],
            warnings: ['Vorsicht vor f7'],
          },
        },
      ]);
    });

    test('should render gameplay hints with analysis', async () => {
      await UI.showTutorSuggestions(game);

      const suggestions = document.getElementById('tutor-suggestions')!;
      expect(suggestions.innerHTML).toContain('Bester Zug');
      expect(suggestions.innerHTML).toContain('Gewinnt Zentrum');
      expect(suggestions.innerHTML).toContain('Vorsicht vor f7');
    });

    test('should highlight move on click', async () => {
      // Create hint elements manually or ensure they exist in DOM
      document.body.innerHTML += `
        <div class="cell" data-r="6" data-c="4"></div>
        <div class="cell" data-r="4" data-c="4"></div>
      `;

      await UI.showTutorSuggestions(game);
      const suggestion = document.querySelector('.tutor-suggestion') as HTMLElement;
      suggestion.click();

      expect(game.arrowRenderer.highlightMoves).toHaveBeenCalled();
      // Check for cell highlights
      expect(document.querySelector('.cell.suggestion-highlight')).toBeDefined();
    });

    test('should execute move on "Try This" button click', async () => {
      await UI.showTutorSuggestions(game);
      const tryBtn = document.querySelector('.try-move-btn') as HTMLElement;
      tryBtn.click();

      expect(game.executeMove).toHaveBeenCalledWith({ r: 6, c: 4 }, { r: 4, c: 4 });
      expect(document.getElementById('tutor-panel')!.classList.contains('hidden')).toBe(true);
    });
  });
});
