import { describe, expect, test, beforeEach } from 'vitest';
import { campaignManager } from '../js/campaign/CampaignManager.js';

// `CampaignManager` is the RPG progression singleton. Most of its
// surface is DOM-free (it guards localStorage via `typeof localStorage`
// checks, which is fine under vitest's happy-dom env). We lock the
// pure progression logic: perk unlocking, level-star lookup, gold
// accounting, and the XP fallback for unknown unit types.
//
// The singleton persists `state` across tests, so we reset the
// persisted state via the public gold/perk/level APIs between cases.

describe('CampaignManager — progression invariants', () => {
  beforeEach(() => {
    // Reset persisted progression state through public APIs so tests
    // stay isolated (the singleton otherwise carries state across files).
    const cm = campaignManager as unknown as {
      state: {
        unlockedPerks: string[];
        gold: number;
        levelStars: Record<string, number>;
        unitXp: Record<string, unknown>;
      };
    };
    cm.state.unlockedPerks = [];
    cm.state.gold = 0;
    cm.state.levelStars = {};
    cm.state.unitXp = {};
  });

  describe('perk unlocking', () => {
    test('a perk is locked before unlock and unlocked after', () => {
      expect(campaignManager.isPerkUnlocked('stabile_bauern')).toBe(false);
      campaignManager.unlockPerk('stabile_bauern');
      expect(campaignManager.isPerkUnlocked('stabile_bauern')).toBe(true);
    });

    test('unlocking the same perk twice is idempotent (no duplicates)', () => {
      campaignManager.unlockPerk('stabile_bauern');
      campaignManager.unlockPerk('stabile_bauern');
      // isPerkUnlocked uses Array.includes, so a duplicate would still
      // report true — assert the underlying list has exactly one entry.
      const state = (campaignManager as unknown as { state: { unlockedPerks: string[] } }).state;
      expect(state.unlockedPerks.filter(p => p === 'stabile_bauern')).toHaveLength(1);
    });
  });

  describe('level stars', () => {
    test('an unknown level id reports 0 stars', () => {
      expect(campaignManager.getLevelStars('does-not-exist')).toBe(0);
    });
  });

  describe('gold accounting', () => {
    test('addGold increases the balance', () => {
      expect(campaignManager.getGold()).toBe(0);
      campaignManager.addGold(50);
      expect(campaignManager.getGold()).toBe(50);
    });

    test('spendGold succeeds when affordable and deducts', () => {
      campaignManager.addGold(100);
      const ok = campaignManager.spendGold(40);
      expect(ok).toBe(true);
      expect(campaignManager.getGold()).toBe(60);
    });

    test('spendGold fails when the balance is too low (no debt)', () => {
      campaignManager.addGold(10);
      const ok = campaignManager.spendGold(40);
      expect(ok).toBe(false);
      expect(campaignManager.getGold()).toBe(10); // unchanged
    });
  });

  describe('unit XP fallback', () => {
    test('an unknown unit type yields a fresh level-1, zero-xp record', () => {
      const xp = campaignManager.getUnitXp('nonexistent_unit');
      expect(xp).toEqual({ xp: 0, level: 1, captures: 0 });
    });

    test('a unit that gained xp reports its accumulated value', () => {
      campaignManager.addUnitXp('p', 100, 2);
      const xp = campaignManager.getUnitXp('p');
      expect(xp.xp).toBe(100);
      expect(xp.level).toBe(2); // 100xp crosses the level-2 threshold
      expect(xp.captures).toBe(2);
    });
  });
});
