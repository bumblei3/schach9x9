import { jest } from '@jest/globals';
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock UI
jest.unstable_mockModule('../js/ui.js', () => ({
  renderBoard: jest.fn(),
  updateShopUI: jest.fn(),
  showModal: jest.fn(),
  closeModal: jest.fn(),
}));

const { ShopManager } = await import('../js/shop/ShopManager.js');

describe('Troop Upgrade Mode - Unit Tests', () => {
  let game;
  let shopManager;

  beforeEach(() => {
    game = new Game(15, 'setup');
    shopManager = new ShopManager(game);

    // Mock game log
    game.log = jest.fn();

    // Mock PIECE_SVGS globally if needed, though we don't call it directly in ShopManager logic usually
    global.window = {
      PIECE_SVGS: {
        white: { p: '', n: '', b: '', r: '', q: '', a: '', c: '', e: '' },
        black: { p: '', n: '', b: '', r: '', q: '', a: '', c: '', e: '' },
      },
      gameController: {
        shopManager: shopManager,
      },
    };
  });

  test('should correctly identify available upgrades', () => {
    const bishopUpgrades = shopManager.getAvailableUpgrades('b');
    expect(bishopUpgrades.some(u => u.symbol === 'a')).toBe(true); // Archbishop

    const queenUpgrades = shopManager.getAvailableUpgrades('q');
    expect(queenUpgrades.some(u => u.symbol === 'e')).toBe(true); // Angel

    const knightUpgrades = shopManager.getAvailableUpgrades('n');
    expect(knightUpgrades.length).toBe(3); // n -> a, c, e
  });

  test('should upgrade piece and deduct points', () => {
    // Place a queen (9 points)
    game.board[7][4] = { type: 'q', color: 'white', hasMoved: false };
    game.points = 10;

    // Upgrade Queen (9) -> Angel (12) cost = 3
    shopManager.upgradePiece(7, 4, 'e');

    expect(game.board[7][4].type).toBe('e');
    expect(game.points).toBe(7); // 10 - 3
    expect(game.log).toHaveBeenCalledWith(expect.stringContaining('verbessert'));
  });

  test('should not upgrade if points are insufficient', () => {
    // Place a queen (9 points)
    game.board[7][4] = { type: 'q', color: 'white', hasMoved: false };
    game.points = 2; // Only 2 points, need 3 for Angel

    shopManager.upgradePiece(7, 4, 'e');

    expect(game.board[7][4].type).toBe('q'); // Still Queen
    expect(game.points).toBe(2);
  });

  test('8x8 mode should start in correct phase based on points', () => {
    const classic8x8 = new Game(0, 'standard8x8');
    expect(classic8x8.phase).toBe(PHASES.PLAY);

    const upgrade8x8 = new Game(5, 'standard8x8');
    expect(upgrade8x8.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);
  });
});
