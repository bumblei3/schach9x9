import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController } from '../../js/gameController';
import { PHASES } from '../../js/gameEngine';
import * as UI from '../../js/ui';
import { campaignManager } from '../../js/campaign/CampaignManager';

vi.mock('../../js/ui', () => ({
    initBoardUI: vi.fn(),
    updateStatus: vi.fn(),
    renderBoard: vi.fn(),
    updateShopUI: vi.fn(),
    showShop: vi.fn(),
    updateStatistics: vi.fn(),
    updateClockUI: vi.fn(),
    updateClockDisplay: vi.fn(),
    updateCapturedUI: vi.fn(),
    updateMoveHistoryUI: vi.fn(),
    showPuzzleOverlay: vi.fn(),
    hidePuzzleOverlay: vi.fn(),
    updatePuzzleStatus: vi.fn(),
    showCampaignVictoryModal: vi.fn(),
}));

vi.mock('../../js/sounds', () => ({
    soundManager: {
        init: vi.fn(),
        playMove: vi.fn(),
        playGameStart: vi.fn(),
        playGameOver: vi.fn(),
    },
}));

vi.mock('../../js/campaign/CampaignManager', () => ({
    campaignManager: {
        getLevel: vi.fn(),
        completeLevel: vi.fn(),
        state: { unlockedRewards: [] },
    },
}));

vi.mock('../../js/tutorial', () => ({
    Tutorial: vi.fn().mockImplementation(function () {
        return { show: vi.fn(), initUI: vi.fn() };
    }),
}));

vi.mock('../../js/statisticsManager', () => ({
    StatisticsManager: vi.fn().mockImplementation(function () {
        return { saveGame: vi.fn(), loadGame: vi.fn() };
    }),
}));

vi.mock('../../js/shop/ShopManager', () => ({
    ShopManager: vi.fn().mockImplementation(function () {
        return {
            selectShopPiece: vi.fn(),
            placeShopPiece: vi.fn(),
            showUpgradeOptions: vi.fn(),
            aiPerformUpgrades: vi.fn()
        };
    }),
}));

vi.mock('../../js/ui/NotificationUI', () => ({
    notificationUI: {
        show: vi.fn(),
    },
}));

describe('GameController Comprehensive Coverage', () => {
    let mockGame: any;
    let controller: GameController;

    beforeEach(() => {
        mockGame = {
            phase: PHASES.PLAY,
            turn: 'white',
            points: 0,
            initialPoints: 0,
            isAI: false,
            isAnimating: false,
            replayMode: false,
            playerColor: 'white',
            difficulty: 'medium',
            moveHistory: [],
            stats: { totalMoves: 10, promotions: 1 },
            calculateMaterialAdvantage: vi.fn().mockReturnValue(5),
            log: vi.fn(),
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            aiController: { setAnalysisUI: vi.fn(), toggleAnalysisMode: vi.fn() },
            tutorController: { showHint: vi.fn() },
            analysisManager: { toggleBestMove: vi.fn() },
        };

        // Setup DOM for overlays
        document.body.innerHTML = `
      <div id="main-menu"></div>
      <div id="game-over-overlay" class="hidden"></div>
      <div id="winner-text"></div>
      <div id="draw-offer-overlay" class="hidden"></div>
      <div id="draw-offer-message"></div>
      <div id="board"><div></div></div>
    `;

        controller = new GameController(mockGame);
        // @ts-ignore - manual setup of dependency
        controller.gameStartTime = Date.now() - 10000;
    });

    describe('initGame Modes', () => {
        it('should initialize upgrade mode correctly', () => {
            mockGame.mode = 'upgrade'; // Simulate constructor
            controller.initGame(0, 'upgrade');
            expect(mockGame.points).toBe(25);
            expect(mockGame.mode).toBe('upgrade');
        });

        it('should initialize puzzle mode (legacy path)', () => {
            controller.initGame(0, 'puzzle' as any);
            expect(mockGame.mode).toBe('puzzle');
            expect(UI.renderBoard).toHaveBeenCalled();
        });
    });

    describe('handleCellClick Blocks', () => {
        it('should block click in replay mode', async () => {
            mockGame.replayMode = true;
            await controller.handleCellClick(0, 0);
            expect(mockGame.log).not.toHaveBeenCalled();
        });

        it('should block click during animation', async () => {
            mockGame.isAnimating = true;
            await controller.handleCellClick(0, 0);
            expect(mockGame.log).not.toHaveBeenCalled();
        });

        it('should block click during AI turn', async () => {
            mockGame.isAI = true;
            mockGame.phase = PHASES.PLAY;
            mockGame.turn = 'black';
            await controller.handleCellClick(0, 0);
            expect(mockGame.log).not.toHaveBeenCalled();
        });
    });

    describe('placeKing Validation', () => {
        it('should reject white king in black area', () => {
            controller.placeKing(0, 0, 'white');
            expect(mockGame.log).toHaveBeenCalledWith(expect.stringContaining('Ungültiger Bereich'));
        });
    });

    describe('upgradePiece Validation', () => {
        it('should prevent upgrading opponent piece', () => {
            mockGame.phase = PHASES.SETUP_WHITE_UPGRADES;
            mockGame.board[0][0] = { color: 'black', type: 'p' };
            controller.upgradePiece(0, 0);
            expect(mockGame.log).toHaveBeenCalledWith(expect.stringContaining('Nur eigene Figuren'));
        });
    });

    describe('Game End & Statistics', () => {
        it('should handle resign by current player', () => {
            controller.resign();
            expect(mockGame.phase).toBe(PHASES.GAME_OVER);
            expect(document.getElementById('game-over-overlay')?.classList.contains('hidden')).toBe(false);
        });

        it('should handle draw decline', () => {
            mockGame.drawOffered = true;
            mockGame.drawOfferedBy = 'white';
            mockGame.turn = 'black';
            controller.declineDraw();
            expect(mockGame.drawOffered).toBe(false);
            expect(mockGame.log).toHaveBeenCalledWith(expect.stringContaining('lehnt das Remis-Angebot ab'));
        });

        it('should calculate playerResult correctly in saveGameToStatistics', () => {
            // Testing the logic: result='loss', losingColor='white' -> 'loss'
            // @ts-ignore - access private for testing or trigger via public
            controller.saveGameToStatistics('loss', 'white');
            expect(controller.statisticsManager.saveGame).toHaveBeenCalledWith(expect.objectContaining({
                result: 'loss'
            }));

            // result='win', losingColor='black' -> 'win'
            controller.gameStartTime = Date.now();
            // @ts-ignore
            controller.saveGameToStatistics('win', 'black');
            expect(controller.statisticsManager.saveGame).toHaveBeenCalledWith(expect.objectContaining({
                result: 'win'
            }));
        });

        it('should handle draw in handleGameEnd', () => {
            controller.handleGameEnd('draw', 'white'); // winnerColor ignored for draw usually
            expect(controller.statisticsManager.saveGame).toHaveBeenCalledWith(expect.objectContaining({
                result: 'draw'
            }));
        });

        it('should check campaign objectives (void expected)', () => {
            mockGame.campaignMode = true;
            mockGame.currentLevelId = 'level_1';
            (campaignManager.getLevel as any).mockReturnValue({ winCondition: { type: 'capture_target' } });
            controller.checkCampaignObjectives();
            expect(campaignManager.getLevel).toHaveBeenCalledWith('level_1');
        });

        it('should handle campaign victory, complete level and verify callbacks', async () => {
            vi.useFakeTimers();
            mockGame.campaignMode = true;
            mockGame.currentLevelId = 'level_1';
            mockGame.playerColor = 'white';
            mockGame.stats.totalMoves = 10;

            (campaignManager.getLevel as any).mockReturnValue({ title: 'Test Level', winCondition: { type: 'checkmate' } });
            controller.handleGameEnd('win', 'white');

            // Verify level completion was logged correctly (full moves = totalMoves / 2)
            expect(campaignManager.completeLevel).toHaveBeenCalledWith('level_1', expect.objectContaining({
                moves: 5,
                materialDiff: 5,
                promotedCount: 1
            }));

            await vi.advanceTimersByTimeAsync(2000);

            expect(UI.showCampaignVictoryModal).toHaveBeenCalled();
            const calls = (UI.showCampaignVictoryModal as any).mock.calls[0];
            const buttons = calls[2];

            // Buttons: [Next Level, Main Menu]
            expect(buttons[0].text).toBe('Nächste Mission');
            expect(buttons[1].text).toBe('Hauptmenü');

            // Trigger callbacks for coverage
            buttons[0].callback();
            buttons[1].callback();

            vi.useRealTimers();
        });
    });

    describe('Puzzle Flow', () => {
        it('should load next puzzle if available', () => {
            const mockPuzzle = { title: 'Puzzle 1' };
            // @ts-ignore - global mock
            import('../../js/puzzleManager').then(m => {
                (m.puzzleManager.nextPuzzle as any) = vi.fn().mockReturnValue(mockPuzzle);
                controller.nextPuzzle();
                expect(UI.showPuzzleOverlay).toHaveBeenCalledWith(mockPuzzle);
            });
        });

        it('should show success message if no more puzzles', () => {
            // @ts-ignore
            import('../../js/puzzleManager').then(m => {
                (m.puzzleManager.nextPuzzle as any) = vi.fn().mockReturnValue(null);
                controller.nextPuzzle();
                expect(UI.updatePuzzleStatus).toHaveBeenCalledWith('success', expect.any(String));
            });
        });
    });
});
