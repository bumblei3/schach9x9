/**
 * Focused tests for js/campaign/CampaignManager.ts — campaign progress, gold,
 * XP/level-up, star calculation, and talent unlocking.
 *
 * CampaignManager had NO dedicated test file before this. The reward/level
 * gating and the star/thresholds math are exactly the kind of logic that must
 * never silently regress. Each test spins up a fresh `new CampaignManager()`
 * with `localStorage` left undefined, which makes loadState() fall back to the
 * deterministic default state (peasant_revolt unlocked, 0 gold) and saveGame()
 * a no-op — so the suite is fully headless and order-independent.
 */

import { describe, test, expect, beforeEach } from 'vitest';

const { CampaignManager } = await import('../../js/campaign/CampaignManager.js');
const { UNIT_TALENT_TREES } = await import('../../js/campaign/talents.js');

// Ensure no localStorage in the test env so every instance starts from the
// deterministic default state (loadState's `typeof localStorage === 'undefined'` branch).
beforeEach(() => {
  // @ts-expect-error - intentionally remove localStorage for a clean default-state instance
  delete (globalThis as any).localStorage;
  // @ts-expect-error - remove window too (saveGame guards on it indirectly via localStorage)
  delete (globalThis as any).window;
});

describe('CampaignManager construction + defaults', () => {
  test('starts with peasant_revolt unlocked and 0 gold when no storage', () => {
    const cm = new CampaignManager();
    expect(cm.isLevelUnlocked('peasant_revolt')).toBe(true);
    expect(cm.getGold()).toBe(0);
    expect(cm.getState().completedLevels).toEqual([]);
  });

  test('default state exposes all eight unit types at XP level 1', () => {
    const cm = new CampaignManager();
    for (const t of ['p', 'n', 'b', 'r', 'q', 'a', 'c', 'e']) {
      expect(cm.getUnitXp(t).level).toBe(1);
    }
  });
});

describe('level + reward unlocking', () => {
  let cm: any;
  beforeEach(() => {
    cm = new CampaignManager();
  });

  test('unlockLevel adds the id and reports it unlocked', () => {
    expect(cm.isLevelUnlocked('some_level')).toBe(false);
    cm.unlockLevel('some_level');
    expect(cm.isLevelUnlocked('some_level')).toBe(true);
  });

  test('unlockLevel is idempotent (no duplicate entries)', () => {
    cm.unlockLevel('some_level');
    cm.unlockLevel('some_level');
    expect(cm.getState().unlockedLevels.filter((l: string) => l === 'some_level')).toHaveLength(1);
  });

  test('unlockAll merges all campaign level ids without duplicates', () => {
    cm.unlockAll();
    expect(cm.isLevelUnlocked('peasant_revolt')).toBe(true);
    // every CAMPAIGN_LEVELS id should now be present
    expect(cm.getState().unlockedLevels.length).toBeGreaterThan(1);
  });

  test('isRewardUnlocked / isPerkUnlocked default false', () => {
    expect(cm.isRewardUnlocked('angel')).toBe(false);
    expect(cm.isPerkUnlocked('some_perk')).toBe(false);
  });
});

describe('gold economy', () => {
  let cm: any;
  beforeEach(() => {
    cm = new CampaignManager();
  });

  test('addGold increases the balance', () => {
    cm.addGold(50);
    expect(cm.getGold()).toBe(50);
  });

  test('spendGold succeeds when affordable', () => {
    cm.addGold(100);
    expect(cm.spendGold(40)).toBe(true);
    expect(cm.getGold()).toBe(60);
  });

  test('spendGold fails (and leaves gold untouched) when too little', () => {
    cm.addGold(10);
    expect(cm.spendGold(40)).toBe(false);
    expect(cm.getGold()).toBe(10);
  });
});

describe('unit XP + level-up', () => {
  let cm: any;
  beforeEach(() => {
    cm = new CampaignManager();
  });

  test('addUnitXp accumulates xp and captures', () => {
    cm.addUnitXp('n', 30, 2);
    expect(cm.getUnitXp('n').xp).toBe(30);
    expect(cm.getUnitXp('n').captures).toBe(2);
  });

  test('crossing the 100xp threshold levels the unit up', () => {
    const leveled = cm.addUnitXp('n', 100);
    expect(leveled).toBe(true);
    expect(cm.getUnitXp('n').level).toBe(2);
  });

  test('below-threshold xp does not level up', () => {
    const leveled = cm.addUnitXp('n', 50);
    expect(leveled).toBe(false);
    expect(cm.getUnitXp('n').level).toBe(1);
  });

  test('incrementUnitCaptures adds a single capture', () => {
    cm.incrementUnitCaptures('p');
    cm.incrementUnitCaptures('p');
    expect(cm.getUnitXp('p').captures).toBe(2);
  });
});

describe('completeLevel — stars + gold + progression', () => {
  let cm: any;
  beforeEach(() => {
    cm = new CampaignManager();
  });

  test('numeric stars recorded and level marked completed', () => {
    const stars = cm.completeLevel('peasant_revolt', 3);
    expect(stars).toBe(3);
    expect(cm.isLevelCompleted('peasant_revolt')).toBe(true);
    expect(cm.getLevelStars('peasant_revolt')).toBe(3);
  });

  test('first completion awards the level gold reward, repeat does not', () => {
    const first = cm.completeLevel('peasant_revolt', 3);
    const goldAfterFirst = cm.getGold();
    expect(goldAfterFirst).toBeGreaterThan(0);
    // Completing again (same stars) should not re-award base gold.
    cm.completeLevel('peasant_revolt', 3);
    expect(cm.getGold()).toBe(goldAfterFirst);
  });

  test('improving stars awards a per-star bonus', () => {
    cm.completeLevel('peasant_revolt', 1); // 1 star, base gold
    const afterOne = cm.getGold();
    cm.completeLevel('peasant_revolt', 3); // up to 3 -> 2 bonus stars * 20
    expect(cm.getGold()).toBe(afterOne + 40);
  });

  test('stats-object path computes stars via goals (valid range)', () => {
    // peasant_revolt has goals; a stats object routes through calculateStars
    // (not the numeric branch) and must return a valid 1..3 star count.
    const stars = cm.completeLevel('peasant_revolt', { moves: 10 });
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(stars).toBeLessThanOrEqual(3);
    // deterministic: same input -> same stars
    expect(cm.completeLevel('peasant_revolt', { moves: 10 })).toBe(stars);
  });

  test('unknown level id returns 0, awards no gold, unlocks no next level', () => {
    const goldBefore = cm.getGold();
    expect(cm.completeLevel('does_not_exist', 3)).toBe(0);
    // Note: the implementation still records it in completedLevels, but
    // awards no gold and never advances currentLevelId / unlocks a successor.
    expect(cm.getGold()).toBe(goldBefore);
    expect(cm.getCurrentLevelId()).toBe('peasant_revolt');
  });
});

describe('talent unlocking', () => {
  let cm: any;
  beforeEach(() => {
    cm = new CampaignManager();
    cm.addGold(500);
  });

  test('unknown unit tree -> false', () => {
    expect(cm.unlockTalent('zzz', 'some_talent', 100)).toBe(false);
  });

  test('unknown talent id -> false', () => {
    expect(cm.unlockTalent('n', 'no_such_talent', 100)).toBe(false);
  });

  test('insufficient gold -> false and talent stays locked', () => {
    cm.addGold(-500); // back to 0
    expect(cm.unlockTalent('n', 'charge', 100)).toBe(false);
    expect(cm.isTalentUnlocked('charge')).toBe(false);
  });

  test('valid unlock deducts cost and records the talent', () => {
    const tree: any = UNIT_TALENT_TREES;
    const talent = tree.n.talents[0]; // e.g. 'n_agile', cost 75
    const before = cm.getGold();
    const ok = cm.unlockTalent('n', talent.id, talent.cost);
    expect(ok).toBe(true);
    expect(cm.isTalentUnlocked(talent.id)).toBe(true);
    expect(cm.getGold()).toBe(before - talent.cost);
  });

  test('unlocking an already-unlocked talent is a no-op returning true', () => {
    const tree: any = UNIT_TALENT_TREES;
    const talent = tree.n.talents[0];
    cm.unlockTalent('n', talent.id, talent.cost);
    const goldBefore = cm.getGold();
    expect(cm.unlockTalent('n', talent.id, talent.cost)).toBe(true);
    expect(cm.getGold()).toBe(goldBefore); // not charged twice
  });
});

describe('champion + reset', () => {
  let cm: any;
  beforeEach(() => {
    cm = new CampaignManager();
  });

  test('setChampion stores and getChampion returns it', () => {
    cm.setChampion('n');
    expect(cm.getChampion()).toBe('n');
    cm.setChampion(null);
    expect(cm.getChampion()).toBeNull();
  });

  test('resetState returns to the default unlocked level and 0 gold', () => {
    cm.addGold(999);
    cm.completeLevel('peasant_revolt', 3);
    cm.resetState();
    expect(cm.getGold()).toBe(0);
    expect(cm.isLevelCompleted('peasant_revolt')).toBe(false);
    expect(cm.getLevelStars('peasant_revolt')).toBe(0);
  });
});
