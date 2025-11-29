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
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: {
        playMove: jest.fn(),
        playCapture: jest.fn(),
        playCheck: jest.fn(),
        playCheckmate: jest.fn(),
    },
}));

// Mock document functions used in MoveController
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
};

// Mock localStorage with proper jest functions
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

describe('MoveController', () => {
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

        // Place Kings to avoid "King captured" game over logic
        // Use corners to avoid conflict with test moves (usually in center/files 4)
        game.board[0][0] = { type: 'k', color: 'black' };
        game.board[8][8] = { type: 'k', color: 'white' };

        jest.clearAllMocks();
    });

    test('should execute a simple move', async () => {
        // Setup: White Pawn at 6,4
        game.board[6][4] = { type: 'p', color: 'white' };

        const from = { r: 6, c: 4 };
        const to = { r: 5, c: 4 };

        await moveController.executeMove(from, to);

        // Check board update
        expect(game.board[6][4]).toBeNull();
        expect(game.board[5][4]).toEqual({ type: 'p', color: 'white', hasMoved: true });

        // Check turn switch
        expect(game.turn).toBe('black');

        // Check UI update
        expect(UI.renderBoard).toHaveBeenCalled();
        expect(soundManager.playMove).toHaveBeenCalled();
    });

    test('should handle capture', async () => {
        // Setup: White Rook at 4,4, Black Pawn at 4,6
        game.board[4][4] = { type: 'r', color: 'white' };
        game.board[4][6] = { type: 'p', color: 'black' };

        const from = { r: 4, c: 4 };
        const to = { r: 4, c: 6 };

        await moveController.executeMove(from, to);

        // Check board
        expect(game.board[4][4]).toBeNull();
        expect(game.board[4][6].type).toBe('r');

        // Check captures
        expect(game.capturedPieces.white.length).toBe(1); // White captured a piece
        expect(game.capturedPieces.white[0].type).toBe('p');

        // Check sound
        expect(soundManager.playCapture).toHaveBeenCalled();
    });

    test('should handle promotion', async () => {
        // Setup: White Pawn at 1,4 (about to promote)
        game.board[1][4] = { type: 'p', color: 'white' };

        const from = { r: 1, c: 4 };
        const to = { r: 0, c: 4 };

        // Mock showPromotionUI to immediately call callback
        UI.showPromotionUI.mockImplementation((game, r, c, color, record, callback) => {
            // Simulate user choosing Queen
            // Note: The callback in MoveController.js calls finishMove(), but doesn't take arguments.
            // The choice is usually handled inside showPromotionUI which updates the board/record.
            // We need to simulate what showPromotionUI does.

            // Manually set the piece to Angel (e)
            game.board[0][4] = { type: 'e', color: 'white', hasMoved: true };

            // Call the callback to finish move
            callback();
        });

        await moveController.executeMove(from, to);

        // Check board - was manually promoted to Angel by the mock
        expect(game.board[0][4].type).toBe('e');
        // Note: With auto-promotion to Angel, showPromotionUI is NOT called anymore
        // expect(UI.showPromotionUI).toHaveBeenCalled();
    });

    test('should correctly undo promotion', async () => {
        // Setup: White Pawn at 1,4 (about to promote)
        game.board[1][4] = { type: 'p', color: 'white' };

        const from = { r: 1, c: 4 };
        const to = { r: 0, c: 4 };

        // Mock auto-promotion (which is what happens in code now)
        // The code automatically promotes to 'e' and calls finishMove
        await moveController.executeMove(from, to);

        // Verify promotion
        expect(game.board[0][4].type).toBe('e');

        // Undo
        moveController.undoMove();

        // Should be back to pawn at 1,4
        expect(game.board[1][4]).not.toBeNull();
        expect(game.board[1][4].type).toBe('p');
        expect(game.board[0][4]).toBeNull();
    });

    test('should handle undo move', async () => {
        // Setup: Execute a move first
        game.board[6][4] = { type: 'p', color: 'white' };
        const from = { r: 6, c: 4 };
        const to = { r: 5, c: 4 };

        await moveController.executeMove(from, to);
        expect(game.board[5][4]).not.toBeNull();

        // Now undo
        moveController.undoMove();

        // Piece should be back at original position
        expect(game.board[6][4]).not.toBeNull();
        expect(game.board[5][4]).toBeNull();
        expect(game.turn).toBe('white'); // Turn should be back to white
    });

    test('should handle castling kingside', async () => {
        // Setup: White King and Rook for kingside castling
        game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
        game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };

        const from = { r: 8, c: 4 };
        const to = { r: 8, c: 6 }; // Kingside castle

        await moveController.executeMove(from, to);

        // King should move to g1 (col 6), Rook to f1 (col 5)
        expect(game.board[8][6]).not.toBeNull();
        expect(game.board[8][6].type).toBe('k');
        expect(game.board[8][5]).not.toBeNull();
        expect(game.board[8][5].type).toBe('r');
    });

    test('should correctly undo kingside castling', async () => {
        // Setup: White King and Rook for kingside castling
        game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
        game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };

        const from = { r: 8, c: 4 };
        const to = { r: 8, c: 6 }; // Kingside castle

        await moveController.executeMove(from, to);
        moveController.undoMove();

        // King should be back at e1 (8, 4)
        expect(game.board[8][4]).not.toBeNull();
        expect(game.board[8][4].type).toBe('k');
        expect(game.board[8][4].hasMoved).toBe(false);

        // Rook should be back at i1 (8, 8)
        expect(game.board[8][8]).not.toBeNull();
        expect(game.board[8][8].type).toBe('r');
        expect(game.board[8][8].hasMoved).toBe(false);

        // Castling squares should be empty
        expect(game.board[8][6]).toBeNull();
        expect(game.board[8][5]).toBeNull();
    });

    test('should handle en passant', async () => {
        // Setup: Black pawn does double move
        game.board[1][4] = { type: 'p', color: 'black' };
        await moveController.executeMove({ r: 1, c: 4 }, { r: 3, c: 4 });

        // White pawn positioned to capture en passant
        game.board[3][3] = { type: 'p', color: 'white' };
        game.turn = 'white';

        // En passant capture
        await moveController.executeMove({ r: 3, c: 3 }, { r: 2, c: 4 });

        // White pawn should be at 2,4 and black pawn at 3,4 should be gone
        expect(game.board[2][4]).not.toBeNull();
        expect(game.board[2][4].type).toBe('p');
        expect(game.board[3][4]).toBeNull();
    });

    test('should correctly undo en passant', async () => {
        // Setup: Black pawn does double move
        game.board[1][4] = { type: 'p', color: 'black' };
        await moveController.executeMove({ r: 1, c: 4 }, { r: 3, c: 4 });

        // White pawn positioned to capture en passant
        game.board[3][3] = { type: 'p', color: 'white' };
        game.turn = 'white';

        // En passant capture
        await moveController.executeMove({ r: 3, c: 3 }, { r: 2, c: 4 });

        // Undo
        moveController.undoMove();

        // White pawn back at 3,3
        expect(game.board[3][3]).not.toBeNull();
        expect(game.board[3][3].type).toBe('p');

        // Black pawn back at 3,4 (captured pawn restored)
        expect(game.board[3][4]).not.toBeNull();
        expect(game.board[3][4].type).toBe('p');
        expect(game.board[3][4].color).toBe('black');

        // Destination square empty
        expect(game.board[2][4]).toBeNull();
    });

    test('should record move in history', async () => {
        game.board[6][4] = { type: 'p', color: 'white' };
        const initialHistoryLength = game.moveHistory.length;

        await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

        expect(game.moveHistory.length).toBe(initialHistoryLength + 1);
        expect(game.moveHistory[game.moveHistory.length - 1]).toMatchObject({
            from: { r: 6, c: 4 },
            to: { r: 5, c: 4 },
        });
    });

    test('should handle redo move', async () => {
        // Setup and execute a move
        game.board[6][4] = { type: 'p', color: 'white' };
        await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

        // Undo the move
        moveController.undoMove();
        expect(game.board[6][4]).not.toBeNull();
        expect(game.board[5][4]).toBeNull();

        // Redo the move - this will call executeMove again
        // The piece should move from 6,4 to 5,4 again
        await moveController.redoMove();

        // After redo, piece should be at the destination
        const piece = game.board[5][4];
        expect(piece).not.toBeNull();
        if (piece) {
            expect(piece.type).toBe('p');
        }
        expect(game.board[6][4]).toBeNull();
    });

    test('should clear redo stack when new move is made', async () => {
        // Setup and execute a move
        game.board[6][4] = { type: 'p', color: 'white' };
        await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

        // Undo
        moveController.undoMove();

        // Make a different move (should clear redo stack)
        game.board[6][3] = { type: 'p', color: 'white' };
        await moveController.executeMove({ r: 6, c: 3 }, { r: 5, c: 3 });

        // Redo should not work now
        const initialLength = game.moveHistory.length;
        moveController.redoMove();
        expect(game.moveHistory.length).toBe(initialLength);
    });

    test('should handle castling queenside', async () => {
        // Setup: White King and Rook for queenside castling
        game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
        game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };

        const from = { r: 8, c: 4 };
        const to = { r: 8, c: 2 }; // Queenside castle

        await moveController.executeMove(from, to);

        // King should move to c1 (col 2), Rook to d1 (col 3)
        expect(game.board[8][2]).not.toBeNull();
        expect(game.board[8][2].type).toBe('k');
        expect(game.board[8][3]).not.toBeNull();
        expect(game.board[8][3].type).toBe('r');
    });

    test('should correctly undo queenside castling', async () => {
        // Setup: White King and Rook for queenside castling
        game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
        game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };

        const from = { r: 8, c: 4 };
        const to = { r: 8, c: 2 }; // Queenside castle

        await moveController.executeMove(from, to);
        moveController.undoMove();

        // King should be back at e1 (8, 4)
        expect(game.board[8][4]).not.toBeNull();
        expect(game.board[8][4].type).toBe('k');
        expect(game.board[8][4].hasMoved).toBe(false);

        // Rook should be back at a1 (8, 0)
        expect(game.board[8][0]).not.toBeNull();
        expect(game.board[8][0].type).toBe('r');
        expect(game.board[8][0].hasMoved).toBe(false);

        // Castling squares should be empty
        expect(game.board[8][2]).toBeNull();
        expect(game.board[8][3]).toBeNull();
    });

    test('should set hasMoved flag on pieces', async () => {
        // Setup: fresh piece without hasMoved
        game.board[6][4] = { type: 'p', color: 'white' };

        await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

        // hasMoved should be set
        expect(game.board[5][4].hasMoved).toBe(true);
    });

    test('should handle multiple undo operations', async () => {
        // Execute 3 moves
        game.board[6][4] = { type: 'p', color: 'white' };
        await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

        game.board[1][4] = { type: 'p', color: 'black' };
        await moveController.executeMove({ r: 1, c: 4 }, { r: 2, c: 4 });

        game.board[5][4] = { type: 'p', color: 'white', hasMoved: true };
        await moveController.executeMove({ r: 5, c: 4 }, { r: 4, c: 4 });

        // Verify we have 3 moves in history
        expect(game.moveHistory.length).toBe(3);

        // Undo all 3
        moveController.undoMove();
        moveController.undoMove();
        moveController.undoMove();

        // Should be back to initial state - all pieces back at start
        // After 3 undos, the white pawn should be back at 6,4
        expect(game.board[6][4]).not.toBeNull(); // White pawn restored
        expect(game.board[6][4].type).toBe('p');
        expect(game.turn).toBe('white');  // Back to white's turn
        expect(game.moveHistory.length).toBe(0); // All moves undone
    });

    describe('handlePlayClick', () => {
        test('should select own piece', () => {
            game.board[4][4] = { type: 'p', color: 'white' };

            moveController.handlePlayClick(4, 4);

            expect(game.selectedSquare).toEqual({ r: 4, c: 4 });
            expect(game.validMoves).toBeDefined();
            expect(UI.renderBoard).toHaveBeenCalled();
        });

        test('should deselect when clicking empty square', () => {
            game.selectedSquare = { r: 4, c: 4 };
            game.validMoves = [{ r: 3, c: 4 }];

            moveController.handlePlayClick(2, 2);

            expect(game.selectedSquare).toBeNull();
            expect(game.validMoves).toBeNull();
        });

        test('should switch selection when clicking different own piece', () => {
            game.board[4][4] = { type: 'p', color: 'white' };
            game.board[5][5] = { type: 'r', color: 'white' };
            game.selectedSquare = { r: 4, c: 4 };

            moveController.handlePlayClick(5, 5);

            expect(game.selectedSquare).toEqual({ r: 5, c: 5 });
        });

        test('should show threats when clicking enemy piece', () => {
            game.board[4][4] = { type: 'q', color: 'black' };

            moveController.handlePlayClick(4, 4);

            expect(game.selectedSquare).toEqual({ r: 4, c: 4 });
            expect(game.validMoves).toBeDefined();
        });
    });

    describe('Draw Conditions', () => {
        test('should detect insufficient material (K vs K)', () => {
            game.board = createEmptyBoard();
            game.board[0][0] = { type: 'k', color: 'black' };
            game.board[8][8] = { type: 'k', color: 'white' };

            expect(moveController.isInsufficientMaterial()).toBe(true);
        });

        test('should detect insufficient material (K+N vs K)', () => {
            game.board = createEmptyBoard();
            game.board[0][0] = { type: 'k', color: 'black' };
            game.board[8][8] = { type: 'k', color: 'white' };
            game.board[7][7] = { type: 'n', color: 'white' };

            expect(moveController.isInsufficientMaterial()).toBe(true);
        });

        test('should detect insufficient material (K+B vs K)', () => {
            game.board = createEmptyBoard();
            game.board[0][0] = { type: 'k', color: 'black' };
            game.board[8][8] = { type: 'k', color: 'white' };
            game.board[7][7] = { type: 'b', color: 'white' };

            expect(moveController.isInsufficientMaterial()).toBe(true);
        });

        test('should NOT detect insufficient material with pawn', () => {
            game.board = createEmptyBoard();
            game.board[0][0] = { type: 'k', color: 'black' };
            game.board[8][8] = { type: 'k', color: 'white' };
            game.board[6][4] = { type: 'p', color: 'white' };

            expect(moveController.isInsufficientMaterial()).toBe(false);
        });
    });

    describe('Save and Load Game', () => {
        test('should call localStorage.setItem when saving', () => {
            moveController.saveGame();

            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'schach9x9_save',
                expect.any(String)
            );
        });

        test('should handle missing save data', () => {
            // Ensure getItem returns null (already default, but explicit)
            global.localStorage.getItem.mockReturnValueOnce(null);

            moveController.loadGame();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('gespeichert'));
        });
    });

    describe('Material Calculation', () => {
        test('should calculate material advantage correctly', () => {
            game.board = createEmptyBoard();
            game.board[0][0] = { type: 'k', color: 'black' };
            game.board[8][8] = { type: 'k', color: 'white' };
            game.board[7][7] = { type: 'q', color: 'white' }; // +9
            game.board[0][4] = { type: 'r', color: 'black' }; // -5

            const advantage = moveController.calculateMaterialAdvantage();

            expect(advantage).toBe(4);
        });

        test('should return correct value for Angel piece', () => {
            const angel = { type: 'e', color: 'white' };

            expect(moveController.getMaterialValue(angel)).toBe(12);
        });
    });

    describe('Replay Mode', () => {
        beforeEach(() => {
            // Mock replay-specific elements
            document.getElementById = jest.fn((id) => {
                if (id === 'replay-status' || id === 'replay-exit' || id === 'undo-btn') {
                    return {
                        classList: { remove: jest.fn(), add: jest.fn() },
                        disabled: false,
                        textContent: '',
                    };
                }
                return {
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
                };
            });
        });

        test('should enter replay mode', async () => {
            // Setup: Make a move so we have history
            game.board[6][4] = { type: 'p', color: 'white' };
            await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

            moveController.enterReplayMode();

            expect(game.replayMode).toBe(true);
            expect(game.replayPosition).toBe(0);
            expect(game.stopClock).toHaveBeenCalled();
            expect(game.savedGameState).toBeDefined();
        });

        test('should exit replay mode', async () => {
            game.board[6][4] = { type: 'p', color: 'white' };
            await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });
            moveController.enterReplayMode();

            moveController.exitReplayMode();

            expect(game.replayMode).toBe(false);
            expect(game.replayPosition).toBe(-1);
            expect(game.savedGameState).toBeNull();
        });

        test('should navigate through replay', async () => {
            // Setup: 3 moves
            game.board[6][4] = { type: 'p', color: 'white' };
            await moveController.executeMove({ r: 6, c: 4 }, { r: 5, c: 4 });

            game.board[1][4] = { type: 'p', color: 'black' };
            await moveController.executeMove({ r: 1, c: 4 }, { r: 2, c: 4 });

            game.board[5][4] = { type: 'p', color: 'white', hasMoved: true };
            await moveController.executeMove({ r: 5, c: 4 }, { r: 4, c: 4 });

            moveController.enterReplayMode();
            expect(game.replayPosition).toBe(2);

            moveController.replayFirst();
            expect(game.replayPosition).toBe(-1);

            moveController.replayNext();
            expect(game.replayPosition).toBe(0);

            moveController.replayLast();
            expect(game.replayPosition).toBe(2);

            moveController.replayPrevious();
            expect(game.replayPosition).toBe(1);
        });
    });

    describe('Draw Detection', () => {
        beforeEach(() => {
            // Mock game-over overlay elements
            document.getElementById = jest.fn((id) => {
                if (id === 'game-over-overlay' || id === 'winner-text') {
                    return {
                        classList: { remove: jest.fn(), add: jest.fn() },
                        textContent: '',
                    };
                }
                return {
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
                };
            });
        });

        test('should detect 50-move rule', () => {
            game.halfMoveClock = 100;
            const result = moveController.checkDraw();
            expect(result).toBe(true);
            expect(game.phase).toBe(PHASES.GAME_OVER);
        });

        test('should detect 3-fold repetition', () => {
            game.positionHistory = ['hash1', 'hash2', 'hash1', 'hash3', 'hash1'];
            moveController.getBoardHash = jest.fn(() => 'hash1');

            const result = moveController.checkDraw();
            expect(result).toBe(true);
            expect(game.phase).toBe(PHASES.GAME_OVER);
        });
    });
});
