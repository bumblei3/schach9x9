import { jest } from '@jest/globals';

// Mock config
jest.unstable_mockModule('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play', ANALYSIS: 'analysis', GAME_OVER: 'game_over' },
  PIECE_VALUES: { p: 100, k: 0 },
}));

const GameStatusUI = await import('../../js/ui/GameStatusUI.js');

describe('GameStatusUI Component', () => {
  let game;
  beforeEach(() => {
    document.body.innerHTML = `
            <div id="status-display"></div>
            <div id="clock-white"></div>
            <div id="clock-black"></div>
            <div id="captured-white"></div>
            <div id="captured-black"></div>
            <div id="eval-graph-container" class="hidden"><svg id="eval-graph"></svg></div>
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
                <button id="replay-first"></button><button id="replay-prev"></button>
                <button id="replay-next"></button><button id="replay-last"></button>
                <div id="replay-move-num"></div>
            </div>
            <button id="undo-btn"></button>
            <div id="move-history"></div>
        `;

    game = {
      phase: 'play',
      turn: 'white',
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      moveHistory: [{ evalScore: 100 }],
      capturedPieces: { white: ['p'], black: ['p'] },
      stats: { totalMoves: 1, captures: 2, accuracies: [95], playerBestMoves: 3 },
      gameController: { jumpToMove: jest.fn() },
      calculateMaterialAdvantage: () => 200,
      getEstimatedElo: () => '1200',
      whiteTime: 60,
      blackTime: 60,
    };
  });

  test('should update status message', () => {
    GameStatusUI.updateStatus(game);
    expect(document.getElementById('status-display').textContent).toBe('Spiel läuft - Weiß am Zug');
  });

  test('should update clock display', () => {
    GameStatusUI.updateClockDisplay(game);
    expect(document.getElementById('clock-white').textContent).toMatch(/\d+:\d+/);
  });

  test('should update statistics', () => {
    GameStatusUI.updateStatistics(game);
    expect(document.getElementById('stat-moves').textContent).toBe('1');
    expect(document.getElementById('stat-captures').textContent).toBe('2');
    expect(document.getElementById('stat-elo').textContent).toBe('1200');
  });

  test('should handle replay mode transitions', () => {
    GameStatusUI.enterReplayMode(game);
    expect(document.getElementById('replay-control').classList.contains('hidden')).toBe(false);

    GameStatusUI.exitReplayMode(game);
    expect(document.getElementById('replay-control').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('replay-control').classList.contains('hidden')).toBe(true);
  });

  test('should render evaluation graph', () => {
    GameStatusUI.renderEvalGraph(game);
    const svg = document.getElementById('eval-graph');
    expect(svg.innerHTML).not.toBe('');
  });
});
