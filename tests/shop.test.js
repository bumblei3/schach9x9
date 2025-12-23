import { jest } from '@jest/globals';
import { Game, createEmptyBoard } from '../js/gameEngine.js';
import { PHASES, PIECE_VALUES } from '../js/config.js';

// Mock UI module
jest.unstable_mockModule('../js/ui.js', () => ({
    renderBoard: jest.fn(), showModal: jest.fn(),
    updateShopUI: jest.fn(),
    updateStatus: jest.fn(),
    renderEvalGraph: jest.fn(),
}));

// Mock sounds module
jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: {
        playMove: jest.fn(),
        init: jest.fn(),
    },
}));

// Mock DOM
global.document = {
    getElementById: jest.fn((id) => ({
        classList: { remove: jest.fn(), add: jest.fn() },
        style: {},
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        appendChild: jest.fn(),
        scrollTop: 0,
        scrollHeight: 100,
        innerHTML: '',
    })),
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(() => null),
};

// Import after mocking
const { GameController } = await import('../js/gameController.js');
const UI = await import('../js/ui.js');

describe('Shop System', () => {
    let game;
    let gameController;

    beforeEach(() => {
        game = new Game(15, 'setup', false); // 15 points, setup mode, no AI
        gameController = new GameController(game);
        game.gameController = gameController;
        game.log = jest.fn();

        // Set up corridors for testing
        game.whiteCorridor = { rowStart: 6, colStart: 0 };
        game.blackCorridor = { rowStart: 0, colStart: 0 };

        jest.clearAllMocks();
    });

    describe('Point Deduction', () => {
        test('should deduct correct points when placing a pawn', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'p';

            gameController.placeShopPiece(6, 0);

            expect(game.points).toBe(14); // 15 - 1 = 14
            expect(game.board[6][0]).toEqual({ type: 'p', color: 'white', hasMoved: false });
        });

        test('should deduct correct points when placing a queen', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'q';

            gameController.placeShopPiece(6, 0);

            expect(game.points).toBe(6); // 15 - 9 = 6
            expect(game.board[6][0]).toEqual({ type: 'q', color: 'white', hasMoved: false });
        });

        test('should deduct correct points for Angel piece', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'e';

            gameController.placeShopPiece(6, 0);

            expect(game.points).toBe(3); // 15 - 12 = 3
            expect(game.board[6][0]).toEqual({ type: 'e', color: 'white', hasMoved: false });
        });

        test('should NOT place piece if insufficient points', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 5;
            game.selectedShopPiece = 'q'; // Costs 9

            gameController.placeShopPiece(6, 0);

            expect(game.points).toBe(5); // No change
            expect(game.board[6][0]).toBeNull(); // Not placed
        });

        test('should allow multiple purchases with remaining points', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;

            // Buy a rook (5 points)
            game.selectedShopPiece = 'r';
            gameController.placeShopPiece(6, 0);
            expect(game.points).toBe(10);

            // Buy a knight (3 points)
            game.selectedShopPiece = 'n';
            gameController.placeShopPiece(6, 1);
            expect(game.points).toBe(7);

            // Buy a bishop (3 points)
            game.selectedShopPiece = 'b';
            gameController.placeShopPiece(6, 2);
            expect(game.points).toBe(4);
        });
    });

    describe('Piece Placement Validation', () => {
        test('should only allow placement in own corridor', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'p';

            // Try to place outside corridor (row 0 is black's corridor)
            gameController.placeShopPiece(0, 0);

            expect(game.board[0][0]).toBeNull();
            expect(game.points).toBe(15); // No points deducted
            expect(game.log).toHaveBeenCalledWith('Muss im eigenen Korridor platziert werden!');
        });

        test('should NOT allow placement on occupied square', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 15;
            game.board[6][0] = { type: 'r', color: 'white', hasMoved: false };
            game.selectedShopPiece = 'p';

            gameController.placeShopPiece(6, 0);

            expect(game.board[6][0].type).toBe('r'); // Still a rook
            expect(game.points).toBe(15); // No points deducted
            expect(game.log).toHaveBeenCalledWith('Feld besetzt!');
        });

        test('should place piece for black during black setup phase', () => {
            game.phase = PHASES.SETUP_BLACK_PIECES;
            game.points = 15;
            game.selectedShopPiece = 'n';

            gameController.placeShopPiece(0, 0);

            expect(game.board[0][0]).toEqual({ type: 'n', color: 'black', hasMoved: false });
            expect(game.points).toBe(12); // 15 - 3 = 12
        });
    });

    describe('Piece Removal and Refund', () => {
        // Note: Refund test skipped due to complex PIECES symbol lookup in gameController
        test('should refund points when removing own piece', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 10;
            game.board[6][0] = { type: 'r', color: 'white', hasMoved: false };
            game.selectedShopPiece = null; // No piece selected (removal mode)

            gameController.placeShopPiece(6, 0);

            // The piece should be removed
            expect(game.board[6][0]).toBeNull();
            // Points should be refunded (rook costs 5)
            expect(game.points).toBe(15); // 10 + 5 = 15
        });

        test('should NOT remove king piece', () => {
            game.phase = PHASES.SETUP_WHITE_PIECES;
            game.points = 10;
            game.board[6][0] = { type: 'k', color: 'white', hasMoved: false };
            game.selectedShopPiece = null;

            gameController.placeShopPiece(6, 0);

            expect(game.board[6][0]).not.toBeNull(); // King still there
            expect(game.board[6][0].type).toBe('k');
            expect(game.points).toBe(10); // No refund
        });
    });

    describe('AI Purchase Logic', () => {
        test('should use correct piece symbols when purchasing', () => {
            game.phase = PHASES.SETUP_BLACK_PIECES;
            game.points = 15;
            game.isAI = true;

            // Mock AI controller
            const aiController = {
                game: game,
            };

            // Manually set the piece using the symbol (simulating fixed AI logic)
            game.selectedShopPiece = 'q'; // Should be symbol, not 'QUEEN'

            gameController.placeShopPiece(0, 0);

            expect(game.board[0][0].type).toBe('q');
            expect(game.points).toBe(6); // 15 - 9 = 6
        });

        test('AI should stay within point budget', () => {
            game.points = 4; // Only enough for bishop/knight or pawn
            game.phase = PHASES.SETUP_BLACK_PIECES;
            game.selectedShopPiece = 'q'; // Costs 9, too expensive

            gameController.placeShopPiece(0, 0);

            expect(game.board[0][0]).toBeNull(); // Should not place
            expect(game.points).toBe(4); // No change
        });
    });

    describe('Selection Logic', () => {
        test('should not select piece if cost exceeds points', () => {
            game.points = 5;

            gameController.selectShopPiece('q'); // Costs 9

            expect(game.selectedShopPiece).not.toBe('q'); // Should not be set to q
            expect(game.log).toHaveBeenCalledWith('Nicht genug Punkte!');
        });

        test('should select piece if cost is affordable', () => {
            game.points = 15;

            // Mock querySelector to return a proper button element
            const mockButton = { classList: { add: jest.fn(), remove: jest.fn() } };
            document.querySelector = jest.fn(() => mockButton);
            document.querySelectorAll = jest.fn(() => [
                { classList: { remove: jest.fn() } },
                { classList: { remove: jest.fn() } }
            ]);
            document.getElementById = jest.fn(() => ({
                innerHTML: '',
                style: {}
            }));

            gameController.selectShopPiece('q');

            expect(game.selectedShopPiece).toBe('q');
        });
    });
});
