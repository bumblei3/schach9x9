import { jest } from '@jest/globals';

// Mock config
jest.unstable_mockModule('../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: {
    SETUP_WHITE_KING: 'setup_white_king',
    SETUP_BLACK_KING: 'setup_black_king',
    SETUP_WHITE_PIECES: 'setup_white_pieces',
    SETUP_BLACK_PIECES: 'setup_black_pieces',
    PLAY: 'play',
    ANALYSIS: 'analysis',
    GAME_OVER: 'game_over',
  },
  PIECE_VALUES: { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0, a: 800, c: 800, e: 1000 },
}));

// Mock effects
jest.unstable_mockModule('../js/effects.js', () => ({
  particleSystem: { spawn: jest.fn() },
  floatingTextManager: { show: jest.fn() },
}));

// Mock utils
jest.unstable_mockModule('../js/utils.js', () => ({
  debounce: fn => fn,
}));

// Mock ShopUI
jest.unstable_mockModule('../js/ui/ShopUI.js', () => ({
  updateShopUI: jest.fn(),
}));

const { PHASES, BOARD_SIZE } = await import('../js/config.js');
const GameStatusUI = await import('../js/ui/GameStatusUI.js');
const TutorUI = await import('../js/ui/TutorUI.js');
const BoardRenderer = await import('../js/ui/BoardRenderer.js');

describe('UI Components Coverage', () => {
  let game;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="board-container">
        <div id="board-wrapper">
          <div id="board"></div>
        </div>
      </div>
      <div id="move-history"></div>
      <div id="status-display"></div>
      <div id="clock-white"></div>
      <div id="clock-black"></div>
      <div id="captured-white"></div>
      <div id="captured-black"></div>
      <div id="eval-graph-container" class="hidden">
        <svg id="eval-graph"></svg>
      </div>
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
        <button id="replay-first"></button>
        <button id="replay-prev"></button>
        <button id="replay-next"></button>
        <button id="replay-last"></button>
        <div id="replay-move-num"></div>
      </div>
      <button id="undo-btn"></button>
      <div id="tutor-panel" class="hidden">
        <div id="tutor-suggestions"></div>
      </div>
      <div id="tutor-recommendations-section" class="hidden">
        <button id="toggle-tutor-recommendations"></button>
        <div id="tutor-recommendations-container"></div>
      </div>
    `;

    window._svgCache = null;
    window.PIECE_SVGS = {
      white: { p: '<div class="piece-svg">wp</div>', k: '<div class="piece-svg">wk</div>' },
      black: { p: '<div class="piece-svg">bp</div>' },
    };

    game = {
      phase: PHASES.PLAY,
      turn: 'white',
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      moveHistory: [{ evalScore: 100 }],
      capturedPieces: { white: [], black: [] },
      stats: { totalMoves: 1, captures: 2, accuracies: [80], playerBestMoves: 5 },
      whiteTime: 60,
      blackTime: 60,
      isAnimating: false,
      gameController: { jumpToMove: jest.fn(), jumpToStart: jest.fn(), makeMove: jest.fn() },
      tutorController: {
        getSetupTemplates: jest.fn(() => [
          { id: 't1', name: 'T1', pieces: ['p'], description: 'Desc', cost: 10 },
        ]),
        applySetupTemplate: jest.fn(),
      },
      calculateMaterialAdvantage: jest.fn(() => 500),
      getEstimatedElo: jest.fn(() => '1500'),
      handleCellClick: jest.fn(),
      getValidMoves: jest.fn(() => [{ r: 5, c: 4 }]),
      executeMove: jest.fn(),
      isSquareUnderAttack: jest.fn(() => true),
      getScoreDescription: jest.fn(() => ({ label: 'Good', emoji: '✅', color: 'green' })),
      arrowRenderer: { highlightMove: jest.fn(), clearArrows: jest.fn() },
    };

    document.elementFromPoint = jest.fn((x, y) => {
      return document.querySelector('.cell[data-r="5"][data-c="4"]');
    });

    window.confirm = jest.fn(() => true);

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Board and Status', () => {
    test('exhaustive coverage', () => {
      game.board[7][4] = { type: 'p', color: 'white' };
      BoardRenderer.initBoardUI(game);
      BoardRenderer.renderBoard(game);
      BoardRenderer.animateMove(
        game,
        { r: 7, c: 4 },
        { r: 5, c: 4 },
        { type: 'p', color: 'white' }
      );

      GameStatusUI.updateStatistics(game);
      GameStatusUI.updateClockUI(game);
      GameStatusUI.updateStatus(game, 'Test');
      GameStatusUI.renderEvalGraph(game);
      GameStatusUI.updateCapturedUI(game);
      GameStatusUI.enterReplayMode(game);
      GameStatusUI.updateReplayUI(game);
      GameStatusUI.exitReplayMode(game);

      const cell = document.querySelector('.cell');
      if (cell) {
        cell.dispatchEvent(new Event('mouseenter'));
        cell.dispatchEvent(new Event('mouseleave'));
      }
    });

    test('TutorUI full details', () => {
      game.getTutorHints = jest.fn(() => [
        {
          move: { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
          notation: 'e4',
          score: 100,
          analysis: {
            category: 'excellent',
            qualityLabel: 'Exzellent',
            tacticalExplanations: ['Mate'],
            strategicExplanations: ['Center'],
            warnings: ['W'],
            questions: ['Q'],
          },
        },
      ]);
      TutorUI.showTutorSuggestions(game);

      // Manual DOM check
      const suggest = document.querySelector('.tutor-suggestion');
      if (suggest) {
        suggest.click();
        const btn = suggest.querySelector('.show-details-btn');
        if (btn) btn.click();
      }

      game.phase = PHASES.SETUP_WHITE_PIECES;
      TutorUI.updateTutorRecommendations(game);
      const toggle = document.getElementById('toggle-tutor-recommendations');
      if (toggle) toggle.click();
    });
  });
});
