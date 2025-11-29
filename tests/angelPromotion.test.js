
import { jest } from '@jest/globals';

// Mock AudioContext
global.window.AudioContext = jest.fn().mockImplementation(() => ({
    createGain: jest.fn().mockReturnValue({
        connect: jest.fn(),
        gain: {
            value: 0,
            linearRampToValueAtTime: jest.fn(),
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn()
        }
    }),
    createOscillator: jest.fn().mockReturnValue({ connect: jest.fn(), start: jest.fn(), stop: jest.fn(), frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }, type: 'sine' }),
    currentTime: 0,
    destination: {},
}));
global.window.webkitAudioContext = global.window.AudioContext;

import { Game, BOARD_SIZE } from '../js/gameEngine.js';
import { MoveController } from '../js/moveController.js';
import * as UI from '../js/ui.js';

jest.mock('../js/ui.js', () => ({
    renderBoard: jest.fn(),
    updateCapturedUI: jest.fn(),
    updateMoveHistoryUI: jest.fn(),
    updateStatus: jest.fn(),
    showPromotionUI: jest.fn(),
    animateMove: jest.fn().mockResolvedValue(),
    updateStatistics: jest.fn(),
    updateClockDisplay: jest.fn(),
    updateClockUI: jest.fn(),
    animateCheck: jest.fn(),
    animateCheckmate: jest.fn(),
}));

jest.mock('../js/sounds.js', () => ({
    soundManager: {
        playMove: jest.fn(),
        playCapture: jest.fn(),
        playCheck: jest.fn(),
        playGameOver: jest.fn(),
    }
}));

describe('Angel Piece and Promotion', () => {
    let game;
    let moveController;

    beforeEach(() => {
        // Setup JSDOM elements
        document.body.innerHTML = `
            <div id="game-over-overlay" class="hidden"></div>
            <div id="winner-text"></div>
            <div id="promotion-overlay" class="hidden"></div>
            <div id="promotion-options"></div>
        `;

        game = new Game();
        moveController = new MoveController(game);
        game.gameController = { saveGameToStatistics: jest.fn() }; // Mock
        game.log = jest.fn(); // Mock log
        game.arrowRenderer = { clearArrows: jest.fn() }; // Mock arrow renderer

        // Setup board for testing
        game.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    });

    test('Angel should move like a Queen', () => {
        // Place Angel at center
        game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

        // Check diagonal move
        const moves = game.getValidMoves(4, 4, game.board[4][4]);
        const diagonalMove = moves.find(m => m.r === 0 && m.c === 0);
        expect(diagonalMove).toBeDefined();

        // Check orthogonal move
        const orthogonalMove = moves.find(m => m.r === 4 && m.c === 0);
        expect(orthogonalMove).toBeDefined();
    });

    test('Angel should move like a Knight', () => {
        // Place Angel at center
        game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

        // Check knight jump
        const moves = game.getValidMoves(4, 4, game.board[4][4]);
        const knightMove = moves.find(m => m.r === 6 && m.c === 5);
        expect(knightMove).toBeDefined();
    });

    test('Angel should capture enemy pieces', () => {
        // Place Angel
        game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };

        // Place enemy pawn for diagonal capture (Queen-like)
        game.board[2][2] = { type: 'p', color: 'black', hasMoved: false };

        // Place enemy pawn for knight capture
        game.board[6][5] = { type: 'p', color: 'black', hasMoved: false };

        const moves = game.getValidMoves(4, 4, game.board[4][4]);

        // Check diagonal capture
        expect(moves.find(m => m.r === 2 && m.c === 2)).toBeDefined();

        // Check knight capture
        expect(moves.find(m => m.r === 6 && m.c === 5)).toBeDefined();
    });

    test('Angel should be blocked by friendly pieces (Queen movement)', () => {
        game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
        // Place friendly piece in path
        game.board[4][2] = { type: 'p', color: 'white', hasMoved: false };

        const moves = game.getValidMoves(4, 4, game.board[4][4]);

        // Should not be able to move to [4][2] or beyond [4][1], [4][0]
        expect(moves.find(m => m.r === 4 && m.c === 2)).toBeUndefined();
        expect(moves.find(m => m.r === 4 && m.c === 1)).toBeUndefined();
    });

    test('Angel should jump over pieces (Knight movement)', () => {
        game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
        // Place blocking pieces around
        game.board[4][3] = { type: 'p', color: 'white', hasMoved: false };
        game.board[3][4] = { type: 'p', color: 'white', hasMoved: false };

        const moves = game.getValidMoves(4, 4, game.board[4][4]);

        // Should still be able to jump to knight square
        expect(moves.find(m => m.r === 2 && m.c === 3)).toBeDefined();
    });

    test('Angel should deliver check', () => {
        // White Angel
        game.board[4][4] = { type: 'e', color: 'white', hasMoved: false };
        // Black King
        game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

        expect(game.isInCheck('black')).toBe(true);
    });

    test('Pawn should automatically promote to Angel', async () => {
        // Place white pawn near end
        game.board[1][0] = { type: 'p', color: 'white', hasMoved: true };
        // Clear path
        game.board[0][0] = null;

        // Execute move
        const from = { r: 1, c: 0 };
        const to = { r: 0, c: 0 };

        await moveController.executeMove(from, to);

        // Check if piece at to is Angel
        const promotedPiece = game.board[0][0];
        expect(promotedPiece).not.toBeNull();
        expect(promotedPiece.type).toBe('e');
        expect(promotedPiece.color).toBe('white');
    });
});
