import { jest } from '@jest/globals';
import { PHASES, BOARD_SIZE } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/utils.js', () => ({
    debounce: jest.fn(fn => fn),
    formatTime: jest.fn(t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`)
}));

jest.unstable_mockModule('../js/effects.js', () => ({
    particleSystem: {
        spawn: jest.fn()
    }
}));

// Import UI module
const UI = await import('../js/ui.js');

describe('UI Module - Coverage Boost', () => {
    let game;

    beforeEach(() => {
        // Mock Game state
        game = {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            phase: PHASES.PLAY,
            turn: 'white',
            whiteTime: 300,
            blackTime: 300,
            points: 15,
            whiteCorridor: { rowStart: 6, colStart: 3 },
            blackCorridor: { rowStart: 0, colStart: 3 },
            lastMove: null,
            lastMoveHighlight: null,
            selectedSquare: null,
            validMoves: null,
            moveHistory: [],
            capturedPieces: { white: [], black: [] },
            isAI: false,
            isAnimating: false,
            replayMode: false,
            _previousBoardState: null,
            _forceFullRender: false
        };

        // Setup window globals
        window.PIECE_SVGS = {
            white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
            black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' }
        };
        window._svgCache = {};

        document.body.innerHTML = `
      <div id="board-wrapper">
        <div id="board"></div>
      </div>
      <div id="status-display"></div>
      <div id="move-history"></div>
      <div id="captured-white"></div>
      <div id="captured-black"></div>
      <div id="clock-white"></div>
      <div id="clock-black"></div>
      <div id="shop-panel" class="hidden"></div>
      <div id="points-display"></div>
      <div id="undo-btn"></div>
      <div id="finish-setup-btn"></div>
      <div id="selected-piece-display"></div>
      <div id="tutor-recommendations-section"></div>
      <div id="tutor-recommendations-container"></div>
      <button id="toggle-tutor-recommendations"></button>
    `;

        jest.clearAllMocks();
    });

    describe('updateMoveHistoryUI', () => {
        test('should handle various move types (castling, promotion, etc.)', () => {
            game.moveHistory = [
                {
                    from: { r: 6, c: 4 }, to: { r: 5, c: 4 },
                    piece: { type: 'p', color: 'white' }
                },
                {
                    from: { r: 1, c: 4 }, to: { r: 2, c: 4 },
                    piece: { type: 'p', color: 'black' },
                    capturedPiece: { type: 'p', color: 'white' }
                },
                {
                    from: { r: 8, c: 4 }, to: { r: 8, c: 6 },
                    piece: { type: 'k', color: 'white' },
                    specialMove: { type: 'castling', isKingside: true }
                },
                {
                    from: { r: 1, c: 0 }, to: { r: 0, c: 0 },
                    piece: { type: 'p', color: 'white' },
                    specialMove: { type: 'promotion', promotedTo: 'q' }
                },
                {
                    from: { r: 1, c: 4 }, to: { r: 0, c: 4 },
                    piece: { type: 'p', color: 'white' },
                    specialMove: { type: 'enPassant' }
                }
            ];

            UI.updateMoveHistoryUI(game);

            const entries = document.querySelectorAll('.move-entry');
            expect(entries.length).toBe(5);
            expect(entries[2].textContent).toContain('O-O'); // Castling
            expect(entries[1].textContent).toContain('exe7'); // Pawn capture
            expect(entries[3].textContent).toContain('=Q'); // Promotion
        });

        test('should handle error in move history', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            game.moveHistory = [{ from: null }];

            UI.updateMoveHistoryUI(game);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('updateCapturedUI', () => {
        test('should calculate material advantage correctly', () => {
            game.board[4][4] = { type: 'q', color: 'white' };
            game.board[4][5] = { type: 'r', color: 'white' };
            game.board[0][0] = { type: 'r', color: 'black' };

            game.capturedPieces.white = [{ type: 'p', color: 'black' }];
            game.capturedPieces.black = [{ type: 'p', color: 'white' }];

            UI.updateCapturedUI(game);

            const whiteAdv = document.querySelector('.material-advantage.white-adv');
            expect(whiteAdv.textContent).toBe('+9');
        });

        test('should show advantage for black', () => {
            game.board[4][4] = { type: 'p', color: 'white' };
            game.board[0][0] = { type: 'q', color: 'black' };

            UI.updateCapturedUI(game);

            const blackAdv = document.querySelector('.material-advantage.black-adv');
            expect(blackAdv.textContent).toBe('+8');
        });
    });

    describe('renderBoard - Phase Specifics', () => {
        test('should highlight selectable corridors in setup phase', () => {
            game.phase = PHASES.SETUP_WHITE_KING;
            UI.initBoardUI(game);
            UI.renderBoard(game);

            const corridors = document.querySelectorAll('.selectable-corridor');
            expect(corridors.length).toBe(27);
        });

        test('should highlight own corridor during piece setup', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.whiteCorridor = { rowStart: 6, colStart: 3 };
            UI.initBoardUI(game);
            UI.renderBoard(game);

            const highlighted = document.querySelectorAll('.selectable-corridor');
            expect(highlighted.length).toBe(9);
        });

        test('should highlight threatened pieces', () => {
            game.phase = PHASES.PLAY;
            game.board[4][4] = { type: 'k', color: 'white' };
            game.isSquareUnderAttack = jest.fn((r, c, color) => color === 'black');

            UI.initBoardUI(game);
            UI.renderBoard(game);

            const threatened = document.querySelector('.cell.threatened');
            expect(threatened).not.toBeNull();
        });
    });

    describe('updateStatus', () => {
        test('should update status for all phases', () => {
            const statusEl = document.getElementById('status-display');

            const phasesToTest = [
                { phase: PHASES.SETUP_WHITE_KING, expected: 'Weiß: Wähle einen Korridor für den König' },
                { phase: PHASES.SETUP_BLACK_KING, expected: 'Schwarz: Wähle einen Korridor för den König' },
                { phase: PHASES.SETUP_WHITE_PIECES, expected: 'Weiß: Kaufe Truppen' },
                { phase: PHASES.SETUP_BLACK_PIECES, expected: 'Schwarz: Kaufe Truppen' },
                { phase: PHASES.PLAY, expected: 'Spiel läuft - Weiß am Zug' },
                { phase: PHASES.ANALYSIS, expected: 'Analyse-Modus' },
                { phase: PHASES.GAME_OVER, expected: 'Spiel vorbei!' }
            ];

            phasesToTest.forEach(({ phase, expected }) => {
                game.phase = phase;
                UI.updateStatus(game);
                expect(statusEl.textContent).toContain(expected);
            });
        });
    });

    describe('Shop UI', () => {
        test('should show and hide shop', () => {
            const panel = document.getElementById('shop-panel');
            UI.showShop(game, true);
            expect(panel.classList.contains('hidden')).toBe(false);
            expect(document.body.classList.contains('setup-mode')).toBe(true);

            UI.showShop(game, false);
            expect(panel.classList.contains('hidden')).toBe(true);
            expect(document.body.classList.contains('setup-mode')).toBe(false);
        });

        test('should update shop display with selected piece', () => {
            game.selectedShopPiece = 'q';
            game.turn = 'white';
            const display = document.getElementById('selected-piece-display');

            UI.updateShopUI(game);

            expect(display.textContent).toContain('Platziere: ♕');
        });
    });

    describe('showPromotionUI', () => {
        test('should show promotion options and handle click', () => {
            document.body.innerHTML += `
                <div id="promotion-overlay" class="hidden">
                    <div id="promotion-options"></div>
                </div>
            `;
            const overlay = document.getElementById('promotion-overlay');
            const options = document.getElementById('promotion-options');
            const callback = jest.fn();

            game.board[0][4] = { type: 'p', color: 'white' };
            UI.showPromotionUI(game, 0, 4, 'white', {}, callback);

            expect(overlay.classList.contains('hidden')).toBe(false);
            const promoBtns = options.querySelectorAll('.promotion-option');
            expect(promoBtns.length).toBeGreaterThan(0);

            // Simulate click on second option (Queen)
            promoBtns[1].click();
            expect(game.board[0][4].type).toBe('q');
            expect(callback).toHaveBeenCalled();
            expect(overlay.classList.contains('hidden')).toBe(true);
        });
    });

    describe('animateMove', () => {
        test('should execute move animation', async () => {
            const from = { r: 6, c: 4 };
            const to = { r: 5, c: 4 };
            const piece = { type: 'p', color: 'white' };

            UI.initBoardUI(game);
            const fromCell = document.querySelector('.cell[data-r="6"][data-c="4"]');
            const toCell = document.querySelector('.cell[data-r="5"][data-c="4"]');

            // Mock getBoundingClientRect
            fromCell.getBoundingClientRect = jest.fn(() => ({ left: 100, top: 100, width: 50, height: 50 }));
            toCell.getBoundingClientRect = jest.fn(() => ({ left: 100, top: 50, width: 50, height: 50 }));

            const animationPromise = UI.animateMove(game, from, to, piece);

            expect(game.isAnimating).toBe(true);

            // Fast-forward timers for setTimeout(..., 250)
            jest.useFakeTimers();
            jest.advanceTimersByTime(250);

            await animationPromise;
            expect(game.isAnimating).toBe(false);
            jest.useRealTimers();
        });
    });

    describe('showTutorSuggestions', () => {
        test('should create and show tutor modal', () => {
            // Mock necessary elements
            document.body.innerHTML += `
                <div id="tutor-overlay" class="hidden">
                    <div id="tutor-hints-body"></div>
                </div>
                <button id="close-tutor-btn"></button>
            `;

            game.tutorController = {
                getTutorHints: jest.fn(() => [
                    {
                        move: { from: { r: 6, c: 3 }, to: { r: 4, c: 3 } },
                        analysis: {
                            qualityLabel: 'Brilliant',
                            scoreDiff: 1.5,
                            tacticalExplanations: ['Great move'],
                            strategicExplanations: ['Winning']
                        }
                    }
                ])
            };

            UI.showTutorSuggestions(game);

            const overlay = document.getElementById('tutor-overlay');
            expect(overlay.classList.contains('hidden')).toBe(false);
            expect(game.tutorController.getTutorHints).toHaveBeenCalled();
        });
    });
});
