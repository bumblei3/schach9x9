/**
 * Tests for ShopManager
 */

import { jest } from '@jest/globals';
import { ShopManager } from '../js/shop/ShopManager.js';
import { BOARD_SIZE, PHASES } from '../js/config.js';

describe('ShopManager', () => {
  let mockGame;
  let shopManager;

  beforeEach(() => {
    // Mock document
    global.document = {
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      getElementById: jest.fn(() => null),
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
      whiteCorridor: { rowStart: 6, colStart: 3 },
      blackCorridor: { rowStart: 0, colStart: 3 },
      selectedShopPiece: null,
      log: jest.fn(),
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
});
