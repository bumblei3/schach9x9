/**
 * ShopManager Tests
 * Coverage target: 81% -> 90%+
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ShopManager } from '../../js/shop/ShopManager.js';
import { PHASES } from '../../js/gameEngine.js';

// Mock UI module
vi.mock('../../js/ui.js', () => ({
  updateShopUI: vi.fn(),
  showModal: vi.fn(),
  renderBoard: vi.fn(),
  closeModal: vi.fn(),
}));

// Mock campaignManager
vi.mock('../../js/campaign/CampaignManager.js', () => ({
  campaignManager: {
    isRewardUnlocked: vi.fn().mockReturnValue(true),
  },
}));

describe('ShopManager', () => {
  let shopManager: ShopManager;
  let mockGame: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup basic DOM elements for ShopManager
    document.body.innerHTML = `
      <div id="selected-piece-display"></div>
      <button class="shop-btn" data-piece="n"></button>
      <div class="shop-item" data-piece="n"></div>
    `;

    mockGame = {
      points: 20,
      selectedShopPiece: null,
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: PHASES.SETUP_WHITE_PIECES,
      whiteCorridor: 3,
      blackCorridor: 3,
      boardSize: 9,
      mode: 'setup',
      log: vi.fn(),
    };

    shopManager = new ShopManager(mockGame);
  });

  describe('selectShopPiece()', () => {
    test('should select piece if affordable', () => {
      shopManager.selectShopPiece('n'); // Knight cost 3

      expect(mockGame.selectedShopPiece).toBe('n');
      const btn = document.querySelector('.shop-btn[data-piece="n"]');
      expect(btn?.classList.contains('selected')).toBe(true);
      expect(document.getElementById('selected-piece-display')?.innerHTML).toContain('Springer');
    });

    test('should not select piece if not affordable', () => {
      mockGame.points = 2; // Knight cost 3
      shopManager.selectShopPiece('n');

      expect(mockGame.selectedShopPiece).toBeNull();
      expect(mockGame.log).toHaveBeenCalledWith('Nicht genug Punkte!');
    });

    test('should return early if no pieceType provided', () => {
      shopManager.selectShopPiece('');
      expect(mockGame.selectedShopPiece).toBeNull();
    });
  });

  describe('placeShopPiece()', () => {
    test('should delegate to handleSellPiece if no piece selected', () => {
      const sellSpy = vi.spyOn(shopManager, 'handleSellPiece');
      shopManager.placeShopPiece(6, 4);
      expect(sellSpy).toHaveBeenCalledWith(6, 4);
    });

    test('should delegate to handleBuyPiece if piece is selected', () => {
      mockGame.selectedShopPiece = 'n';
      const buySpy = vi.spyOn(shopManager, 'handleBuyPiece');
      shopManager.placeShopPiece(6, 4);
      expect(buySpy).toHaveBeenCalledWith(6, 4);
    });
  });

  describe('handleSellPiece()', () => {
    test('should sell own non-king piece and refund points', async () => {
      const { updateShopUI } = await import('../../js/ui.js');
      mockGame.board[6][4] = { type: 'n', color: 'white' };
      mockGame.phase = PHASES.SETUP_WHITE_PIECES;
      mockGame.points = 0;

      shopManager.handleSellPiece(6, 4);

      expect(mockGame.points).toBe(3); // Refunded Knight value
      expect(mockGame.board[6][4]).toBeNull();
      expect(updateShopUI).toHaveBeenCalled();
    });

    test('should not sell king', () => {
      mockGame.board[6][4] = { type: 'k', color: 'white' };
      shopManager.handleSellPiece(6, 4);

      expect(mockGame.points).toBe(20);
      expect(mockGame.board[6][4]).not.toBeNull();
      expect(mockGame.log).toHaveBeenCalledWith('Bitte zuerst eine Figur im Shop auswählen!');
    });

    test('should not sell opponent piece', () => {
      mockGame.board[6][4] = { type: 'n', color: 'black' };
      shopManager.handleSellPiece(6, 4);

      expect(mockGame.points).toBe(20);
      expect(mockGame.board[6][4]).not.toBeNull();
    });
  });

  describe('handleBuyPiece()', () => {
    test('should place piece in valid corridor and deduct points', async () => {
      const { updateShopUI } = await import('../../js/ui.js');
      mockGame.selectedShopPiece = 'n';
      mockGame.phase = PHASES.SETUP_WHITE_PIECES;

      shopManager.handleBuyPiece(6, 4); // White corridor r=6-8, c=3-5

      expect(mockGame.board[6][4]).toEqual({ type: 'n', color: 'white', hasMoved: false });
      expect(mockGame.points).toBe(17); // 20 - 3
      expect(updateShopUI).toHaveBeenCalled();
    });

    test('should call 3D board addPiece if enabled', async () => {
      (window as any).battleChess3D = {
        enabled: true,
        addPiece: vi.fn(),
      };
      mockGame.selectedShopPiece = 'n';
      shopManager.handleBuyPiece(6, 4);
      expect((window as any).battleChess3D.addPiece).toHaveBeenCalledWith('n', 'white', 6, 4);
      delete (window as any).battleChess3D;
    });

    test('should fail if outside corridor', () => {
      mockGame.selectedShopPiece = 'n';
      shopManager.handleBuyPiece(6, 1); // Row 6, Col 1 (outside c=3-5)

      expect(mockGame.board[6][1]).toBeNull();
      expect(mockGame.log).toHaveBeenCalledWith('Muss im eigenen Korridor platziert werden!');
    });

    test('should fail if square occupied', () => {
      mockGame.selectedShopPiece = 'n';
      mockGame.board[6][4] = { type: 'p', color: 'white' };
      shopManager.handleBuyPiece(6, 4);

      expect(mockGame.points).toBe(20);
      expect(mockGame.log).toHaveBeenCalledWith('Feld besetzt!');
    });
  });

  describe('showUpgradeOptions()', () => {
    test('should show modal with available upgrades', async () => {
      const { showModal } = await import('../../js/ui.js');
      mockGame.board[6][4] = { type: 'p', color: 'white' };

      shopManager.showUpgradeOptions(6, 4);

      expect(showModal).toHaveBeenCalledWith(
        expect.stringContaining('Upgrade für Bauer'),
        expect.stringContaining('upgrade-options'),
        expect.any(Array)
      );
    });

    test('should log if no upgrades available', () => {
      mockGame.board[6][4] = { type: 'k', color: 'white' }; // King has no upgrades
      shopManager.showUpgradeOptions(6, 4);
      expect(mockGame.log).toHaveBeenCalledWith('Keine Upgrades für diese Figur verfügbar.');
    });

    test('should return early if no piece at coordinates', () => {
      shopManager.showUpgradeOptions(0, 0); // Empty cell
      // Should not throw and not call showModal
    });
  });

  describe('upgradePiece()', () => {
    test('should execute upgrade and deduct cost', async () => {
      const { updateShopUI, renderBoard, closeModal } = await import('../../js/ui.js');
      mockGame.board[6][4] = { type: 'p', color: 'white' }; // Pawn value 1
      mockGame.points = 10;

      shopManager.performUpgrade(6, 4, 'n'); // Knight value 3, cost = 3-1 = 2

      expect(mockGame.board[6][4].type).toBe('n');
      expect(mockGame.points).toBe(8); // 10 - 2
      expect(updateShopUI).toHaveBeenCalled();
      expect(renderBoard).toHaveBeenCalled();
      expect(closeModal).toHaveBeenCalled();
    });

    test('should call 3D board remove/add if enabled', () => {
      (window as any).battleChess3D = {
        enabled: true,
        removePiece: vi.fn(),
        addPiece: vi.fn(),
      };
      mockGame.board[6][4] = { type: 'p', color: 'white' };
      shopManager.performUpgrade(6, 4, 'n');
      expect((window as any).battleChess3D.removePiece).toHaveBeenCalledWith(6, 4);
      expect((window as any).battleChess3D.addPiece).toHaveBeenCalledWith('n', 'white', 6, 4);
      delete (window as any).battleChess3D;
    });

    test('should fail if cannot afford cost', () => {
      mockGame.board[6][4] = { type: 'p', color: 'white' }; // 1
      mockGame.points = 1;

      shopManager.performUpgrade(6, 4, 'e'); // Angel value 12, cost 11

      expect(mockGame.board[6][4].type).toBe('p');
      expect(mockGame.points).toBe(1);
    });
  });

  describe('aiPerformUpgrades()', () => {
    test('should spend points on upgrades', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // Force pawn upgrade
      mockGame.board[0][4] = { type: 'p', color: 'black' };
      mockGame.points = 10;
      mockGame.boardSize = 9;

      shopManager.aiPerformUpgrades();

      // Should have performed at least one upgrade
      expect(mockGame.board[0][4].type).not.toBe('p');
      expect(mockGame.points).toBeLessThan(10);
      vi.restoreAllMocks();
    });
  });
});
