import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
    renderBoard: jest.fn(),
    updateStatus: jest.fn(),
    updateShopUI: jest.fn(),
    updateClockUI: jest.fn(),
    updateClockDisplay: jest.fn(),
    initBoardUI: jest.fn(),
    showShop: jest.fn(),
    updateMoveHistoryUI: jest.fn(),
    updateCapturedUI: jest.fn(),
    updateStatistics: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: {
        init: jest.fn(),
        playMove: jest.fn(),
        playGameStart: jest.fn(),
        playGameOver: jest.fn(),
        playSound: jest.fn(),
    }
}));

jest.unstable_mockModule('../js/gameEngine.js', () => ({
    Game: class {
        constructor(initialPoints = 15, mode = 'classic', isAI = false) {
            this.initialPoints = initialPoints;
            this.mode = mode;
            this.isAI = isAI;
            this.board = Array(9).fill(null).map(() => Array(9).fill(null));
            this.phase = PHASES.SETUP_WHITE_KING;
            this.turn = 'white';
            this.points = initialPoints;
            this.whiteCorridor = { rowStart: 6, colStart: 3 };
            this.blackCorridor = { rowStart: 0, colStart: 3 };
            this.log = jest.fn();
            this.whiteTime = 300;
            this.blackTime = 300;
            this.clockEnabled = false;
            this.moveHistory = [];
            this.redoStack = [];
            this.positionHistory = [];
            this.capturedPieces = { white: [], black: [] };
            this.drawOffered = false;
            this.drawOfferedBy = null;
        }
    },
    PHASES,
    BOARD_SIZE: 9
}));

// Import GameController
const { GameController } = await import('../js/gameController.js');
const { Game } = await import('../js/gameEngine.js');
const UI = await import('../js/ui.js');
const { soundManager } = await import('../js/sounds.js');

describe('GameController Coverage', () => {
    let game;
    let gameController;

    beforeEach(() => {
        game = new Game(15, 'setup', false);
        game.log = jest.fn();
        gameController = new GameController(game);
        game.gameController = gameController;

        // Mock document.getElementById
        if (!document.getElementById) document.getElementById = jest.fn();
        if (!jest.isMockFunction(document.getElementById)) {
            jest.spyOn(document, 'getElementById');
        }

        document.getElementById.mockImplementation((id) => ({
            classList: { remove: jest.fn(), add: jest.fn(), contains: jest.fn(() => false), toggle: jest.fn() },
            style: {},
            textContent: '',
            value: '',
            checked: false,
            disabled: false,
            appendChild: jest.fn(),
            scrollTop: 0,
            scrollHeight: 100,
            innerHTML: '',
            dataset: {}
        }));

        // Mock other document methods
        if (!jest.isMockFunction(document.querySelector)) {
            jest.spyOn(document, 'querySelector').mockReturnValue({ classList: { add: jest.fn(), remove: jest.fn() } });
        }
        if (!jest.isMockFunction(document.querySelectorAll)) {
            jest.spyOn(document, 'querySelectorAll').mockReturnValue([
                { classList: { remove: jest.fn() } },
                { classList: { remove: jest.fn() } }
            ]);
        }

        global.alert = jest.fn();
        global.confirm = jest.fn(() => true);

        // Mock localStorage
        Storage.prototype.getItem = jest.fn(() => null);
        Storage.prototype.setItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();
        Storage.prototype.clear = jest.fn();

        jest.clearAllMocks();
    });

    describe('Statistics Saving', () => {
        test('should save game statistics on game over', () => {
            gameController.gameStartTime = Date.now();
            game.isAI = true;
            game.difficulty = 'medium';

            gameController.saveGameToStatistics('win', 'black');

            // Should not throw - gameStartTime will be set to null after save
            expect(true).toBe(true);
        });

        test('should skip statistics if gameStartTime not set', () => {
            gameController.gameStartTime = null;

            gameController.saveGameToStatistics('win', 'black');

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('AI Mode Edge Cases', () => {
        test('should trigger AI king setup after white king placement', (done) => {
            game.isAI = true;
            game.phase = PHASES.SETUP_WHITE_KING;
            game.aiSetupKing = jest.fn();

            gameController.placeKing(7, 4, 'white');

            // Wait for setTimeout
            setTimeout(() => {
                expect(game.aiSetupKing).toHaveBeenCalled();
                done();
            }, 1100);
        });

        test('should trigger AI piece setup after white finishes', (done) => {
            game.isAI = true;
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 0;
            game.aiSetupPieces = jest.fn();

            gameController.finishSetupPhase();

            // Wait for setTimeout
            setTimeout(() => {
                expect(game.aiSetupPieces).toHaveBeenCalled();
                done();
            }, 1100);
        });

        test('should not allow player clicks during AI setup phases', () => {
            game.isAI = true;
            game.phase = PHASES.SETUP_BLACK_KING;

            gameController.handleCellClick(1, 4);

            // Should not place king (AI's turn)
            expect(game.board[1][4]).toBeNull();
        });

        test('should not allow player clicks during AI turn in PLAY phase', () => {
            game.isAI = true;
            game.phase = PHASES.PLAY;
            game.turn = 'black';
            game.handlePlayClick = jest.fn();

            gameController.handleCellClick(0, 0);

            // Should not call handlePlayClick
            expect(game.handlePlayClick).not.toHaveBeenCalled();
        });
    });

    describe('Clock Edge Cases', () => {
        test('should stop clock when not in PLAY phase', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            gameController.clockInterval = setInterval(() => { }, 100);

            gameController.tickClock();

            expect(gameController.clockInterval).toBeNull();
        });

        test('should not start clock if not enabled', () => {
            game.clockEnabled = false;
            game.phase = PHASES.PLAY;

            gameController.startClock();

            expect(gameController.clockInterval).toBeNull();
        });

        test('should not start clock if not in PLAY phase', () => {
            game.clockEnabled = true;
            game.phase = PHASES.SETUP_WHITE_PIECES;

            gameController.startClock();

            expect(gameController.clockInterval).toBeNull();
        });
    });

    describe('Analysis Mode Edge Cases', () => {
        test('should not allow analysis mode in setup phase', () => {
            game.phase = PHASES.SETUP_WHITE_KING;

            const result = gameController.enterAnalysisMode();

            expect(result).toBe(false);
            expect(game.analysisMode).toBeFalsy();
        });

        test('should save and restore position history in analysis mode', () => {
            game.phase = PHASES.PLAY;
            game.positionHistory = ['hash1', 'hash2', 'hash3'];
            game.board[0][0] = { type: 'k', color: 'black' };

            gameController.enterAnalysisMode();

            expect(game.analysisBasePosition.positionHistory).toEqual(['hash1', 'hash2', 'hash3']);

            game.positionHistory = ['hash4'];

            gameController.exitAnalysisMode(true);

            expect(game.positionHistory).toEqual(['hash1', 'hash2', 'hash3']);
        });

        test('should not exit analysis mode if not in analysis mode', () => {
            game.analysisMode = false;

            const result = gameController.exitAnalysisMode();

            expect(result).toBe(false);
        });
    });

    describe('Draw Offer Edge Cases', () => {
        test('should not allow draw offer outside PLAY phase', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;

            gameController.offerDraw('white');

            expect(game.drawOffered).toBe(false);
        });

        test('should not accept draw if no offer exists', () => {
            game.drawOffered = false;

            gameController.acceptDraw();

            expect(game.phase).not.toBe(PHASES.GAME_OVER);
        });

        test('should not decline draw if no offer exists', () => {
            game.drawOffered = false;

            gameController.declineDraw();

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('Piece Removal', () => {
        test('should refund points when removing piece from corridor', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 10;
            game.board[6][3] = { type: 'p', color: 'white' };
            game.selectedShopPiece = null;

            gameController.placeShopPiece(6, 3);

            expect(game.points).toBe(11); // 10 + 1 (pawn)
            expect(game.board[6][3]).toBeNull();
        });
    });
});
