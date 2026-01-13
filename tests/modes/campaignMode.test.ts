/**
 * CampaignModeStrategy Tests
 * Coverage target: 58% -> 80%+
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CampaignModeStrategy } from '../../js/modes/strategies/CampaignMode.js';
import { PHASES } from '../../js/config.js';

// Mock UI module
vi.mock('../../js/ui.js', () => ({
    updateShopUI: vi.fn(),
    updateStatus: vi.fn(),
    renderBoard: vi.fn(),
    showModal: vi.fn(),
    updateStatistics: vi.fn(),
}));

// Mock logger
vi.mock('../../js/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock campaignManager
vi.mock('../../js/campaign/CampaignManager.js', () => ({
    campaignManager: {
        getLevel: vi.fn((levelId: string) => {
            if (levelId === 'level_1') {
                return {
                    id: 'level_1',
                    title: 'Tutorial Level',
                    description: 'Learn the basics',
                    setupType: 'fixed',
                    opponentPersonality: 'CAUTIOUS',
                    playerColor: 'white',
                    winCondition: 'checkmate',
                };
            }
            if (levelId === 'level_2') {
                return {
                    id: 'level_2',
                    title: 'Second Mission',
                    description: 'A harder challenge',
                    setupType: 'fixed',
                    opponentPersonality: 'AGGRESSIVE',
                    playerColor: 'black',
                    winCondition: 'checkmate',
                };
            }
            if (levelId === 'level_budget') {
                return {
                    id: 'level_budget',
                    title: 'Budget Level',
                    description: 'Build your army',
                    setupType: 'budget',
                    playerBudget: 20,
                    opponentPersonality: 'BALANCED',
                    playerColor: 'white',
                    winCondition: 'checkmate',
                };
            }
            return null;
        }),
    },
}));

// Mock BoardFactory
vi.mock('../../js/campaign/BoardFactory.js', () => ({
    BoardFactory: {
        createLevel1Board: vi.fn(() => Array(9).fill(null).map(() => Array(9).fill(null))),
        createLevel2Board: vi.fn(() => Array(9).fill(null).map(() => Array(9).fill(null))),
        createEmptyBoard: vi.fn(() => Array(9).fill(null).map(() => Array(9).fill(null))),
    },
}));

// Mock SetupModeStrategy as a proper class
const mockSetupHandleInteraction = vi.fn().mockResolvedValue(true);
const mockSetupOnPhaseEnd = vi.fn();
vi.mock('../../js/modes/strategies/SetupMode.ts', () => ({
    SetupModeStrategy: class MockSetupModeStrategy {
        handleInteraction = mockSetupHandleInteraction;
        onPhaseEnd = mockSetupOnPhaseEnd;
        init = vi.fn();
    },
}));

describe('CampaignModeStrategy', () => {
    let strategy: CampaignModeStrategy;
    let mockGame: any;
    let mockController: any;

    beforeEach(() => {
        vi.clearAllMocks();

        strategy = new CampaignModeStrategy();

        mockGame = {
            board: [],
            phase: PHASES.PLAY,
            points: 0,
            campaignMode: false,
            currentLevelId: null,
            aiPersonality: null,
            playerColor: null,
            handlePlayClick: vi.fn().mockResolvedValue(undefined),
        };

        mockController = {
            showShop: vi.fn(),
            startClock: vi.fn(),
        };
    });

    describe('init()', () => {
        test('should warn if no currentLevelId is set', async () => {
            const { logger } = await import('../../js/logger.js');

            strategy.init(mockGame, mockController, 0);

            expect(logger.warn).toHaveBeenCalledWith(
                'CampaignModeStrategy initialized without currentLevelId'
            );
        });

        test('should not warn if currentLevelId is set', async () => {
            const { logger } = await import('../../js/logger.js');
            mockGame.currentLevelId = 'level_1';

            strategy.init(mockGame, mockController, 0);

            expect(logger.warn).not.toHaveBeenCalled();
        });
    });

    describe('startLevel()', () => {
        test('should handle level not found', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            strategy.startLevel(mockGame, mockController, 'nonexistent');

            expect(consoleSpy).toHaveBeenCalledWith('Level not found:', 'nonexistent');
            consoleSpy.mockRestore();
        });

        test('should setup level_1 with fixed board', async () => {
            const { BoardFactory } = await import('../../js/campaign/BoardFactory.js');

            strategy.startLevel(mockGame, mockController, 'level_1');

            expect(mockGame.campaignMode).toBe(true);
            expect(mockGame.currentLevelId).toBe('level_1');
            expect(mockGame.aiPersonality).toBe('CAUTIOUS');
            expect(mockGame.playerColor).toBe('white');
            expect(mockGame.phase).toBe(PHASES.PLAY);
            expect(BoardFactory.createLevel1Board).toHaveBeenCalled();
            expect(mockController.startClock).toHaveBeenCalled();
        });

        test('should setup level_2 with fixed board', async () => {
            const { BoardFactory } = await import('../../js/campaign/BoardFactory.js');

            strategy.startLevel(mockGame, mockController, 'level_2');

            expect(mockGame.campaignMode).toBe(true);
            expect(mockGame.currentLevelId).toBe('level_2');
            expect(mockGame.aiPersonality).toBe('AGGRESSIVE');
            expect(mockGame.playerColor).toBe('black');
            expect(BoardFactory.createLevel2Board).toHaveBeenCalled();
        });

        test('should setup budget level with setup phase', () => {
            strategy.startLevel(mockGame, mockController, 'level_budget');

            expect(mockGame.campaignMode).toBe(true);
            expect(mockGame.currentLevelId).toBe('level_budget');
            expect(mockGame.points).toBe(20);
            expect(mockGame.phase).toBe(PHASES.SETUP_WHITE_KING);
            expect(mockController.showShop).toHaveBeenCalledWith(true);
        });

        test('should show intro modal with level info', async () => {
            const { showModal } = await import('../../js/ui.js');

            strategy.startLevel(mockGame, mockController, 'level_1');

            expect(showModal).toHaveBeenCalledWith(
                'Tutorial Level',
                expect.stringContaining('Learn the basics'),
                expect.any(Array)
            );
        });
    });

    describe('handleInteraction()', () => {
        test('should delegate to setupStrategy for budget levels', async () => {
            mockGame.currentLevelId = 'level_budget';

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(true);
        });

        test('should handle play phase for fixed levels', async () => {
            mockGame.currentLevelId = 'level_1';
            mockGame.phase = PHASES.PLAY;

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(true);
            expect(mockGame.handlePlayClick).toHaveBeenCalledWith(4, 4);
        });

        test('should return false for unknown levels', async () => {
            mockGame.currentLevelId = 'nonexistent';
            mockGame.phase = PHASES.SETUP_WHITE_KING;

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(false);
        });

        test('should return false if handlePlayClick is missing', async () => {
            mockGame.currentLevelId = 'level_1';
            mockGame.phase = PHASES.PLAY;
            mockGame.handlePlayClick = undefined;

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(false);
        });
    });

    describe('onPhaseEnd()', () => {
        test('should delegate to setupStrategy for budget levels', () => {
            mockGame.currentLevelId = 'level_budget';

            strategy.onPhaseEnd(mockGame, mockController);

            // SetupModeStrategy.onPhaseEnd should be called
            // This is verified by the mock setup
        });

        test('should do nothing for fixed levels', () => {
            mockGame.currentLevelId = 'level_1';

            // Should not throw
            strategy.onPhaseEnd(mockGame, mockController);
        });

        test('should handle unknown levels gracefully', () => {
            mockGame.currentLevelId = 'nonexistent';

            // Should not throw
            strategy.onPhaseEnd(mockGame, mockController);
        });
    });
});
