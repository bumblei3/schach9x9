import { jest } from '@jest/globals';
import { Game, createEmptyBoard } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock UI and SoundManager modules
jest.unstable_mockModule('../js/ui.js', () => ({
    renderBoard: jest.fn(),
    showPromotionModal: jest.fn(),
    showPromotionUI: jest.fn(),
    animateMove: jest.fn().mockResolvedValue(),
    animateCheck: jest.fn(),
    animateCheckmate: jest.fn(),
    updateStatistics: jest.fn(),
    updateMoveHistoryUI: jest.fn(),
    updateCapturedUI: jest.fn(),
    updateStatus: jest.fn(),
    updateShopUI: jest.fn(),
    showShop: jest.fn(),
    updateClockDisplay: jest.fn(),
    updateClockUI: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: {
        playMove: jest.fn(),
        playCapture: jest.fn(),
        playCheck: jest.fn(),
        playCheckmate: jest.fn(),
        playGameOver: jest.fn(),
    },
}));

// Mock document functions used in MoveController
// Mock document functions used in MoveController
// We will mock getElementById in beforeEach using jest.spyOn if document exists
if (typeof document === 'undefined') {
    global.document = {
        getElementById: jest.fn(),
        createElement: jest.fn(),
    };
}

// Mock localStorage
Storage.prototype.getItem = jest.fn(() => null);
Storage.prototype.setItem = jest.fn();
Storage.prototype.removeItem = jest.fn();
Storage.prototype.clear = jest.fn();

// Mock alert
global.alert = jest.fn();

// Import MoveController AFTER mocking
const { MoveController } = await import('../js/moveController.js');
const UI = await import('../js/ui.js');
const { soundManager } = await import('../js/sounds.js');

describe('MoveController Coverage', () => {
    let game;
    let moveController;

    beforeEach(() => {
        game = new Game();
        game.board = createEmptyBoard();
        game.phase = PHASES.PLAY;

        moveController = new MoveController(game);
        game.moveController = moveController; // Link back
        game.log = jest.fn(); // Mock log function
        game.stopClock = jest.fn();
        game.startClock = jest.fn();
        game.updateBestMoves = jest.fn();
        game.isCheckmate = jest.fn(() => false);
        game.isStalemate = jest.fn(() => false);
        game.isInCheck = jest.fn(() => false);
        game.getValidMoves = jest.fn(() => []);

        // Place Kings to avoid "King captured" game over logic
        game.board[0][0] = { type: 'k', color: 'black' };
        game.board[8][8] = { type: 'k', color: 'white' };

        jest.clearAllMocks();

        // Mock document.getElementById
        if (!document.getElementById) document.getElementById = jest.fn();
        if (!jest.isMockFunction(document.getElementById)) {
            jest.spyOn(document, 'getElementById');
        }

        document.getElementById.mockImplementation((id) => ({
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
        }));
    });

    describe('Checkmate and Stalemate', () => {
        test('should handle checkmate', async () => {
            game.isCheckmate.mockReturnValue(true);
            game.turn = 'white'; // White just moved

            // Execute a move that leads to checkmate
            game.board[6][4] = { type: 'p', color: 'white' };
            await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(UI.animateCheckmate).toHaveBeenCalledWith(game, 'black');
            expect(soundManager.playGameOver).toHaveBeenCalled();
        });

        test('should handle stalemate', async () => {
            game.isStalemate.mockReturnValue(true);
            game.turn = 'white';

            game.board[6][4] = { type: 'p', color: 'white' };
            await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

            expect(game.phase).toBe(PHASES.GAME_OVER);
            expect(game.log).toHaveBeenCalledWith(expect.stringContaining('PATT'));
        });

        test('should handle check (without mate)', async () => {
            game.isInCheck.mockReturnValue(true);
            game.turn = 'white';

            game.board[6][4] = { type: 'p', color: 'white' };
            await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

            expect(UI.animateCheck).toHaveBeenCalledWith(game, 'black');
            expect(soundManager.playCheck).toHaveBeenCalled();
        });
    });

    describe('Special Moves Edge Cases', () => {
        test('should handle en passant capture sound and UI update', async () => {
            // Setup en passant scenario
            game.board[3][3] = { type: 'p', color: 'white' };
            game.board[3][4] = { type: 'p', color: 'black' }; // Pawn to be captured

            // Mock move record for en passant
            const from = { r: 3, c: 3 };
            const to = { r: 2, c: 4 };

            // We need to manually trigger the logic inside executeMove that detects en passant
            // This requires setting up the board state such that it looks like en passant
            // But since we are mocking executeMove logic by calling it, we just need to ensure
            // the conditions inside are met.

            // Actually, let's just test the specific logic by setting up the board
            // and ensuring the "specialMove" logic triggers.

            // White pawn at 3,3 moves to 2,4. Target is empty.
            // But we need to ensure the move is valid and treated as en passant.
            // The MoveController checks: if (piece.type === 'p' && to.c !== from.c && !targetPiece)

            await moveController.executeMove(from, to);

            // Since targetPiece is null (empty square), and column changed, it assumes en passant logic
            // inside executeMove.

            expect(soundManager.playCapture).toHaveBeenCalled();
            expect(UI.updateCapturedUI).toHaveBeenCalled();
        });
    });

    describe('Board Hash and Repetition', () => {
        test('should generate consistent board hash', () => {
            game.board[0][0] = { type: 'k', color: 'black' };
            game.board[8][8] = { type: 'k', color: 'white' };

            const hash1 = moveController.getBoardHash();
            const hash2 = moveController.getBoardHash();

            expect(hash1).toBe(hash2);

            // Change board
            game.board[4][4] = { type: 'p', color: 'white' };
            const hash3 = moveController.getBoardHash();

            expect(hash1).not.toBe(hash3);
        });
    });
});
