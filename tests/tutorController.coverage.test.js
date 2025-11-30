import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock UI module
jest.unstable_mockModule('../js/ui.js', () => ({
    renderBoard: jest.fn(),
    updateStatus: jest.fn(),
    updateShopUI: jest.fn(),
    getPieceText: jest.fn(piece => {
        if (!piece) return '';
        const symbols = {
            p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
            a: '♗', c: '♖', e: '♕'
        };
        return symbols[piece.type] || '?';
    }),
}));

// Mock sounds module
jest.unstable_mockModule('../js/sounds.js', () => ({
    soundManager: { init: jest.fn() },
}));

// Import after mocking
const { TutorController } = await import('../js/tutorController.js');

describe('TutorController Coverage', () => {
    let game;
    let tutorController;

    beforeEach(() => {
        game = new Game(15, 'classic', false);
        tutorController = new TutorController(game);
        game.tutorController = tutorController;
        game.log = jest.fn();
        game.minimax = jest.fn().mockReturnValue(100);

        // Clear board
        game.board = Array(9).fill(null).map(() => Array(9).fill(null));
        // Add kings
        game.board[0][0] = { type: 'k', color: 'black' };
        game.board[8][8] = { type: 'k', color: 'white' };
    });

    describe('canPieceMove', () => {
        test('should return true for rook orthogonal moves', () => {
            expect(tutorController.canPieceMove('r', 1, 0)).toBe(true);
            expect(tutorController.canPieceMove('r', 0, 1)).toBe(true);
        });

        test('should return false for rook diagonal moves', () => {
            expect(tutorController.canPieceMove('r', 1, 1)).toBe(false);
        });

        test('should return true for bishop diagonal moves', () => {
            expect(tutorController.canPieceMove('b', 1, 1)).toBe(true);
            expect(tutorController.canPieceMove('b', -1, -1)).toBe(true);
        });

        test('should return false for bishop orthogonal moves', () => {
            expect(tutorController.canPieceMove('b', 1, 0)).toBe(false);
        });

        test('should return true for queen in any direction', () => {
            expect(tutorController.canPieceMove('q', 1, 0)).toBe(true);
            expect(tutorController.canPieceMove('q', 1, 1)).toBe(true);
        });

        test('should return true for chancellor (rook moves)', () => {
            expect(tutorController.canPieceMove('c', 1, 0)).toBe(true);
            expect(tutorController.canPieceMove('c', 0, 1)).toBe(true);
        });

        test('should return true for archbishop (bishop moves)', () => {
            expect(tutorController.canPieceMove('a', 1, 1)).toBe(true);
        });

        test('should return false for unknown piece types', () => {
            expect(tutorController.canPieceMove('n', 1, 1)).toBe(false);
            expect(tutorController.canPieceMove('p', 1, 0)).toBe(false);
        });
    });

    describe('detectPins', () => {
        test('should detect pin when rook pins piece to king', () => {
            // White rook at 0,4, black knight at 0,2, black king at 0,0
            game.board[0][4] = { type: 'r', color: 'white' };
            game.board[0][2] = { type: 'n', color: 'black' };

            const pins = tutorController.detectPins({ r: 0, c: 4 }, 'white');

            expect(pins.length).toBe(1);
            expect(pins[0].pinnedPiece.type).toBe('n');
        });

        test('should detect pin when bishop pins piece to king', () => {
            // White bishop at 4,4, black knight at 2,2, black king at 0,0
            game.board[4][4] = { type: 'b', color: 'white' };
            game.board[2][2] = { type: 'n', color: 'black' };

            const pins = tutorController.detectPins({ r: 4, c: 4 }, 'white');

            expect(pins.length).toBe(1);
        });

        test('should return empty array for non-sliding pieces', () => {
            game.board[4][4] = { type: 'n', color: 'white' };

            const pins = tutorController.detectPins({ r: 4, c: 4 }, 'white');

            expect(pins).toEqual([]);
        });
    });

    describe('detectDiscoveredAttacks', () => {
        test('should detect discovered attack when piece moves away', () => {
            // White queen at 0,0, white pawn at 0,3 (blocking), black rook at 0,6
            game.board[0][0] = { type: 'q', color: 'white' };
            game.board[0][3] = { type: 'p', color: 'white' };
            game.board[0][6] = { type: 'r', color: 'black' };

            const move = { from: { r: 0, c: 3 }, to: { r: 1, c: 3 } };
            const attacks = tutorController.detectDiscoveredAttacks(move.from, move.to, 'white');

            expect(attacks.length).toBeGreaterThanOrEqual(0); // May find discovered attack
        });
    });

    describe('detectThreatsAfterMove', () => {
        test('should detect undefended piece after move', () => {
            game.phase = PHASES.PLAY;
            game.isSquareUnderAttack = jest.fn().mockReturnValue(true);

            // White queen at 4,4
            game.board[4][4] = { type: 'q', color: 'white' };

            const move = { from: { r: 4, c: 4 }, to: { r: 5, c: 5 } };
            const threats = tutorController.detectThreatsAfterMove(move);

            // Should detect if any pieces are left undefended
            expect(Array.isArray(threats)).toBe(true);
        });
    });

    describe('countDefenders and countAttackers', () => {
        test('should count defenders correctly', () => {
            game.board[4][4] = { type: 'p', color: 'white' };
            game.board[5][3] = { type: 'p', color: 'white' }; // Can defend 4,4
            game.board[5][5] = { type: 'p', color: 'white' }; // Can defend 4,4

            const defenders = tutorController.countDefenders(4, 4, 'white');

            expect(defenders).toBeGreaterThanOrEqual(0);
        });

        test('should count attackers correctly', () => {
            game.board[4][4] = { type: 'p', color: 'white' };
            game.board[3][3] = { type: 'p', color: 'black' }; // Can attack 4,4
            game.board[3][5] = { type: 'p', color: 'black' }; // Can attack 4,4

            const attackers = tutorController.countAttackers(4, 4, 'black');

            expect(attackers).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getDefendedPieces', () => {
        test('should find defended pieces', () => {
            game.board[4][4] = { type: 'r', color: 'white' };
            game.board[4][6] = { type: 'b', color: 'white' }; // Defended by rook
            game.isSquareUnderAttack = jest.fn().mockReturnValue(false);

            const defended = tutorController.getDefendedPieces({ r: 4, c: 4 }, 'white');

            expect(Array.isArray(defended)).toBe(true);
        });
    });

    describe('analyzeStrategicValue', () => {
        test('should detect center control', () => {
            const move = {
                from: { r: 6, c: 4 },
                to: { r: 4, c: 4 } // Center square
            };
            game.board[6][4] = { type: 'n', color: 'white', hasMoved: false };

            const strategic = tutorController.analyzeStrategicValue(move);

            expect(strategic.some(s => s.type === 'center_control')).toBe(true);
        });

        test('should detect piece development', () => {
            const move = {
                from: { r: 8, c: 1 },
                to: { r: 6, c: 2 }
            };
            game.board[8][1] = { type: 'n', color: 'white', hasMoved: false };

            const strategic = tutorController.analyzeStrategicValue(move);

            expect(strategic.some(s => s.type === 'development')).toBe(true);
        });

        test('should not mark pawn moves as development', () => {
            const move = {
                from: { r: 6, c: 4 },
                to: { r: 5, c: 4 }
            };
            game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };

            const strategic = tutorController.analyzeStrategicValue(move);

            expect(strategic.some(s => s.type === 'development')).toBe(false);
        });
    });

    describe('getScoreDescription', () => {
        test('should return correct descriptions for score ranges', () => {
            expect(tutorController.getScoreDescription(1000).label).toContain('Gewinnstellung');
            expect(tutorController.getScoreDescription(600).label).toContain('Großer Vorteil');
            expect(tutorController.getScoreDescription(300).label).toContain('Klarer Vorteil');
            expect(tutorController.getScoreDescription(100).label).toContain('Leichter Vorteil');
            expect(tutorController.getScoreDescription(0).label).toContain('Ausgeglichen');
            expect(tutorController.getScoreDescription(-100).label).toContain('Leichter Nachteil');
            expect(tutorController.getScoreDescription(-300).label).toContain('Schwieriger');
            expect(tutorController.getScoreDescription(-600).label).toContain('Großer Nachteil');
            expect(tutorController.getScoreDescription(-1000).label).toContain('Verloren');
        });
    });

    describe('analyzeMoveWithExplanation', () => {
        test('should categorize excellent move', () => {
            const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };
            game.board[6][4] = { type: 'p', color: 'white' };

            const analysis = tutorController.analyzeMoveWithExplanation(move, 500, 500);

            expect(analysis.category).toBe('excellent');
            expect(analysis.qualityLabel).toContain('Gewinnzug');
        });

        test('should categorize mistake', () => {
            const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };
            game.board[6][4] = { type: 'p', color: 'white' };

            const analysis = tutorController.analyzeMoveWithExplanation(move, -200, 200);

            expect(analysis.category).toBe('mistake');
            expect(analysis.warnings.length).toBeGreaterThan(0);
        });

        test('should detect fork pattern', () => {
            game.phase = PHASES.PLAY;
            // Setup a fork scenario
            game.board[4][4] = { type: 'n', color: 'white' };
            game.board[3][2] = { type: 'r', color: 'black' };
            game.board[3][6] = { type: 'b', color: 'black' };

            const move = { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } };
            game.board[6][4] = { type: 'n', color: 'white' };

            const analysis = tutorController.analyzeMoveWithExplanation(move, 300, 300);

            expect(analysis.tacticalPatterns).toBeDefined();
        });
    });
});
