import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopManager } from '../../js/shop/ShopManager.js';
import { PHASES } from '../../js/gameEngine.js';
import { PIECE_VALUES } from '../../js/config.js';
import * as UI from '../../js/ui.js';

// Mock UI dependencies
vi.mock('../../js/ui.js', () => ({
    updateShopUI: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn(),
    renderBoard: vi.fn(),
}));

// Mock Campaign Manager
vi.mock('../../js/campaign/CampaignManager.js', () => ({
    campaignManager: {
        isRewardUnlocked: vi.fn().mockReturnValue(true) // Default unlock all
    }
}));

describe('ShopManager Coverage', () => {
    let shopManager: ShopManager;
    let mockGame: any;

    beforeEach(() => {
        mockGame = {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            boardSize: 9,
            points: 0,
            phase: PHASES.SETUP_WHITE_PIECES,
            whiteCorridor: 0,
            blackCorridor: 0,
            selectedShopPiece: null,
            log: vi.fn(),
            mode: 'standard'
        };

        shopManager = new ShopManager(mockGame);
        vi.clearAllMocks();

        // Setup generic piece values if imported config is empty (mock safety)
        if (!PIECE_VALUES['p']) {
            Object.assign(PIECE_VALUES, { p: 1, n: 3, b: 3, r: 5, q: 9, c: 8, a: 7, e: 10 });
        }
    });

    describe('Buying Pieces', () => {
        it('should buy piece if affordable and valid placement', () => {
            mockGame.points = 10;
            mockGame.selectedShopPiece = 'p'; // Pawn cost 1

            // White setup: rows 6-8.
            const r = 6, c = 0;

            shopManager.placeShopPiece(r, c);

            expect(mockGame.board[r][c]).toEqual({
                type: 'p',
                color: 'white',
                hasMoved: false
            });
            expect(mockGame.points).toBe(9); // 10 - 1
            expect(mockGame.selectedShopPiece).toBeNull();
            expect(UI.updateShopUI).toHaveBeenCalled();
        });

        it('should reject purchase if too expensive', () => {
            mockGame.points = 0;
            mockGame.selectedShopPiece = 'q'; // Queen cost 9

            shopManager.placeShopPiece(6, 0);

            expect(mockGame.board[6][0]).toBeNull();
            // Log happens in selectShopPiece, not handleBuyPiece silent fail
            expect(mockGame.log).not.toHaveBeenCalled();
            // Wait, selectShopPiece checks affordability BEFORE selection.
            // If we force selection on game state:
            // handleBuyPiece DOES check affordability again.
        });

        it('should reject placement outside corridor', () => {
            mockGame.points = 10;
            mockGame.selectedShopPiece = 'p';
            mockGame.whiteCorridor = 0; // Cols 0-2

            // Place at col 5 (invalid)
            shopManager.placeShopPiece(6, 5);

            expect(mockGame.board[6][5]).toBeNull();
            expect(mockGame.log).toHaveBeenCalledWith('Muss im eigenen Korridor platziert werden!');
        });
    });

    describe('Selling Pieces', () => {
        it('should sell own piece and refund', () => {
            mockGame.points = 0;
            mockGame.board[6][0] = { type: 'p', color: 'white' }; // Own piece
            mockGame.selectedShopPiece = null; // Ensure sell mode

            shopManager.placeShopPiece(6, 0);

            expect(mockGame.board[6][0]).toBeNull();
            expect(mockGame.points).toBeGreaterThan(0); // Refunded
            expect(UI.updateShopUI).toHaveBeenCalled();
        });

        it('should not sell enemy piece', () => {
            mockGame.board[6][0] = { type: 'p', color: 'black' }; // Enemy
            shopManager.placeShopPiece(6, 0);
            expect(mockGame.board[6][0]).not.toBeNull();
        });
    });

    describe('AI Upgrades', () => {
        it('should upgrade pieces if affordable', () => {
            mockGame.points = 50; // Rich AI
            // Setup a black pawn
            mockGame.board[1][0] = { type: 'p', color: 'black' };

            // Spy on performUpgrade
            const upgradeSpy = vi.spyOn(shopManager, 'performUpgrade');

            shopManager.aiPerformUpgrades();

            // Should have upgraded the pawn something better
            expect(upgradeSpy).toHaveBeenCalled();
            const target = mockGame.board[1][0];
            expect(target.type).not.toBe('p');
        });

        it('should stop when out of points', () => {
            mockGame.points = 0;
            mockGame.board[1][0] = { type: 'p', color: 'black' };

            shopManager.aiPerformUpgrades();

            expect(mockGame.board[1][0].type).toBe('p'); // Unchanged
        });
    });

    describe('Upgrade UI', () => {
        it('showUpgradeOptions - displays modal with upgrades', () => {
            mockGame.board[6][0] = { type: 'p', color: 'white' };
            mockGame.points = 100;

            shopManager.showUpgradeOptions(6, 0);

            expect(UI.showModal).toHaveBeenCalled();
            // Check calls arguments for content potentially?
            // expect(UI.showModal.mock.calls[0][1]).toContain('Upgrade für Bauer');
        });
    });
});
