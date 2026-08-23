import { describe, expect, test } from 'vitest';
import { UNIT_TALENT_TREES, type TalentNode } from '../js/campaign/talents.js';

const FAIRY_TALENTS: Array<{ unit: string; talent: TalentNode }> = (
  ['a', 'c', 'e', 'j'] as const
).flatMap((unit) =>
  UNIT_TALENT_TREES[unit].talents.map((talent) => ({ unit, talent }))
);

describe('Fairy talents (M2.5) — real effects, no flavor text', () => {
  test('every fairy piece has exactly one talent', () => {
    for (const unit of ['a', 'c', 'e', 'j']) {
      expect(UNIT_TALENT_TREES[unit].talents, `unit ${unit}`).toHaveLength(1);
    }
    expect(FAIRY_TALENTS).toHaveLength(4);
  });

  test('each fairy talent has a concrete effectType + effectValue', () => {
    for (const { talent } of FAIRY_TALENTS) {
      expect(['passive_gold', 'stat_boost']).toContain(talent.effectType);
      expect(talent.effectValue, `${talent.id} effectValue`).toBeGreaterThan(0);
      // Description must state a number (no pure flavor text).
      expect(talent.description, talent.id).toMatch(/\d/);
    }
  });

  test('fairy talent ids are unique across all trees', () => {
    const ids = Object.values(UNIT_TALENT_TREES).flatMap((t) =>
      t.talents.map((x) => x.id)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('gold talents belong to archbishop/angel, xp talents to chancellor/nightrider', () => {
    expect(UNIT_TALENT_TREES.a.talents[0]).toMatchObject({
      id: 'a_gabelmeister',
      effectType: 'passive_gold',
      effectValue: 2,
    });
    expect(UNIT_TALENT_TREES.e.talents[0]).toMatchObject({
      id: 'e_engelsfluegel',
      effectType: 'passive_gold',
      effectValue: 3,
    });
    expect(UNIT_TALENT_TREES.c.talents[0]).toMatchObject({
      id: 'c_xrayauge',
      effectType: 'stat_boost',
      effectValue: 5,
    });
    expect(UNIT_TALENT_TREES.j.talents[0]).toMatchObject({
      id: 'j_spurwechsel',
      effectType: 'stat_boost',
      effectValue: 5,
    });
  });
});
