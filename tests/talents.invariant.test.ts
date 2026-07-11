/**
 * Structural + semantic invariant tests for js/campaign/talents.ts.
 *
 * The talent trees are pure config for the solo campaign's unit-progression
 * system. Bad data (a talent whose tier-3 cost is cheaper than tier-1, an
 * unknown effectType, a duplicate id, a talent keyed under the wrong unit)
 * silently breaks progression without a crash, so these tests lock the shape
 * and the tier -> reqLevel -> cost monotonicity.
 */

import { describe, test, expect } from 'vitest';
import { UNIT_TALENT_TREES, type TalentNode } from '../js/campaign/talents.js';

const TREES = Object.values(UNIT_TALENT_TREES);
const ALL_TALENTS: TalentNode[] = TREES.flatMap((t) => t.talents);
const ALLOWED_EFFECTS = ['passive_gold', 'stat_boost', 'mechanic', 'setup_bonus'];
// All 9x9 piece types, including the fairy pieces a/c/e.
const EXPECTED_UNITS = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e'];

describe('UNIT_TALENT_TREES structure', () => {
  test('every 9x9 unit type has a talent tree', () => {
    for (const u of EXPECTED_UNITS) {
      expect(UNIT_TALENT_TREES[u]).toBeDefined();
      expect(UNIT_TALENT_TREES[u].unitType).toBe(u);
    }
  });

  test('the map key matches the tree.unitType field', () => {
    for (const [key, tree] of Object.entries(UNIT_TALENT_TREES)) {
      expect(tree.unitType).toBe(key);
    }
  });

  test('talent ids are globally unique', () => {
    const ids = ALL_TALENTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("each talent's id is prefixed with its owning unit type", () => {
    for (const tree of TREES) {
      for (const talent of tree.talents) {
        expect(talent.id.startsWith(`${tree.unitType}_`)).toBe(true);
      }
    }
  });
});

describe('TalentNode field validity', () => {
  test('every talent has the required non-empty string fields', () => {
    for (const t of ALL_TALENTS) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
    }
  });

  test('tier is 1, 2, or 3', () => {
    for (const t of ALL_TALENTS) {
      expect([1, 2, 3]).toContain(t.tier);
    }
  });

  test('reqLevel and cost are positive numbers', () => {
    for (const t of ALL_TALENTS) {
      expect(t.reqLevel).toBeGreaterThan(0);
      expect(t.cost).toBeGreaterThan(0);
    }
  });

  test('effectType is one of the allowed kinds', () => {
    for (const t of ALL_TALENTS) {
      expect(ALLOWED_EFFECTS).toContain(t.effectType);
    }
  });
});

describe('progression monotonicity within a tree', () => {
  // Higher tier must never be cheaper or unlock earlier than a lower tier.
  test('within each unit tree, higher tier => higher (or equal) reqLevel and cost', () => {
    for (const tree of TREES) {
      const sorted = [...tree.talents].sort((a, b) => a.tier - b.tier);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (cur.tier > prev.tier) {
          expect(cur.reqLevel).toBeGreaterThanOrEqual(prev.reqLevel);
          expect(cur.cost).toBeGreaterThanOrEqual(prev.cost);
        }
      }
    }
  });

  test('tiers within a tree are unique (no two talents share a tier)', () => {
    for (const tree of TREES) {
      const tiers = tree.talents.map((t) => t.tier);
      expect(new Set(tiers).size).toBe(tiers.length);
    }
  });
});
