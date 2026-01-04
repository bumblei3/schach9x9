import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/utils.js', () => ({
  debounce: jest.fn(fn => fn),
  formatTime: jest.fn(t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`),
  deepCopy: jest.fn(obj => JSON.parse(JSON.stringify(obj))),
  parseFEN: jest.fn(() => ({ board: [], turn: 'white' })),
}));

jest.unstable_mockModule('../js/effects.js', () => ({
  particleSystem: {
    spawn: jest.fn(),
  },
  floatingTextManager: {
    show: jest.fn(),
  },
  shakeScreen: jest.fn(),
  triggerVibration: jest.fn(),
  confettiSystem: { spawn: jest.fn() },
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
  soundManager: {
    init: jest.fn(),
    playMove: jest.fn(),
    playCapture: jest.fn(),
    playGameOver: jest.fn(),
    playSound: jest.fn(),
    playCheck: jest.fn(),
    playGameStart: jest.fn(),
  },
}));

jest.unstable_mockModule('../js/storage.js', () => ({
  storageManager: {
    loadGame: jest.fn(),
    loadStateIntoGame: jest.fn(),
    saveGame: jest.fn(),
    hasSave: jest.fn(),
  },
}));

jest.unstable_mockModule('../js/statisticsManager.js', () => ({
  StatisticsManager: jest.fn().mockImplementation(() => ({
    saveGame: jest.fn(),
    getStats: jest.fn(() => ({})),
  })),
}));

jest.unstable_mockModule('../js/tutorial.js', () => ({
  Tutorial: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
  })),
}));

jest.unstable_mockModule('../js/arrows.js', () => ({
  ArrowRenderer: jest.fn().mockImplementation(() => ({
    clear: jest.fn(),
  })),
}));

jest.unstable_mockModule('../js/puzzleManager.js', () => ({
  puzzleManager: {
    init: jest.fn(),
    loadPuzzle: jest.fn(),
    nextPuzzle: jest.fn(),
  },
}));

const UI = await import('../js/ui.js');
const { GameController } = await import('../js/gameController.js');
const { storageManager } = await import('../js/storage.js');
const { soundManager } = await import('../js/sounds.js');
const { puzzleManager } = await import('../js/puzzleManager.js');

describe('Coverage Boost Tests', () => {
  let game;

  beforeEach(() => {
    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: PHASES.PLAY,
      turn: 'white',
      moveHistory: [],
      positionHistory: [],
      capturedPieces: { white: [], black: [] },
      points: 15,
      initialPoints: 15,
      whiteTime: 300,
      blackTime: 300,
      lastMove: null,
      lastMoveHighlight: null,
      stats: { totalMoves: 0, playerMoves: 0, playerBestMoves: 0, captures: 0 },
      isAI: false,
      isAnimating: false,
      replayMode: false,
      log: jest.fn(),
      getValidMoves: jest.fn(() => []),
      calculateMaterialAdvantage: jest.fn(() => 0),
      updateBestMoves: jest.fn(),
      clockEnabled: true,
      gameStartTime: Date.now(),
      redoStack: [],
    };

    document.body.innerHTML = `
      <div id="board-wrapper">
        <div id="board"></div>
      </div>
      <div id="move-history-panel" class="hidden">
        <div id="move-history"></div>
      </div>
      <div id="captured-white"><div class="material-advantage white-adv"></div></div>
      <div id="captured-black"><div class="material-advantage black-adv"></div></div>
      <div id="clock-white"></div>
      <div id="clock-black"></div>
      <div id="status-display"></div>
      <div id="points-display"></div>
      <div id="eval-graph-container">
        <div id="eval-graph"></div>
      </div>
      <div id="shop-panel" class="hidden"></div>
      <div id="tutor-recommendations-section" class="hidden">
        <button id="toggle-tutor-recommendations"></button>
        <div id="tutor-recommendations-container"></div>
      </div>
      <div id="generic-modal" style="display:none">
        <div id="modal-title"></div>
        <div id="modal-message"></div>
        <div id="modal-actions"></div>
      </div>
      <div id="game-over-overlay" class="hidden">
        <div id="winner-text"></div>
      </div>
      <div id="draw-offer-overlay" class="hidden">
        <div id="draw-offer-message"></div>
      </div>
      <div id="chess-clock" class="hidden"></div>
    `;

    global.window.PIECE_SVGS = {
      white: { p: 'wp', n: 'wn', b: 'wb', r: 'wr', q: 'wq', k: 'wk', a: 'wa', c: 'wc', e: 'we' },
      black: { p: 'bp', n: 'bn', b: 'bb', r: 'br', q: 'bq', k: 'bk', a: 'ba', c: 'bc', e: 'be' },
    };

    global.confirm = jest.fn(() => true);
    jest.clearAllMocks();
  });

  describe('UI.updateTutorRecommendations', () => {
    test('should render templates in setup phase', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.tutorController = {
        getSetupTemplates: jest.fn(() => [
          { id: 'balanced', name: 'Balanced', description: 'Desc', pieces: ['p', 'n'] },
        ]),
        applySetupTemplate: jest.fn(),
      };

      UI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container.children.length).toBe(1);
      expect(container.querySelector('.template-name').textContent).toBe('Balanced');

      // Click template
      container.firstChild.click();
      expect(game.tutorController.applySetupTemplate).toHaveBeenCalledWith('balanced');
    });

    test('should hide section if not in setup phase', () => {
      game.phase = PHASES.PLAY;
      UI.updateTutorRecommendations(game);
      expect(
        document.getElementById('tutor-recommendations-section').classList.contains('hidden')
      ).toBe(true);
    });
  });

  describe('UI.renderEvalGraph', () => {
    test('should render SVG based on moveHistory scores', () => {
      const svg = document.getElementById('eval-graph');

      game.moveHistory = [{ evalScore: 50 }, { evalScore: -100 }];

      UI.renderEvalGraph(game);

      expect(svg.innerHTML).toContain('line');
      expect(svg.innerHTML).toContain('path');
      expect(svg.innerHTML).toContain('eval-area');
    });

    test('should handle empty move history gracefully', () => {
      const svg = document.getElementById('eval-graph');
      game.moveHistory = [];
      UI.renderEvalGraph(game);
      expect(svg.innerHTML).toBe('');
    });
  });

  describe('UI Modals and Toasts', () => {
    test('showModal and closeModal should interact with DOM', () => {
      const actions = [{ text: 'OK', callback: jest.fn() }];
      UI.showModal('Title', 'Message', actions);

      const modal = document.getElementById('generic-modal');
      expect(modal.style.display).toBe('flex');
      expect(document.getElementById('modal-title').textContent).toBe('Title');

      const okBtn = document.querySelector('#modal-actions button');
      okBtn.click();
      expect(actions[0].callback).toHaveBeenCalled();

      UI.closeModal();
      expect(modal.style.display).toBe('none');
    });

    test('showToast should create temporary element', () => {
      jest.useFakeTimers();
      UI.showToast('Test Toast', 'success');

      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('Test Toast');
      expect(toast.classList.contains('success')).toBe(true);

      jest.advanceTimersByTime(3500); // 3000ms + 300ms fade
      expect(document.querySelector('.toast')).toBeNull();
      jest.useRealTimers();
    });
  });

  test('finishSetupPhase should cycle through setup stages', () => {
    const controller = new GameController(game);

    // Stage 1: White pieces setup -> Black pieces setup
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.points = 0; // No unspent points
    controller.finishSetupPhase();
    expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);

    // Stage 2: Black pieces setup -> Play
    game.phase = PHASES.SETUP_BLACK_PIECES;
    game.points = 0;
    controller.finishSetupPhase();
    expect(game.phase).toBe(PHASES.PLAY);
  });

  describe('GameController.loadGame', () => {
    test('should load valid save data into game state', () => {
      const controller = new GameController(game);
      const mockState = {
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
        phase: PHASES.PLAY,
        turn: 'black',
        points: 0,
        moveHistory: [
          { from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, piece: { type: 'p', color: 'white' } },
        ],
        positionHistory: ['hash1'],
      };
      mockState.board[4][4] = { type: 'p', color: 'white' };

      storageManager.loadGame.mockReturnValue(mockState);
      storageManager.loadStateIntoGame.mockImplementation((g, s) => {
        Object.assign(g, s);
        return true;
      });

      controller.loadGame();
      expect(game.turn).toBe('black');
      expect(game.moveHistory.length).toBe(1);
      expect(soundManager.playGameStart).toHaveBeenCalled();
    });

    test('should handle missing save data', () => {
      const controller = new GameController(game);
      storageManager.loadGame.mockReturnValue(null);

      controller.loadGame();
      expect(game.log).toHaveBeenCalledWith(
        expect.stringContaining('Kein gespeichertes Spiel gefunden')
      );
    });
  });

  describe('GameController edge cases and additional features', () => {
    let controller;
    beforeEach(() => {
      controller = new GameController(game);
      game.gameController = controller;
    });

    test('setTimeControl should update game times', () => {
      controller.setTimeControl('rapid15');
      expect(game.whiteTime).toBe(900);
      expect(game.blackTime).toBe(900);
    });

    test('tickClock should handle timeout for white', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      game.whiteTime = 0.5;
      game.lastMoveTime = Date.now() - 1000;

      document.body.innerHTML += '<div id="game-over-overlay"><div id="winner-text"></div></div>';

      controller.tickClock();
      expect(game.whiteTime).toBe(0);
      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(document.getElementById('winner-text').textContent).toContain('Schwarz gewinnt');
    });

    test('resign should end game', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      document.body.innerHTML += '<div id="game-over-overlay"><div id="winner-text"></div></div>';

      controller.resign('white');
      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(document.getElementById('winner-text').textContent).toContain('Weiß gibt auf');
    });

    test('offerDraw, acceptDraw, declineDraw', () => {
      game.phase = PHASES.PLAY;
      document.body.innerHTML +=
        '<div id="draw-offer-overlay"><div id="draw-offer-message"></div></div>';

      controller.offerDraw('white');
      expect(game.drawOffered).toBe(true);

      controller.declineDraw();
      expect(game.drawOffered).toBe(false);

      controller.offerDraw('black');
      controller.acceptDraw();
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });

    test('Analysis mode jumps', () => {
      game.moveController = { reconstructBoardAtMove: jest.fn() };
      game.continuousAnalysis = true;
      game.aiController = { analyzePosition: jest.fn() };

      controller.jumpToMove(5);
      expect(game.moveController.reconstructBoardAtMove).toHaveBeenCalledWith(5);
      expect(game.aiController.analyzePosition).toHaveBeenCalled();

      controller.jumpToStart();
      expect(game.moveController.reconstructBoardAtMove).toHaveBeenCalledWith(0);
    });

    test('toggleContinuousAnalysis', () => {
      game.continuousAnalysis = false;
      game.analysisMode = true;
      game.aiController = { analyzePosition: jest.fn() };

      controller.toggleContinuousAnalysis();
      expect(game.continuousAnalysis).toBe(true);
      expect(game.aiController.analyzePosition).toHaveBeenCalled();
    });

    test('saveGameToStatistics outcomes', () => {
      controller.gameStartTime = Date.now();
      game.difficulty = 'hard';
      game.isAI = true;
      game.whiteTime = 300;
      game.blackTime = 300;

      // Player (white) wins against AI black
      controller.saveGameToStatistics('win', 'black');
      expect(controller.statisticsManager.saveGame).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'win',
          opponent: 'AI-Schwer',
        })
      );

      // Player (white) loses
      controller.gameStartTime = Date.now();
      controller.saveGameToStatistics('loss', 'white');
      expect(controller.statisticsManager.saveGame).toHaveBeenLastCalledWith(
        expect.objectContaining({
          result: 'loss',
        })
      );
    });

    test('Analysis mode enter/exit', () => {
      game.redoStack = [];
      game.phase = PHASES.PLAY;
      game.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      game.board[0][0] = { type: 'p', color: 'white' };
      game._previousBoardState = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      controller.enterAnalysisMode();
      expect(game.analysisMode).toBe(true);

      const boardBefore = JSON.stringify(game.board);
      game.board[1][1] = { type: 'n', color: 'black' };
      controller.exitAnalysisMode(true); // restore
      expect(game.analysisMode).toBe(false);
      expect(JSON.stringify(game.board)).toBe(boardBefore);

      controller.enterAnalysisMode();
      game.board[2][2] = { type: 'b', color: 'white' };
      const boardKeep = JSON.stringify(game.board);
      controller.exitAnalysisMode(false); // keep
      expect(JSON.stringify(game.board)).toBe(boardKeep);
    });

    test('Puzzle mode features', () => {
      const mockPuzzle = {
        id: 'p1',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        moves: 'e2e4',
        description: 'Solve it',
      };
      puzzleManager.loadPuzzle = jest.fn(g => {
        g.puzzleMode = true;
        return mockPuzzle;
      });
      puzzleManager.init = jest.fn();

      controller.startPuzzleMode();
      expect(game.puzzleMode).toBe(true);

      controller.nextPuzzle();
      expect(puzzleManager.nextPuzzle).toHaveBeenCalled();

      const reloadSpy = jest.spyOn(controller, 'reloadPage').mockImplementation(() => {});

      controller.exitPuzzleMode();
      expect(reloadSpy).toHaveBeenCalled();
      expect(game.puzzleMode).toBe(false);

      reloadSpy.mockRestore();
    });

    test('initGame should setup initial state', () => {
      controller.initGame(20, 'setup');
      expect(game.points).toBe(20);
      expect(game.initialPoints).toBe(20);
      expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);
    });

    test('autoSave', () => {
      controller.autoSave();
      expect(storageManager.saveGame).toHaveBeenCalled();
    });
  });
});
