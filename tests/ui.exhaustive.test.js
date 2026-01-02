import { jest } from '@jest/globals';

// Mock everything needed
jest.unstable_mockModule('../js/config.js', () => ({
    BOARD_SIZE: 9,
    PHASES: { PLAY: 'play', ANALYSIS: 'analysis', GAME_OVER: 'game_over' },
    PIECE_VALUES: { p: 100, k: 0, r: 500, n: 300, b: 300, q: 900 }
}));
jest.unstable_mockModule('../js/effects.js', () => ({
    particleSystem: { spawn: jest.fn() },
    floatingTextManager: { show: jest.fn() }
}));
jest.unstable_mockModule('../js/utils.js', () => ({
    debounce: (fn) => fn
}));

const BoardRenderer = await import('../js/ui/BoardRenderer.js');
const GameStatusUI = await import('../js/ui/GameStatusUI.js');
const TutorUI = await import('../js/ui/TutorUI.js');

describe('UI Exhaustive Unit Tests', () => {
    let game;
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="board"></div>
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
            <div id="tutor-panel" class="hidden"><div id="tutor-suggestions"></div></div>
            <div id="tutor-recommendations-section" class="hidden"><div id="tutor-recommendations-container"></div><button id="toggle-tutor-recommendations"></button></div>
        `;
        window.PIECE_SVGS = {
            white: { p: 'wp', k: 'wk', r: 'wr', n: 'wn', b: 'wb', q: 'wq' },
            black: { p: 'bp', k: 'bk', r: 'br', n: 'bn', b: 'bb', q: 'bq' }
        };
        window._svgCache = null;
        game = {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            phase: 'play',
            turn: 'white',
            moveHistory: [{ evalScore: 100 }],
            capturedPieces: { white: [], black: [] },
            stats: { totalMoves: 1, captures: 0, accuracies: [100], playerBestMoves: 0 },
            gameController: { jumpToMove: jest.fn() },
            tutorController: { getSetupTemplates: () => [] },
            arrowRenderer: { highlightMove: jest.fn(), clearArrows: jest.fn() },
            calculateMaterialAdvantage: () => 0,
            getEstimatedElo: () => '1000',
            handleCellClick: jest.fn(),
            getValidMoves: () => []
        };
    });

    test('BoardRenderer branches', () => {
        BoardRenderer.initBoardUI(game);
        game.board[0][0] = { type: 'p', color: 'white' };
        BoardRenderer.renderBoard(game);
        BoardRenderer.getPieceSymbol({ type: 'p', color: 'white' });
        BoardRenderer.getPieceText({ type: 'p', color: 'white' });
        BoardRenderer.animateMove(game, { r: 0, c: 0 }, { r: 1, c: 1 }, { type: 'p', color: 'white' });

        const cell = document.querySelector('.cell');
        if (cell) {
            cell.dispatchEvent(new Event('mouseover'));
            cell.dispatchEvent(new Event('mouseout'));
            cell.dispatchEvent(new Event('touchstart'));
        }
    });

    test('GameStatusUI branches', () => {
        GameStatusUI.updateStatus(game, 'Test');
        GameStatusUI.updateClockUI(game);
        GameStatusUI.updateClockDisplay(game);
        GameStatusUI.updateStatistics(game);
        GameStatusUI.renderEvalGraph(game);
        game.capturedPieces.white = [{ type: 'p', color: 'black' }];
        GameStatusUI.updateCapturedUI(game);
        GameStatusUI.enterReplayMode(game);
        GameStatusUI.updateReplayUI(game);
        GameStatusUI.exitReplayMode(game);
    });

    test('TutorUI branches', () => {
        game.getTutorHints = () => [
            { move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, notation: 'a1', index: 0, analysis: { category: 'excellent', qualityLabel: 'Ex', tacticalExplanations: ['T'], strategicExplanations: ['S'], warnings: ['W'], questions: ['Q'] } },
            { move: { from: { r: 0, c: 1 }, to: { r: 1, c: 2 } }, notation: 'b1', index: 1, analysis: { category: 'good', qualityLabel: 'Gd', tacticalExplanations: [], strategicExplanations: [], warnings: [], questions: [] } }
        ];
        TutorUI.showTutorSuggestions(game);
        TutorUI.updateTutorRecommendations(game);

        const card = document.querySelector('.setup-template-card');
        if (card) card.click();

        const toggle = document.getElementById('toggle-tutor-recommendations');
        if (toggle) toggle.click();
    });
});
