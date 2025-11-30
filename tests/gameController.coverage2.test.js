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

//Import GameController
const { GameController } = await import('../js/gameController.js');
const { Game } = await import('../js/gameEngine.js');
const UI = await import('../js/ui.js');

describe('GameController Additional Coverage', () => {
    let game;
    let gameController;

    beforeEach(() => {
        game = new Game(15, 'setup', false);
        game.log = jest.fn();
        gameController = new GameController(game);
        game.gameController = gameController;

        // Mock document methods
        if (!jest.isMockFunction(document.getElementById)) {
            jest.spyOn(document, 'getElementById');
        }

        document.getElementById.mockImplementation((id) => ({
            classList: { remove: jest.fn(), add: jest.fn(), contains: jest.fn(() => false) },
            style: {},
            textContent: '',
            value: '',
            checked: false,
            disabled: false,
            appendChild: jest.fn(),
            innerHTML: '',
            dataset: {}
        }));

        if (!jest.isMockFunction(document.querySelector)) {
            jest.spyOn(document, 'querySelector').mockReturnValue({ classList: { add: jest.fn(), remove: jest.fn() } });
        }
        if (!jest.isMockFunction(document.querySelectorAll)) {
            jest.spyOn(document, 'querySelectorAll').mockReturnValue([
                { classList: { remove: jest.fn() } }
            ]);
        }

        global.alert = jest.fn();
        global.confirm = jest.fn(() => true);

        jest.clearAllMocks();
    });

    test('should handle animating flag during cell click', () => {
        game.isAnimating = true;
        game.phase = PHASES.PLAY;

        gameController.handleCellClick(4, 4);

        // Should not do anything when animating
        expect(UI.renderBoard).not.toHaveBeenCalled();
    });

    test('should handle corridor placement calculation', () => {
        game.phase = PHASES.SETUP_WHITE_KING;

        // Place king in row 7, column 4 (middle of board)
        gameController.placeKing(7, 4, 'white');

        // King should be centered in the corridor
        expect(game.board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
    });

    test('should reject piece selection without shop piece', () => {
        game.phase = PHASES.SETUP_WHITE_PIECES;
        game.selectedShopPiece = null;

        gameController.placeShopPiece(6, 3);

        expect(game.log).toHaveBeenCalledWith('Bitte zuerst eine Figur im Shop auswählen!');
    });

    test('should handle AI draw offer evaluation', () => {
        game.phase = PHASES.PLAY;
        game.isAI = true;
        game.turn = 'white';
        game.aiEvaluateDrawOffer = jest.fn();

        gameController.offerDraw('white');

        // Should not show dialog to AI
        expect(game.drawOffered).toBe(true);
    });

    test('should handle replay mode blocking', () => {
        game.replayMode = true;
        game.phase = PHASES.PLAY;

        gameController.handleCellClick(4, 4);

        // Should not process click
        expect(UI.renderBoard).not.toHaveBeenCalled();
    });
});
