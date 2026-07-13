/**
 * Focused tests for js/shop/ShopManager.ts — setup-phase buy/sell/upgrade logic.
 *
 * ShopManager had NO dedicated test file before this. The economic invariants
 * (enough-points checks, corridor validation, own-piece-only selling, upgrade
 * cost deduction, Angel unlock gating) are exactly the kind of logic that must
 * never silently regress. This suite drives ShopManager with a minimal Game
 * stub and asserts the money/board state directly. campaignManager (Angel
 * unlock), UI and logger are mocked; document is stubbed so the DOM-touching
 * lines run headless without throwing.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/campaign/CampaignManager.js', () => ({
  campaignManager: { isRewardUnlocked: vi.fn(() => false) },
}));
vi.mock('../../js/ui.js', () => ({
  updateShopUI: vi.fn(),
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  closeModal: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
}));
vi.mock('../../js/logger.js', () => ({
  logger: { context: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

const { ShopManager } = await import('../../js/shop/ShopManager.js');
const { PIECE_VALUES } = await import('../../js/config.js');
const { campaignManager } = await import('../../js/campaign/CampaignManager.js');

// Minimal Game stub for the shop.
function makeGame(overrides: any = {}) {
  const game: any = {
    boardSize: 9,
    board: Array.from({ length: 9 }, () => Array(9).fill(null)),
    points: 50,
    phase: 'SETUP_WHITE_PIECES',
    mode: 'setup',
    selectedShopPiece: null,
    whiteCorridor: 0,
    blackCorridor: 0,
    log: vi.fn(),
  };
  return Object.assign(game, overrides);
}

// Stub document so querySelectorAll/getElementById calls don't throw.
const els: Record<string, any> = {};
const fakeEl = { classList: { add: vi.fn(), remove: vi.fn() }, innerHTML: '', textContent: '' };
(globalThis as any).document = {
  querySelectorAll: () => [] as any[],
  querySelector: () => fakeEl,
  getElementById: (id: string) => (els[id] ??= { ...fakeEl }),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShopManager.selectShopPiece', () => {
  test('rejects an unaffordable piece without selecting it', () => {
    const game = makeGame({ points: 1 });
    const sm = new ShopManager(game);
    // A queen is expensive (PIECE_VALUES.q is large), 1 point is never enough.
    sm.selectShopPiece('q');
    expect(game.selectedShopPiece).toBeNull();
    expect(game.log).toHaveBeenCalledWith('Nicht genug Punkte!');
  });

  test('selects an affordable piece', () => {
    const game = makeGame({ points: 100 });
    const sm = new ShopManager(game);
    sm.selectShopPiece('n'); // knight is affordable at 100 points
    expect(game.selectedShopPiece).toBe('n');
  });
});

describe('ShopManager.handleBuyPiece', () => {
  let game: any;
  let sm: any;
  beforeEach(() => {
    game = makeGame({ points: 100, selectedShopPiece: 'n' });
    sm = new ShopManager(game);
  });

  test('places the piece, deducts points and clears the selection', () => {
    const knightCost = PIECE_VALUES['n'];
    sm.handleBuyPiece(7, 1); // white corridor: rows 6-8, cols 0-2
    expect(game.board[7][1]).toMatchObject({ type: 'n', color: 'white', hasMoved: false });
    expect(game.points).toBe(100 - knightCost);
    expect(game.selectedShopPiece).toBeNull();
  });

  test('rejects placement outside the own corridor', () => {
    const before = game.points;
    sm.handleBuyPiece(4, 4); // middle of board, not in white corridor
    expect(game.board[4][4]).toBeNull();
    expect(game.points).toBe(before);
    expect(game.log).toHaveBeenCalledWith('Muss im eigenen Korridor platziert werden!');
  });

  test('rejects an occupied square', () => {
    game.board[7][1] = { type: 'r', color: 'white', hasMoved: false };
    const before = game.points;
    sm.handleBuyPiece(7, 1);
    expect(game.points).toBe(before);
    expect(game.log).toHaveBeenCalledWith('Feld besetzt!');
  });
});

describe('ShopManager.handleSellPiece', () => {
  let game: any;
  let sm: any;
  beforeEach(() => {
    game = makeGame({ points: 10, selectedShopPiece: null });
    sm = new ShopManager(game);
  });

  test('refunds and removes an own non-king piece', () => {
    game.board[7][1] = { type: 'n', color: 'white', hasMoved: false };
    const refund = PIECE_VALUES['n'];
    sm.handleSellPiece(7, 1);
    expect(game.board[7][1]).toBeNull();
    expect(game.points).toBe(10 + refund);
    expect(game.log).toHaveBeenCalledWith('Figur entfernt, Punkte erstattet.');
  });

  test('refuses to sell the king', () => {
    game.board[7][1] = { type: 'k', color: 'white', hasMoved: false };
    const before = game.points;
    sm.handleSellPiece(7, 1);
    expect(game.board[7][1]).not.toBeNull();
    expect(game.points).toBe(before);
  });

  test('refuses to sell an opponent piece', () => {
    // phase is SETUP_WHITE_PIECES -> only white pieces are sellable
    game.board[7][1] = { type: 'n', color: 'black', hasMoved: false };
    const before = game.points;
    sm.handleSellPiece(7, 1);
    expect(game.board[7][1]).not.toBeNull();
    expect(game.points).toBe(before);
  });
});

describe('ShopManager.getAvailableUpgrades (Angel gating)', () => {
  let game: any;
  let sm: any;
  beforeEach(() => {
    game = makeGame();
    sm = new ShopManager(game);
  });

  test('Angel is available in upgrade mode without campaign unlock', () => {
    game.mode = 'upgrade';
    const upgrades = sm.getAvailableUpgrades('p');
    expect(upgrades.map((u: any) => u.symbol)).toContain('e');
  });

  test('Angel is gated by campaign unlock in setup mode', () => {
    game.mode = 'setup';
    (campaignManager as any).isRewardUnlocked.mockReturnValue(false);
    expect(sm.getAvailableUpgrades('p').map((u: any) => u.symbol)).not.toContain('e');

    (campaignManager as any).isRewardUnlocked.mockReturnValue(true);
    expect(sm.getAvailableUpgrades('p').map((u: any) => u.symbol)).toContain('e');
  });

  test('non-Angel upgrades are always available', () => {
    game.mode = 'setup';
    const ups = sm.getAvailableUpgrades('n').map((u: any) => u.symbol);
    expect(ups).toContain('a');
    expect(ups).toContain('c');
  });
});

describe('ShopManager.performUpgrade', () => {
  let game: any;
  let sm: any;
  beforeEach(() => {
    game = makeGame({ points: 100 });
    game.board[7][1] = { type: 'r', color: 'white', hasMoved: false };
    sm = new ShopManager(game);
  });

  test('upgrades the piece type and deducts the cost', () => {
    const rookVal = PIECE_VALUES['r'];
    const chancellorVal = PIECE_VALUES['c'];
    const cost = chancellorVal - rookVal;
    sm.performUpgrade(7, 1, 'c'); // rook -> chancellor
    expect(game.board[7][1].type).toBe('c');
    expect(game.points).toBe(100 - cost);
  });

  test('does nothing when there is no piece at the square', () => {
    game.board[7][1] = null;
    const before = game.points;
    sm.performUpgrade(7, 1, 'c');
    expect(game.points).toBe(before);
  });

  test('does not upgrade when the player cannot afford it', () => {
    game.points = 0;
    sm.performUpgrade(7, 1, 'c');
    expect(game.board[7][1].type).toBe('r'); // unchanged
  });
});
