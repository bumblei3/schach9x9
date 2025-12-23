import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
    renderBoard: jest.fn(), showModal: jest.fn(),
    updateStatus: jest.fn(),
    updateShopUI: jest.fn(),
    updateClockUI: jest.fn(),
    updateClockDisplay: jest.fn(),
    updateStatistics: jest.fn(),
    updateMoveHistoryUI: jest.fn(),
    updateCapturedUI: jest.fn(),
    showShop: jest.fn(),
    showPromotionUI: jest.fn(),
    animateMove: jest.fn().mockResolvedValue(),
    animateCheck: jest.fn(),
    addMoveToHistory: jest.fn(),
    renderEvalGraph: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: {
        init: jest.fn(),
        playMove: jest.fn(),
        playCapture: jest.fn(),
        playCheck: jest.fn(),
        playCheckmate: jest.fn(),
        playGameStart: jest.fn(),
        playGameOver: jest.fn(),
    },
}));

// Import controllers AFTER mocking
const { GameController } = await import('../js/gameController.js');
const { MoveController } = await import('../js/moveController.js');

describe('Integration Tests', () => {
    let game;
    let gameController;
    let moveController;

    beforeEach(() => {
        // Mock DOM elements
        global.document.getElementById = jest.fn((id) => ({
            textContent: '',
            innerHTML: '',
            classList: { add: jest.fn(), remove: jest.fn() },
            style: {},
            disabled: false,
            appendChild: jest.fn(),
            value: '',
            checked: false,
            scrollTop: 0,
            scrollHeight: 100,
        }));

        global.document.querySelector = jest.fn(() => ({
            classList: { add: jest.fn(), remove: jest.fn() },
            innerHTML: '',
            parentElement: {},
        }));

        global.document.querySelectorAll = jest.fn(() => []);
        global.document.createElement = jest.fn(() => ({
            classList: { add: jest.fn(), remove: jest.fn() },
            dataset: {},
            addEventListener: jest.fn(),
            appendChild: jest.fn(),
            innerHTML: '',
            style: {},
        }));

        // Mock window.confirm
        global.confirm = jest.fn(() => true);
        global.alert = jest.fn();

        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        // Initialize Game and Controllers
        game = new Game(15, 'setup');
        gameController = new GameController(game);
        moveController = new MoveController(game);

        game.gameController = gameController;
        game.moveController = moveController;

        // Mock AI Engine if needed
        game.aiEngine = {
            makeMove: jest.fn(),
        };
    });

    describe('Full Game Setup Flow', () => {
        test('should complete full setup: white king → black king → pieces → play', async () => {
            // Phase 1: White King Placement
            expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);

            // Place white king in middle corridor
            gameController.placeKing(7, 4, 'white');
            expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);
            expect(game.whiteCorridor).toBeDefined();

            // Phase 2: Black King Placement  
            gameController.placeKing(1, 4, 'black');
            expect(game.phase).toBe(PHASES.SETUP_WHITE_PIECES);
            expect(game.blackCorridor).toBeDefined();

            // Phase 3: White Piece Setup
            gameController.selectShopPiece('p');
            gameController.placeShopPiece(6, 3);
            gameController.selectShopPiece('r');
            gameController.placeShopPiece(8, 3);
            gameController.finishSetupPhase();

            expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);

            // Phase 4: Black Piece Setup
            gameController.selectShopPiece('p');
            gameController.placeShopPiece(2, 3);
            gameController.selectShopPiece('r');
            gameController.placeShopPiece(0, 3);
            gameController.finishSetupPhase();

            // Should now be in PLAY phase
            expect(game.phase).toBe(PHASES.PLAY);
            expect(game.turn).toBe('white');
        });

        test('should handle classic mode initialization', () => {
            // Re-init with classic mode
            game = new Game(15, 'classic');
            gameController = new GameController(game);
            moveController = new MoveController(game);
            game.gameController = gameController;
            game.moveController = moveController;

            // Classic mode should skip setup and go straight to PLAY
            // Note: Game constructor sets phase to PLAY for classic, 
            // but GameController constructor handles initialization logic
            expect(game.phase).toBe(PHASES.PLAY);
            expect(game.board[8][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
            expect(game.board[0][4]).toEqual({ type: 'k', color: 'black', hasMoved: false });
        });
    });

    describe('Save/Load Round Trip', () => {
        test('should save and load game state correctly', async () => {
            // Setup classic game
            game = new Game(15, 'classic');
            gameController = new GameController(game);
            moveController = new MoveController(game);
            game.gameController = gameController;
            game.moveController = moveController;

            // Make some moves
            const from = { r: 7, c: 4 }; // Pawn at 7,4
            const to = { r: 6, c: 4 };   // Move to 6,4
            await moveController.executeMove(from, to);

            // Save game
            gameController.saveGame();
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'schach9x9_save',
                expect.any(String)
            );

            // Get saved data
            const savedData = localStorage.setItem.mock.calls[0][1];
            const parsedData = JSON.parse(savedData);

            // Verify save structure
            expect(parsedData).toHaveProperty('board');
            expect(parsedData).toHaveProperty('turn');
            expect(parsedData).toHaveProperty('phase');

            // Create new game and load
            const newGame = new Game(15, 'classic');
            const newGameController = new GameController(newGame);
            const newMoveController = new MoveController(newGame);
            newGame.gameController = newGameController;
            newGame.moveController = newMoveController;

            localStorage.getItem.mockReturnValue(savedData);
            newGameController.loadGame();

            // Verify loaded state matches
            expect(newGame.turn).toBe(game.turn);
            // Note: moveHistory might be handled differently in save/load depending on implementation
            // gameController.saveGame saves 'history' property, moveController uses 'moveHistory'
            // Let's check if board state is restored
            expect(newGame.board[6][4]).toEqual(expect.objectContaining({ type: 'p', color: 'white' }));
        });
    });

    describe('Move Execution and Undo', () => {
        test('should execute move → undo → redo correctly', async () => {
            game = new Game(15, 'classic');
            gameController = new GameController(game);
            moveController = new MoveController(game);
            game.gameController = gameController;
            game.moveController = moveController;

            const from = { r: 7, c: 4 }; // Pawn at 7,4
            const to = { r: 6, c: 4 };   // Move to 6,4

            // Execute move
            await moveController.executeMove(from, to);
            expect(game.moveHistory).toHaveLength(1);
            expect(game.board[6][4].type).toBe('p');
            expect(game.board[7][4]).toBeNull();

            // Undo move
            moveController.undoMove();
            expect(game.moveHistory).toHaveLength(0);
            expect(game.board[7][4].type).toBe('p');
            expect(game.board[6][4]).toBeNull();

            // Redo move
            await moveController.redoMove();
            expect(game.moveHistory).toHaveLength(1);
            expect(game.board[6][4].type).toBe('p');
        });
    });

    describe('Game End Scenarios', () => {
        test('should handle resignation', () => {
            game = new Game(15, 'classic');
            gameController = new GameController(game);
            game.gameController = gameController;
            game.phase = PHASES.PLAY;

            gameController.resign('white');

            expect(game.phase).toBe(PHASES.GAME_OVER);
            // Resignation doesn't set game.winner property directly in Game object usually, 
            // but updates UI and logs. We check phase.
        });

        test('should handle draw offer and acceptance', () => {
            game = new Game(15, 'classic');
            gameController = new GameController(game);
            game.gameController = gameController;
            game.phase = PHASES.PLAY;

            gameController.offerDraw('white');
            expect(game.drawOffered).toBe(true);
            expect(game.drawOfferedBy).toBe('white');

            gameController.acceptDraw();
            expect(game.phase).toBe(PHASES.GAME_OVER);
        });
    });

    describe('Time Control Integration', () => {
        test('should handle time running out', () => {
            game = new Game(15, 'classic');
            gameController = new GameController(game);
            game.gameController = gameController;

            gameController.setTimeControl('blitz3');
            game.clockEnabled = true;
            game.phase = PHASES.PLAY;

            // Simulate white time running out
            game.whiteTime = 0;
            gameController.tickClock();

            expect(game.phase).toBe(PHASES.GAME_OVER);
        });
    });

    describe('AI Integration', () => {
        test('should handle AI game setup', () => {
            game = new Game(15, 'setup');
            gameController = new GameController(game);
            game.gameController = gameController;

            game.isAI = true;

            // White (human) places king
            gameController.placeKing(7, 4, 'white');

            // AI setup is async (setTimeout), so we need to wait or use fake timers
            // But placeKing sets phase to SETUP_BLACK_KING immediately
            expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);
        });
    });
});
