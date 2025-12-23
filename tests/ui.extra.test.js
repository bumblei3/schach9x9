import { jest } from '@jest/globals';
import { PHASES, BOARD_SIZE } from '../js/config.js';

// Setup JSDOM body 
document.body.innerHTML = `
    <div id="board"></div>
    <div id="status-display"></div>
    <div id="points-display"></div>
    <div id="selected-piece-display"></div>
    <div id="clock-white"></div>
    <div id="clock-black"></div>
    <div id="game-over-overlay" class="hidden"><div id="winner-text"></div><button id="restart-btn-overlay"></button><button id="close-game-over-btn"></button></div>
    <div id="move-history"></div>
    <div id="captured-white"></div>
    <div id="captured-black"></div>
    <div id="shop-panel" class="hidden"></div>
    <div id="promotion-overlay" class="hidden"><div id="promotion-options"></div></div>
    <div id="tutor-panel" class="hidden"></div>
    <div id="replay-status" class="hidden"></div>
    <div id="replay-exit" class="hidden"></div>
    <div id="replay-move-num"></div>
    <button id="undo-btn"></button>
    <div id="tutor-suggestions"></div>
`;

// Mock PIECE_SVGS
global.window.PIECE_SVGS = {
    white: { p: 'wp', n: 'wn', b: 'wb', r: 'wr', q: 'wq', k: 'wk', a: 'wa', c: 'wc', e: 'we' },
    black: { p: 'bp', n: 'bn', b: 'bb', r: 'br', q: 'bq', k: 'bk', a: 'ba', c: 'bc', e: 'be' }
};
global.window._svgCache = {};

// Mock sounds
jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: { playMove: jest.fn(), playCapture: jest.fn(), playGameOver: jest.fn() }
}));

const UI = await import('../js/ui.js');

describe('UI Final Precision V3', () => {
    let game;

    beforeEach(() => {
        game = {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            phase: PHASES.PLAY,
            turn: 'white',
            points: 15,
            whiteTime: 300,
            blackTime: 300,
            stats: { totalMoves: 10, playerMoves: 5, playerBestMoves: 4, accuracy: 80, captures: 2 },
            capturedPieces: { white: [], black: [] },
            moveHistory: [],
            positionHistory: [],
            _previousBoardState: Array(9).fill(null).map(() => Array(9).fill(null)),
            _forceFullRender: true,
            calculateMaterialAdvantage: jest.fn(() => 5),
            tutorController: { getSetupTemplates: () => [], getTutorHints: () => [] },
            arrowRenderer: { highlightMove: jest.fn(), clearArrows: jest.fn() },
            handleCellClick: jest.fn(),
            getValidMoves: jest.fn(() => [])
        };
        game.board[0][0] = { type: 'k', color: 'white' };
        jest.clearAllMocks();
    });

    test('Drag & Drop full cycle (Line 157-286)', () => {
        UI.initBoardUI(game);
        UI.renderBoard(game);
        const cell = document.querySelector('.cell[data-r="0"][data-c="0"]');

        // Mock Event
        const createEvent = (type, data = {}) => {
            const ev = new Event(type);
            ev.dataTransfer = {
                setData: jest.fn(),
                getData: jest.fn(() => '0,0'),
                setDragImage: jest.fn(),
                effectAllowed: 'move',
                dropEffect: 'move'
            };
            ev.preventDefault = jest.fn();
            Object.assign(ev, data);
            return ev;
        };

        cell.dispatchEvent(createEvent('dragstart'));
        cell.dispatchEvent(createEvent('dragover'));
        cell.dispatchEvent(createEvent('dragleave'));
        cell.dispatchEvent(createEvent('drop'));
        cell.dispatchEvent(createEvent('dragend'));
    });

    test('updateStatus - GAME_OVER branch (Line 1159)', () => {
        game.phase = PHASES.GAME_OVER;
        game.result = 'white';
        UI.updateStatus(game);
        expect(document.getElementById('status-display').textContent).toContain('Weiß hat gewonnen');
    });

    test('updateClockDisplay - zero time fixed', () => {
        game.whiteTime = 0;
        UI.updateClockDisplay(game);
        expect(document.getElementById('clock-white').textContent).toBe('0:00');
    });

    test('updateClockUI - low time warning (Line 1120)', () => {
        game.whiteTime = 10;
        UI.updateClockUI(game);
        expect(document.getElementById('clock-white').classList.contains('low-time')).toBe(true);
    });

    test('renderBoard - highlights sweep', () => {
        game.lastMoveHighlight = { from: { r: 0, c: 0 }, to: { r: 0, c: 1 } };
        game.selectedSquare = { r: 0, c: 0 };
        UI.renderBoard(game);
        // Cover Line 310 etc.
    });
});
