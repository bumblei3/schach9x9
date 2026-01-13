/**
 * StandardModeStrategy Tests
 * Coverage target: 38% -> 80%+
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { StandardModeStrategy } from '../../js/modes/strategies/StandardMode.js';
import { PHASES } from '../../js/config.js';

interface ModalAction {
    text: string;
    class: string;
    callback: () => void;
}

// Mock UI module
vi.mock('../../js/ui.js', () => ({
    updateShopUI: vi.fn(),
    updateStatus: vi.fn(),
    renderBoard: vi.fn(),
    showModal: vi.fn((_title: string, _message: string, actions: ModalAction[]) => {
        // Auto-execute the "Fortfahren" action for testing
        const continueAction = actions.find((a: ModalAction) => a.text === 'Fortfahren');
        if (continueAction) continueAction.callback();
    }),
    updateStatistics: vi.fn(),
}));

// Mock sounds module
vi.mock('../../js/sounds.js', () => ({
    soundManager: {
        playGameStart: vi.fn(),
    },
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

describe('StandardModeStrategy', () => {
    let strategy: StandardModeStrategy;
    let mockGame: any;
    let mockController: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        strategy = new StandardModeStrategy();

        // Mock DOM elements
        document.body.innerHTML = `
      <div class="action-bar hidden"></div>
      <div id="info-tabs-container" class="hidden"></div>
      <div id="quick-actions" class="hidden"></div>
    `;

        mockGame = {
            setupStandard8x8Board: vi.fn(),
            phase: PHASES.PLAY,
            points: 0,
            initialPoints: 15,
            isAI: false,
            log: vi.fn(),
            updateBestMoves: vi.fn(),
            handlePlayClick: vi.fn().mockResolvedValue(undefined),
        };

        mockController = {
            showShop: vi.fn(),
            upgradePiece: vi.fn(),
            finishSetupPhase: vi.fn(),
            autoSave: vi.fn(),
            startClock: vi.fn(),
            gameStartTime: null,
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('init()', () => {
        test('should setup 8x8 board with points and show upgrade phase', () => {
            strategy.init(mockGame, mockController, 15);

            expect(mockGame.setupStandard8x8Board).toHaveBeenCalled();
            expect(mockGame.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);
            expect(mockController.showShop).toHaveBeenCalledWith(true);
        });

        test('should start game directly when no points', () => {
            strategy.init(mockGame, mockController, 0);

            expect(mockGame.setupStandard8x8Board).toHaveBeenCalled();
            expect(mockGame.phase).toBe(PHASES.PLAY);
            expect(mockController.startClock).toHaveBeenCalled();
        });
    });

    describe('handleInteraction()', () => {
        test('should handle white upgrades phase', async () => {
            mockGame.phase = PHASES.SETUP_WHITE_UPGRADES;

            const result = await strategy.handleInteraction(mockGame, mockController, 6, 4);

            expect(result).toBe(true);
            expect(mockController.upgradePiece).toHaveBeenCalledWith(6, 4);
        });

        test('should handle black upgrades phase', async () => {
            mockGame.phase = PHASES.SETUP_BLACK_UPGRADES;

            const result = await strategy.handleInteraction(mockGame, mockController, 1, 4);

            expect(result).toBe(true);
            expect(mockController.upgradePiece).toHaveBeenCalledWith(1, 4);
        });

        test('should handle play phase', async () => {
            mockGame.phase = PHASES.PLAY;

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(true);
            expect(mockGame.handlePlayClick).toHaveBeenCalledWith(4, 4);
        });

        test('should handle analysis phase', async () => {
            mockGame.phase = 'ANALYSIS';

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(true);
            expect(mockGame.handlePlayClick).toHaveBeenCalledWith(4, 4);
        });

        test('should return false for unsupported phase', async () => {
            mockGame.phase = PHASES.SETUP_WHITE_KING;

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(false);
        });

        test('should return false if handlePlayClick is missing', async () => {
            mockGame.phase = PHASES.PLAY;
            mockGame.handlePlayClick = undefined;

            const result = await strategy.handleInteraction(mockGame, mockController, 4, 4);

            expect(result).toBe(false);
        });
    });

    describe('onPhaseEnd()', () => {
        test('should transition from WHITE_UPGRADES to BLACK_UPGRADES', () => {
            mockGame.phase = PHASES.SETUP_WHITE_UPGRADES;
            mockGame.points = 0;

            strategy.onPhaseEnd(mockGame, mockController);

            expect(mockGame.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
            expect(mockGame.points).toBe(15); // Reset to initialPoints
            expect(mockController.autoSave).toHaveBeenCalled();
        });

        test('should auto-finish for AI in black setup', () => {
            mockGame.phase = PHASES.SETUP_WHITE_UPGRADES;
            mockGame.points = 0;
            mockGame.isAI = true;

            strategy.onPhaseEnd(mockGame, mockController);

            expect(mockGame.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);

            // Fast-forward timer for AI auto-finish
            vi.advanceTimersByTime(600);
            expect(mockController.finishSetupPhase).toHaveBeenCalled();
        });

        test('should transition from BLACK_UPGRADES to PLAY', () => {
            mockGame.phase = PHASES.SETUP_BLACK_UPGRADES;
            mockGame.points = 0;

            strategy.onPhaseEnd(mockGame, mockController);

            expect(mockGame.phase).toBe(PHASES.PLAY);
            expect(mockController.startClock).toHaveBeenCalled();
            expect(mockController.showShop).toHaveBeenCalledWith(false);
        });

        test('should show modal when points remain (human white)', async () => {
            const { showModal } = await import('../../js/ui.js');
            mockGame.phase = PHASES.SETUP_WHITE_UPGRADES;
            mockGame.points = 5;
            mockGame.isAI = false;

            strategy.onPhaseEnd(mockGame, mockController);

            expect(showModal).toHaveBeenCalledWith(
                'Ungenutzte Punkte',
                expect.stringContaining('5 Punkte'),
                expect.any(Array)
            );
        });

        test('should skip modal for AI black setup with remaining points', () => {
            mockGame.phase = PHASES.SETUP_BLACK_UPGRADES;
            mockGame.points = 5;
            mockGame.isAI = true;

            strategy.onPhaseEnd(mockGame, mockController);

            // Should transition directly without modal
            expect(mockGame.phase).toBe(PHASES.PLAY);
        });
    });

    describe('startGame() integration', () => {
        test('should show action bar and info tabs when game starts', () => {
            mockGame.points = 0;
            mockGame.phase = PHASES.SETUP_BLACK_UPGRADES;

            strategy.onPhaseEnd(mockGame, mockController);

            const actionBar = document.querySelector('.action-bar');
            const infoTabs = document.getElementById('info-tabs-container');
            const quickActions = document.getElementById('quick-actions');

            expect(actionBar?.classList.contains('hidden')).toBe(false);
            expect(infoTabs?.classList.contains('hidden')).toBe(false);
            expect(quickActions?.classList.contains('hidden')).toBe(false);
        });

        test('should set gameStartTime when game starts', () => {
            mockGame.points = 0;
            mockGame.phase = PHASES.SETUP_BLACK_UPGRADES;

            strategy.onPhaseEnd(mockGame, mockController);

            expect(mockController.gameStartTime).toBeGreaterThan(0);
        });
    });
});
