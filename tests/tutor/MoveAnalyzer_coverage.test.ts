import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as MoveAnalyzer from '../../js/tutor/MoveAnalyzer.js';
import * as aiEngine from '../../js/aiEngine.js';
import { PHASES } from '../../js/gameEngine.js';

// Mock dependencies
vi.mock('../../js/tutor/TacticsDetector.js', () => ({
    detectThreatsAfterMove: vi.fn().mockReturnValue([]),
    isTactical: vi.fn().mockReturnValue(false),
    detectTacticalPatterns: vi.fn().mockReturnValue([]),
}));

vi.mock('../../js/aiEngine.js', () => ({
    evaluatePosition: vi.fn(),
}));

describe('MoveAnalyzer Coverage', () => {
    let mockGame: any;

    beforeEach(() => {
        mockGame = {
            kiMentorEnabled: true,
            phase: PHASES.PLAY,
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            mentorLevel: 'STANDARD',
            stats: { accuracies: [] },
            moveController: { undoMove: vi.fn() },
            turn: 'white',
        };

        vi.clearAllMocks();
    });

    describe('analyzePlayerMovePreExecution', () => {
        it('should return null if mentor is disabled', async () => {
            mockGame.kiMentorEnabled = false;
            const result = await MoveAnalyzer.analyzePlayerMovePreExecution(mockGame, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
            expect(result).toBeNull();
        });

        it('should return analysis if move creates significant drop', async () => {
            // Setup piece
            mockGame.board[0][0] = { type: 'p', color: 'white' };
            const move = { from: { r: 0, c: 0 }, to: { r: 1, c: 0 } };

            // Mock evaluations: Current = 100, New = -500 (Drop of 600)
            vi.mocked(aiEngine.evaluatePosition)
                .mockResolvedValueOnce(100)  // Current
                .mockResolvedValueOnce(-500); // New

            const result = await MoveAnalyzer.analyzePlayerMovePreExecution(mockGame, move);

            expect(result).not.toBeNull();
            expect(result.scoreDiff).toBeLessThan(-100);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should not return analysis for good moves', async () => {
            mockGame.board[0][0] = { type: 'p', color: 'white' };
            const move = { from: { r: 0, c: 0 }, to: { r: 1, c: 0 } };

            // Stable evaluation
            vi.mocked(aiEngine.evaluatePosition)
                .mockResolvedValueOnce(100)
                .mockResolvedValueOnce(100);

            const result = await MoveAnalyzer.analyzePlayerMovePreExecution(mockGame, move);
            expect(result).toBeNull();
        });
    });

    describe('analyzeStrategicValue', () => {
        it('should detect center control', () => {
            mockGame.board[1][4] = { type: 'p', color: 'white' };
            const move = { from: { r: 1, c: 4 }, to: { r: 4, c: 4 } }; // Move to center (4,4)

            const analytics = MoveAnalyzer.analyzeStrategicValue(mockGame, move);
            expect(analytics).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'center_control' })
            ]));
        });

        it('should detect piece development', () => {
            // Knight from home row (8) to f6-ish
            mockGame.board[8][1] = { type: 'n', color: 'white' };
            const move = { from: { r: 8, c: 1 }, to: { r: 6, c: 2 } };

            const analytics = MoveAnalyzer.analyzeStrategicValue(mockGame, move);
            expect(analytics).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'development' })
            ]));
        });
    });

    describe('checkBlunder', () => {
        it('should add accuracy stats', async () => {
            const tutorController = { showBlunderWarning: vi.fn() };
            const moveRecord = {
                from: { r: 0, c: 0 },
                to: { r: 1, c: 1 },
                evalScore: 100,
                piece: { color: 'white' }
            };
            mockGame.lastEval = 100;

            await MoveAnalyzer.checkBlunder(mockGame, tutorController, moveRecord);

            expect(mockGame.stats.accuracies.length).toBe(1);
        });

        it('should trigger blunder warning on large drop', async () => {
            const tutorController = { showBlunderWarning: vi.fn() };
            const moveRecord = {
                from: { r: 0, c: 0 },
                to: { r: 1, c: 1 },
                evalScore: -400, // Current eval (bad)
                piece: { color: 'white' }
            };
            mockGame.lastEval = 100; // Previous eval (good) -> Drop of 500

            await MoveAnalyzer.checkBlunder(mockGame, tutorController, moveRecord);

            expect(tutorController.showBlunderWarning).toHaveBeenCalled();
        });
    });
});
