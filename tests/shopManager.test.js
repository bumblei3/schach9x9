/**
 * Tests for ShopManager
 */

import { ShopManager } from '../js/shop/ShopManager.js';
import { BOARD_SIZE, PHASES } from '../js/config.js';

describe('ShopManager', () => {
  let mockGame;
  let shopManager;

  beforeEach(() => {
    // Mock document
    global.document = {
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(() => null),
      getElementById: vi.fn(() => null),
    };

    // Mock window
    global.window = {
      battleChess3D: null,
    };

    mockGame = {
      board: Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null)),
      turn: 'white',
      phase: PHASES.SETUP_WHITE_PIECES,
      points: 15,
      whiteCorridor: 3,
      blackCorridor: 3,
      selectedShopPiece: null,
      log: vi.fn(),
    };

    // Place white king
    mockGame.board[8][4] = { type: 'k', color: 'white' };

    shopManager = new ShopManager(mockGame);
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      expect(shopManager.game).toBe(mockGame);
    });
  });

  describe('selectShopPiece', () => {
    test('should select piece when affordable', () => {
      mockGame.points = 10;

      shopManager.selectShopPiece('r');

      expect(mockGame.selectedShopPiece).toBe('r');
    });

    test('should not select when not affordable', () => {
      mockGame.points = 1;

      shopManager.selectShopPiece('q'); // Queen costs 9

      expect(mockGame.selectedShopPiece).toBeNull();
    });

    test('should do nothing for null pieceType', () => {
      shopManager.selectShopPiece(null);

      expect(mockGame.selectedShopPiece).toBeNull();
    });
  });

  describe('placeShopPiece', () => {
    test('should place piece when selected and in corridor', () => {
      mockGame.points = 10;
      mockGame.selectedShopPiece = 'r';

      shopManager.placeShopPiece(7, 4);

      expect(mockGame.board[7][4]).toEqual({
        type: 'r',
        color: 'white',
        hasMoved: false,
      });
      expect(mockGame.points).toBe(5); // 10 - 5 for rook
    });

    test('should not place on occupied cell', () => {
      mockGame.points = 10;
      mockGame.selectedShopPiece = 'r';
      mockGame.board[7][4] = { type: 'p', color: 'white' };

      shopManager.placeShopPiece(7, 4);

      // Should still be pawn
      expect(mockGame.board[7][4].type).toBe('p');
    });

    test('should not place outside corridor', () => {
      mockGame.points = 10;
      mockGame.selectedShopPiece = 'r';

      shopManager.placeShopPiece(0, 0);

      expect(mockGame.board[0][0]).toBeNull();
    });

    test('should call handleSellPiece when no piece selected', () => {
      mockGame.selectedShopPiece = null;
      mockGame.board[7][4] = { type: 'p', color: 'white' };
      mockGame.points = 5;

      shopManager.placeShopPiece(7, 4);

      // Piece should be removed as it's inside corridor and we have no selection
      expect(mockGame.board[7][4]).toBeNull();
      expect(mockGame.points).toBe(6); // 5 + 1 for pawn
    });
  });

  describe('handleSellPiece', () => {
    test('should refund points when removing own piece', () => {
      mockGame.board[7][4] = { type: 'r', color: 'white' };
      mockGame.points = 5;

      shopManager.handleSellPiece(7, 4);

      expect(mockGame.board[7][4]).toBeNull();
      expect(mockGame.points).toBe(10); // 5 + 5 for rook
    });

    test('should not remove king', () => {
      mockGame.board[8][4] = { type: 'k', color: 'white' };
      const originalPoints = mockGame.points;

      shopManager.handleSellPiece(8, 4);

      expect(mockGame.board[8][4]).not.toBeNull();
      expect(mockGame.points).toBe(originalPoints);
    });
  });

  describe('getAvailableUpgrades', () => {
    test('should NOT include Angel if reward is locked', () => {
      // Accessing private method for test, no 'as any' needed in JS
      const upgrades = shopManager.getAvailableUpgrades('q');
      const hasAngel = upgrades.some(u => u.symbol === 'e');
      expect(hasAngel).toBe(false);
    });

    test('should include Knight upgrades correctly', () => {
      const upgrades = shopManager.getAvailableUpgrades('n');
      const hasNightrider = upgrades.some(u => u.symbol === 'j');
      expect(hasNightrider).toBe(true);
    });
  });

  describe('performUpgrade', () => {
    test('should upgrade knight to nightrider and deduct correct points', () => {
      // Knight (3) -> Nightrider (6) costs 3 points
      mockGame.board[7][4] = { type: 'n', color: 'white' };
      mockGame.points = 10;

      shopManager.performUpgrade(7, 4, 'j');

      expect(mockGame.board[7][4].type).toBe('j');
      expect(mockGame.points).toBe(7); // 10 - 3
    });

    test('should allow chain upgrade: Knight -> Nightrider -> Chancellor', () => {
      // Knight (3) -> Nightrider (6) -> Chancellor (8)
      mockGame.board[7][4] = { type: 'n', color: 'white' };
      mockGame.points = 10;

      // Step 1: Knight -> Nightrider (Costs 3)
      shopManager.performUpgrade(7, 4, 'j');
      expect(mockGame.board[7][4].type).toBe('j');
      expect(mockGame.points).toBe(7); // 10 - 3

      // Step 2: Nightrider -> Chancellor (Costs 2: 8-6)
      shopManager.performUpgrade(7, 4, 'c');
      expect(mockGame.board[7][4].type).toBe('c');
      expect(mockGame.points).toBe(5); // 7 - 2
    });
  });
});
