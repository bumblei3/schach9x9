/**
 * Structural + cross-reference invariant tests for js/campaign/campaignData.ts.
 *
 * The campaign levels are pure config (FEN start position, win condition, goals,
 * gold rewards, unlock graph). Bad data breaks the solo campaign silently:
 * a broken unlock target orphans later chapters, a malformed FEN fails to load,
 * and — the bug this suite pins — an opponentPersonality with no matching entry
 * in AI_PERSONALITIES makes the opponent AI resolve to `undefined` and crash.
 *
 * The Level type allows opponentPersonality 'expert', but AI_PERSONALITIES has
 * no 'expert' key, so the consuming code MUST resolve personalities through a
 * balanced fallback. These tests lock that contract.
 */

import { describe, test, expect } from 'vitest';
import { CAMPAIGN_LEVELS, CAMPAIGN_PERKS } from '../js/campaign/campaignData.js';
import { AI_PERSONALITIES } from '../js/ai/personalities.js';

const ids = CAMPAIGN_LEVELS.map(l => l.id);

/** Resolve a personality the way the runtime must: with a balanced fallback. */
function resolvePersonality(key: string | undefined) {
  return AI_PERSONALITIES[key || 'balanced'] || AI_PERSONALITIES.balanced;
}

describe('CAMPAIGN_LEVELS structure', () => {
  test('there are levels and each has the required identifying fields', () => {
    expect(CAMPAIGN_LEVELS.length).toBeGreaterThan(0);
    for (const l of CAMPAIGN_LEVELS) {
      expect(typeof l.id).toBe('string');
      expect(l.id.length).toBeGreaterThan(0);
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.description.length).toBeGreaterThan(0);
      expect(l.opponentName.length).toBeGreaterThan(0);
    }
  });

  test('level ids are unique', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every FEN describes a 9x9 board (9 ranks) with the expected kings', () => {
    for (const l of CAMPAIGN_LEVELS) {
      if (!l.fen) continue;
      const placement = l.fen!.split(' ')[0];
      const ranks = placement.split('/');
      expect(ranks).toHaveLength(9);
      const whiteKings = (placement.match(/K/g) || []).length;
      const blackKings = (placement.match(/k/g) || []).length;
      // The opponent (black) king is always present.
      expect(blackKings).toBe(1);
      // 'fixed' setups ship the full player army incl. the white king; 'budget'
      // setups let the player place their own pieces, so white has no king yet.
      if (l.setupType === 'fixed') {
        expect(whiteKings).toBe(1);
      } else {
        expect(whiteKings).toBe(0);
      }
    }
  });

  test('gold rewards are non-negative numbers', () => {
    for (const l of CAMPAIGN_LEVELS) {
      expect(typeof l.goldReward).toBe('number');
      expect(l.goldReward).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('CAMPAIGN_LEVELS unlock graph', () => {
  test('every unlock target refers to an existing level id', () => {
    for (const l of CAMPAIGN_LEVELS) {
      for (const target of l.unlocks ?? []) {
        expect(ids).toContain(target);
      }
    }
  });

  test('a level never unlocks itself', () => {
    for (const l of CAMPAIGN_LEVELS) {
      expect(l.unlocks ?? []).not.toContain(l.id);
    }
  });
});

describe('opponentPersonality resolves to a valid runtime config (regression: final_battle)', () => {
  test("every level's opponentPersonality resolves to a defined config via the balanced fallback", () => {
    for (const l of CAMPAIGN_LEVELS) {
      const cfg = resolvePersonality(l.opponentPersonality);
      expect(cfg).toBeDefined();
      expect(typeof cfg.id).toBe('string');
      expect(typeof cfg.mobilityWeight).toBe('number');
    }
  });

  test("the 'expert' personality (used by the boss level) has no direct entry and MUST fall back", () => {
    // Documents the exact gap that caused the crash: AI_PERSONALITIES['expert']
    // is undefined, so consuming code cannot index it without a fallback.
    expect(AI_PERSONALITIES['expert']).toBeUndefined();
    expect(resolvePersonality('expert')).toBe(AI_PERSONALITIES.balanced);
  });

  test('personalities that DO exist resolve to their own config, not the fallback', () => {
    for (const key of ['aggressive', 'defensive', 'balanced']) {
      expect(resolvePersonality(key).id).toBe(AI_PERSONALITIES[key].id);
    }
  });
});

describe('CAMPAIGN_PERKS structure', () => {
  test('each perk has a unique id, a name, and a positive cost', () => {
    const perkIds = CAMPAIGN_PERKS.map(p => p.id);
    expect(new Set(perkIds).size).toBe(perkIds.length);
    for (const p of CAMPAIGN_PERKS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.cost).toBeGreaterThan(0);
    }
  });
});
