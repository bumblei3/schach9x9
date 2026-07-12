/**
 * Focused economy/state invariant tests for js/campaign/CampaignManager.ts.
 *
 * The main campaignManager.test.ts covers level completion + gold/XP payouts.
 * This suite targets the *state-mutating invariants* that were only partially
 * covered (spendGold failure path, perk/champion state, idempotent unlocks,
 * negative gold). No UI / no AI involved.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const { mockLevels } = vi.hoisted(() => ({
  mockLevels: [
    { id: 'peasant_revolt', reward: null },
    { id: 'level_2', reward: null },
    { id: 'level_3', reward: 'angel' },
  ],
}));

vi.mock('../js/campaign/campaignData.js', () => ({
  CAMPAIGN_LEVELS: mockLevels,
  CAMPAIGN_PERKS: [
    { id: 'stabile_bauern', name: 'Stabile Bauern', cost: 150, icon: '🛡️' },
    { id: 'elite_garde', name: 'Elite-Garde', cost: 250, icon: '⚔️' },
  ],
}));

vi.mock('../js/storage.js', () => ({
  storageManager: {},
}));

import { CampaignManager } from '../js/campaign/CampaignManager.js';

describe('CampaignManager economy invariants', () => {
  let manager: CampaignManager;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    manager = new CampaignManager();
  });

  test('spendGold succeeds and deducts when affordable', () => {
    manager.addGold(100);
    expect(manager.getGold()).toBe(100);
    const ok = manager.spendGold(40);
    expect(ok).toBe(true);
    expect(manager.getGold()).toBe(60);
  });

  test('spendGold fails and leaves gold unchanged when insufficient', () => {
    manager.addGold(30);
    const ok = manager.spendGold(50);
    expect(ok).toBe(false);
    // gold must not change on a failed spend
    expect(manager.getGold()).toBe(30);
  });

  test('spendGold of exactly the available balance succeeds and zeroes out', () => {
    manager.addGold(70);
    const ok = manager.spendGold(70);
    expect(ok).toBe(true);
    expect(manager.getGold()).toBe(0);
  });

  test('addGold with a negative amount reduces the balance', () => {
    manager.addGold(100);
    manager.addGold(-25);
    expect(manager.getGold()).toBe(75);
  });

  test('setChampion / getChampion round-trips and clears when null', () => {
    manager.setChampion('q');
    expect(manager.getChampion()).toBe('q');
    manager.setChampion(null);
    expect(manager.getChampion()).toBe(null);
  });
});

describe('CampaignManager unlock idempotency', () => {
  let manager: CampaignManager;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    manager = new CampaignManager();
  });

  test('unlockLevel is idempotent (no duplicate entries)', () => {
    manager.unlockLevel('level_2');
    manager.unlockLevel('level_2');
    const unlocked = (manager as unknown as { state: { unlockedLevels: string[] } }).state
      .unlockedLevels;
    const count = unlocked.filter((id: string) => id === 'level_2').length;
    expect(count).toBe(1);
    expect(manager.isLevelUnlocked('level_2')).toBe(true);
  });

  test('unlockPerk adds a perk and isPerkUnlocked reflects it; idempotent', () => {
    expect(manager.isPerkUnlocked('stabile_bauern')).toBe(false);
    manager.unlockPerk('stabile_bauern');
    expect(manager.isPerkUnlocked('stabile_bauern')).toBe(true);
    // second call must not duplicate / throw
    manager.unlockPerk('stabile_bauern');
    expect(manager.getUnlockedPerks().filter((p: string) => p === 'stabile_bauern').length).toBe(1);
  });

  test('isPerkUnlocked returns false for never-unlocked perk', () => {
    expect(manager.isPerkUnlocked('elite_garde')).toBe(false);
  });
});
