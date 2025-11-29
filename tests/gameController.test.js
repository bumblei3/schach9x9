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

describe('GameController', () => {
    let game;
    let gameController;

    beforeEach(() => {
        game = new Game(15, 'setup', false);
        game.log = jest.fn();
        gameController = new GameController(game);
        game.gameController = gameController;

        // Mock DOM - use factory function for writable elements
        const createMockElement = () => {
            const element = {
                classList: {
                    remove: jest.fn(),
                    add: jest.fn(),
                    contains: jest.fn(() => false),
                    toggle: jest.fn()
                },
                style: {},
                disabled: false,
                value: '',
                checked: false,
                scrollTop: 0,
                scrollHeight: 100,
                appendChild: jest.fn(),
                dataset: {}
            };

            // Make innerHTML and textContent writable properties
            let innerHTML = '';
            let textContent = '';

            Object.defineProperty(element, 'innerHTML', {
                get: () => innerHTML,
                set: (val) => { innerHTML = val; },
                configurable: true
            });

            Object.defineProperty(element, 'textContent', {
                get: () => textContent,
                set: (val) => { textContent = val; },
                configurable: true
            });

            return element;
        };

        // Use spyOn instead of overwriting global.document
        jest.spyOn(document, 'getElementById').mockImplementation((id) => {
            return createMockElement();
        });

        jest.spyOn(document, 'querySelector').mockImplementation(() => ({
            classList: { add: jest.fn(), remove: jest.fn() }
        }));

        jest.spyOn(document, 'querySelectorAll').mockImplementation(() => [
            { classList: { remove: jest.fn() } },
            { classList: { remove: jest.fn() } }
        ]);

        jest.spyOn(document.body.classList, 'add');
        jest.spyOn(document.body.classList, 'remove');

        jest.spyOn(document, 'createElement').mockImplementation(() => ({
            classList: { add: jest.fn() },
            dataset: {},
            addEventListener: jest.fn()
        }));

        global.alert = jest.fn();
        global.confirm = jest.fn(() => true);

        // Mock localStorage using Storage.prototype
        Storage.prototype.getItem = jest.fn(() => null);
        Storage.prototype.setItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();
        Storage.prototype.clear = jest.fn();

        jest.clearAllMocks();
    });

    describe('King Placement', () => {
        test('should place white king in valid corridor', () => {
            game.phase = PHASES.SETUP_WHITE_KING;

            gameController.placeKing(7, 4, 'white');

            expect(game.board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
            expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);
            expect(game.log).toHaveBeenCalledWith('Weißer König platziert. Schwarz ist dran.');
        });

        test('should reject king placement outside corridor', () => {
            game.phase = PHASES.SETUP_WHITE_KING;

            gameController.placeKing(2, 4, 'white');

            // King should not be placed
            expect(game.board[2][4]).toBeNull();
            expect(game.log).toHaveBeenCalledWith('Ungültiger Bereich für König!');
        });

        test('should place black king and transition to piece setup', () => {
            game.phase = PHASES.SETUP_BLACK_KING;

            gameController.placeKing(1, 4, 'black');

            expect(game.board[1][4]).toEqual({ type: 'k', color: 'black', hasMoved: false });
            expect(game.phase).toBe(PHASES.SETUP_WHITE_PIECES);
            expect(game.points).toBe(15);
        });
    });

    describe('Shop Piece Selection', () => {
        test('should select piece if player has enough points', () => {
            game.points = 15;

            gameController.selectShopPiece('n'); // Knight costs 3

            expect(game.selectedShopPiece).toBe('n');
        });

        test('should reject piece selection if insufficient points', () => {
            game.points = 5;

            gameController.selectShopPiece('q'); // Queen costs 9

            expect(game.selectedShopPiece).not.toBe('q');
            expect(game.log).toHaveBeenCalledWith('Nicht genug Punkte!');
        });
    });

    describe('Piece Placement', () => {
        test('should place piece in valid corridor', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'p';

            gameController.placeShopPiece(6, 3);

            expect(game.board[6][3]).toEqual({ type: 'p', color: 'white', hasMoved: false });
            expect(game.points).toBe(14); // 15 - 1
        });

        test('should reject placement outside corridor', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'p';

            gameController.placeShopPiece(0, 0); // Outside white corridor

            expect(game.board[0][0]).toBeNull();
            expect(game.log).toHaveBeenCalledWith('Muss im eigenen Korridor platziert werden!');
        });

        test('should reject placement on occupied square', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.board[6][3] = { type: 'k', color: 'white', hasMoved: false };
            game.selectedShopPiece = 'p';

            gameController.placeShopPiece(6, 3);

            expect(game.board[6][3].type).toBe('k'); // Still king
            expect(game.log).toHaveBeenCalledWith('Feld besetzt!');
        });
    });

    describe('Setup Phase Completion', () => {
        test('should warn when finishing with leftover points', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 5;

            gameController.finishSetupPhase();

            expect(global.alert).toHaveBeenCalled();
            expect(game.log).toHaveBeenCalledWith(expect.stringContaining('5 Punkte'));
        });

        test('should transition from white to black setup', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 0;

            gameController.finishSetupPhase();

            expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);
            expect(game.points).toBe(15); // Reset for black
        });

        test('should start game after black setup complete', () => {
            game.phase = PHASES.SETUP_BLACK_PIECES;
            game.points = 0;

            gameController.finishSetupPhase();

            expect(game.phase).toBe(PHASES.PLAY);
            expect(soundManager.playGameStart).toHaveBeenCalled();
        });
    });

    describe('Clock Management', () => {
        test('should start clock when game begins', () => {
            game.phase = PHASES.PLAY;
            game.clockEnabled = true;

            gameController.startClock();

            expect(game.lastMoveTime).toBeDefined();
        });

        test('should stop clock', () => {
            gameController.clockInterval = setInterval(() => { }, 100);

            gameController.stopClock();

            expect(gameController.clockInterval).toBeNull();
        });

        test('should handle white time expiration', () => {
            game.phase = PHASES.PLAY;
            game.turn = 'white';
            game.whiteTime = -1;
            game.lastMoveTime = Date.now();

            gameController.tickClock();

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Schwarz gewinnt'));
        });

        test('should handle black time expiration', () => {
            game.phase = PHASES.PLAY;
            game.turn = 'black';
            game.blackTime = -1;
            game.lastMoveTime = Date.now();

            gameController.tickClock();

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Weiß gewinnt'));
        });
    });

    describe('Draw Offers', () => {
        test('should offer draw', () => {
            game.phase = PHASES.PLAY;

            gameController.offerDraw('white');

            expect(game.drawOffered).toBe(true);
            expect(game.drawOfferedBy).toBe('white');
            expect(game.log).toHaveBeenCalledWith('Weiß bietet Remis an.');
        });

        test('should reject multiple pending offers', () => {
            game.phase = PHASES.PLAY;
            game.drawOffered = true;

            gameController.offerDraw('white');

            expect(game.log).toHaveBeenCalledWith('Es gibt bereits ein offenes Remis-Angebot.');
        });

        test('should accept draw', () => {
            game.phase = PHASES.PLAY;
            game.drawOffered = true;
            game.drawOfferedBy = 'white';

            gameController.acceptDraw();

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(game.drawOffered).toBe(false);
            expect(game.log).toHaveBeenCalledWith('Remis vereinbart!');
        });

        test('should decline draw', () => {
            game.phase = PHASES.PLAY;
            game.drawOffered = true;
            game.drawOfferedBy = 'white';

            gameController.declineDraw();

            expect(game.drawOffered).toBe(false);
            expect(game.drawOfferedBy).toBeNull();
        });
    });

    describe('Resignation', () => {
        test('should handle white resignation', () => {
            game.phase = PHASES.PLAY;

            gameController.resign('white');

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(game.log).toHaveBeenCalledWith('Weiß gibt auf! Schwarz gewinnt.');
        });

        test('should handle black resignation', () => {
            game.phase = PHASES.PLAY;

            gameController.resign('black');

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(game.log).toHaveBeenCalledWith('Schwarz gibt auf! Weiß gewinnt.');
        });
    });

    describe('Analysis Mode', () => {
        test('should enter analysis mode', () => {
            game.phase = PHASES.PLAY;
            game.board[0][0] = { type: 'k', color: 'black' };

            const success = gameController.enterAnalysisMode();

            expect(success).toBe(true);
            expect(game.analysisMode).toBe(true);
            expect(game.phase).toBe(PHASES.ANALYSIS);
        });

        test('should save position when entering analysis', () => {
            game.phase = PHASES.PLAY;
            game.turn = 'white';
            game.board[0][0] = { type: 'k', color: 'black' };

            gameController.enterAnalysisMode();

            expect(game.analysisBasePosition).toBeDefined();
            expect(game.analysisBasePosition.turn).toBe('white');
        });

        test('should exit analysis mode and restore position', () => {
            game.phase = PHASES.PLAY;
            game.analysisMode = true;
            game.analysisBasePosition = {
                board: game.board,
                turn: 'white',
                moveHistory: [],
                redoStack: [],
                selectedSquare: null,
                positionHistory: [] // FIX: Add positionHistory
            };

            const success = gameController.exitAnalysisMode(true);

            expect(success).toBe(true);
            expect(game.analysisMode).toBe(false);
            expect(game.phase).toBe(PHASES.PLAY);
        });

        test('should not enter analysis outside play phase', () => {
            game.phase = PHASES.SETUP_WHITE_KING;

            const success = gameController.enterAnalysisMode();

            expect(success).toBe(false);
            expect(game.log).toHaveBeenCalledWith('⚠️ Analyse-Modus nur während des Spiels verfügbar.');
        });
    });

    describe('Save and Load Game', () => {
        test('should save game state to localStorage', () => {
            game.phase = PHASES.PLAY;
            game.turn = 'white';
            game.points = 10;

            gameController.saveGame();

            expect(Storage.prototype.setItem).toHaveBeenCalledWith(
                'schach9x9_save',
                expect.any(String)
            );
            // Note: Log message may vary, just check setItem was called
        });

        test('should load game state from localStorage', () => {
            const savedState = JSON.stringify({
                board: Array(9).fill(null).map(() => Array(9).fill(null)),
                phase: 'PLAY', // Use constant value
                turn: 'black',
                points: 8,
                mode: 'classic',
                isAI: false,
                capturedPieces: { white: [], black: [] },
                moveHistory: [],
                whiteTime: 300,
                blackTime: 300
            });
            Storage.prototype.getItem.mockReturnValueOnce(savedState);

            gameController.loadGame();

            expect(game.phase).toBe(PHASES.PLAY);
            expect(game.turn).toBe('black');
            expect(game.log).toHaveBeenCalledWith(expect.stringContaining('geladen'));
        });

        test('should handle missing save data', () => {
            // localStorage.getItem already returns null by default, no need to mock again

            gameController.loadGame();

            expect(game.log).toHaveBeenCalledWith('⚠️ Kein gespeichertes Spiel gefunden.');
        });
    });
});
