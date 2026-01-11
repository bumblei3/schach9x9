
import { jest } from '@jest/globals';

jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: {
        init: jest.fn(),
        playMove: jest.fn(),
        playCapture: jest.fn(),
        playGameStart: jest.fn(),
        playGameOver: jest.fn(),
        playError: jest.fn(),
        playSuccess: jest.fn(),
        playCheck: jest.fn(),
    },
}));

jest.unstable_mockModule('../js/ui.js', () => ({
    animateMove: jest.fn().mockResolvedValue(),
    renderBoard: jest.fn(),
    updateStatus: jest.fn(),
    updateCapturedUI: jest.fn(),
    updateMoveHistoryUI: jest.fn(),
    updateStatistics: jest.fn(),
    updateClockDisplay: jest.fn(),
    updateClockUI: jest.fn(),
    renderEvalGraph: jest.fn(),
    showPromotionUI: jest.fn(),
    animateCheck: jest.fn(),
    animateCheckmate: jest.fn(),
    showToast: jest.fn(),
}));

// Dynamic imports required for mocked modules
const { Game } = await import('../js/gameEngine.js');
const { MoveController } = await import('../js/moveController.js');

describe('Undo/Redo System Reproduction Tests', () => {
    let game;
    let moveController;

    beforeEach(() => {
        game = new Game(0, 'classic');
        // Set up a clean board state for testing
        // 9x9 board
        game.board = Array(9).fill(null).map(() => Array(9).fill(null));

        // Add Kings to prevent Game Over logic in MoveExecutor
        game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
        game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

        game.phase = 'PLAY';
        game.turn = 'white';
        game.capturedPieces = { white: [], black: [] };
        game.stats = { promotions: 0 };
        game.moveHistory = [];

        // Mock UI methods to avoid errors
        game.log = jest.fn();

        // Initialize MoveController
        moveController = new MoveController(game);
    });

    test('Simple Move Undo/Redo', async () => {
        // Setup: White Pawn at (6, 0)
        game.board[6][0] = { type: 'p', color: 'white', hasMoved: false };

        await moveController.executeMove({ r: 6, c: 0 }, { r: 5, c: 0 });

        expect(game.board[6][0]).toBeNull();
        expect(game.board[5][0].type).toBe('p');
        expect(game.moveHistory.length).toBe(1);

        moveController.undoMove();

        expect(game.board[6][0]).not.toBeNull();
        expect(game.board[5][0]).toBeNull();
        expect(game.moveHistory.length).toBe(0);

        await moveController.redoMove();

        expect(game.board[6][0]).toBeNull();
        expect(game.board[5][0].type).toBe('p');
    });

    test('Promotion Undo/Redo Issue', async () => {
        game.board[1][0] = { type: 'p', color: 'white', hasMoved: true };

        await moveController.executeMove({ r: 1, c: 0 }, { r: 0, c: 0 });

        expect(game.board[0][0].type).toBe('e'); // Angel

        moveController.undoMove();

        expect(game.board[1][0].type).toBe('p');
        expect(game.board[0][0]).toBeNull();

        await moveController.redoMove();

        expect(game.board[0][0].type).toBe('e');
    });

    test('Capture Undo/Redo', async () => {
        game.board[6][0] = { type: 'p', color: 'white' };
        game.board[5][1] = { type: 'p', color: 'black' };

        await moveController.executeMove({ r: 6, c: 0 }, { r: 5, c: 1 });

        expect(game.capturedPieces.white.length).toBe(1);

        moveController.undoMove();

        expect(game.board[5][1].color).toBe('black');
        expect(game.capturedPieces.white.length).toBe(0);

        await moveController.redoMove();

        expect(game.capturedPieces.white.length).toBe(1);
    });

    test('AI Double Undo', async () => {
        // Setup AI game
        game.isAI = true;
        game.phase = 'PLAY';
        game.turn = 'white';

        // Setup piece
        game.board[6][0] = { type: 'p', color: 'white', hasMoved: false };
        game.board[1][0] = { type: 'p', color: 'black', hasMoved: false };

        // 1. White moves
        await moveController.executeMove({ r: 6, c: 0 }, { r: 5, c: 0 });
        // History: 1 (White's move)

        expect(game.turn).toBe('black');

        // 2. Black (AI) "moves"
        await moveController.executeMove({ r: 1, c: 0 }, { r: 2, c: 0 });
        // History: 2 (White's move + Black's move)
        expect(game.turn).toBe('white');
        expect(game.moveHistory.length).toBe(2);

        // 3. Undo
        // Should undo Black's move AND White's move to get back to White
        moveController.undoMove();

        // Wait for the recursive undo which might be async or immediate
        // Since my impl calls `undoMove` recursively directly, it's synchronous.
        // If I used setTimeout, I'd need `jest.runAllTimers()`.
        // I put it directly.

        expect(game.moveHistory.length).toBe(0);
        expect(game.turn).toBe('white');
        // Board should be reset
        expect(game.board[6][0]).not.toBeNull();
        expect(game.board[5][0]).toBeNull();
        expect(game.board[1][0]).not.toBeNull();
        expect(game.board[2][0]).toBeNull();
    });
});
