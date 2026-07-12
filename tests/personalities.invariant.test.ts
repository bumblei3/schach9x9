/**
 * Structural + semantic invariant tests for js/ai/personalities.ts.
 *
 * The AI personalities are pure config that drive evaluation weighting and
 * search behaviour. A typo in a weight or an out-of-range modifier silently
 * distorts how an opponent plays, so these tests lock:
 *   - completeness (every personality defines every field, correct types)
 *   - documented value ranges (aggressionLevel 0.5–2.0, riskTolerance 0–1, …)
 *   - the WASM personality mapping is one of the allowed enum values
 *   - semantic ordering (the aggressive profile really is more aggressive than
 *     the defensive one, etc.) so the labels match the numbers
 */

import { describe, test, expect } from 'vitest';
import { AI_PERSONALITIES, type AIPersonality } from '../js/ai/personalities.js';

const ALL = Object.values(AI_PERSONALITIES);
const WASM_VALUES = ['AGGRESSIVE', 'SOLID', 'GENTLE', 'NORMAL'] as const;

const WEIGHT_KEYS: (keyof AIPersonality)[] = [
  'mobilityWeight',
  'safetyWeight',
  'pawnStructureWeight',
  'centerControlWeight',
  'attackWeight',
];

describe('AI_PERSONALITIES completeness', () => {
  test('there is at least one personality and the map key matches nothing by accident', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(5);
  });

  test('every personality defines all fields with the right primitive types', () => {
    for (const p of ALL) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      for (const k of WEIGHT_KEYS) expect(typeof p[k]).toBe('number');
      expect(typeof p.aggressionLevel).toBe('number');
      expect(typeof p.timeManagementFactor).toBe('number');
      expect(typeof p.riskTolerance).toBe('number');
    }
  });

  test('personality ids are unique', () => {
    const ids = ALL.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('AI_PERSONALITIES documented value ranges', () => {
  test('evaluation weights are positive and within a sane band (0 < w <= 3)', () => {
    for (const p of ALL) {
      for (const k of WEIGHT_KEYS) {
        expect(p[k] as number).toBeGreaterThan(0);
        expect(p[k] as number).toBeLessThanOrEqual(3);
      }
    }
  });

  test('aggressionLevel stays within the documented 0.5–2.0 range', () => {
    for (const p of ALL) {
      expect(p.aggressionLevel).toBeGreaterThanOrEqual(0.5);
      expect(p.aggressionLevel).toBeLessThanOrEqual(2.0);
    }
  });

  test('timeManagementFactor stays within the documented 0.5–2.0 range', () => {
    for (const p of ALL) {
      expect(p.timeManagementFactor).toBeGreaterThanOrEqual(0.5);
      expect(p.timeManagementFactor).toBeLessThanOrEqual(2.0);
    }
  });

  test('riskTolerance stays within the documented 0.0–1.0 range', () => {
    for (const p of ALL) {
      expect(p.riskTolerance).toBeGreaterThanOrEqual(0.0);
      expect(p.riskTolerance).toBeLessThanOrEqual(1.0);
    }
  });

  test('wasmPersonality maps to one of the allowed enum values', () => {
    for (const p of ALL) {
      expect(WASM_VALUES).toContain(p.wasmPersonality);
    }
  });
});

describe('AI_PERSONALITIES semantic consistency (labels match numbers)', () => {
  const byId = Object.fromEntries(ALL.map(p => [p.id, p]));

  test('a balanced profile exists with all evaluation weights at 1.0', () => {
    const bal = byId['BALANCED'];
    expect(bal).toBeDefined();
    for (const k of WEIGHT_KEYS) expect(bal[k]).toBe(1.0);
    expect(bal.aggressionLevel).toBe(1.0);
  });

  test('aggressive plays sharper than defensive', () => {
    const agg = byId['AGGRESSIVE'];
    const def = byId['DEFENSIVE'];
    expect(agg).toBeDefined();
    expect(def).toBeDefined();
    expect(agg.attackWeight).toBeGreaterThan(def.attackWeight);
    expect(agg.aggressionLevel).toBeGreaterThan(def.aggressionLevel);
    expect(agg.riskTolerance).toBeGreaterThan(def.riskTolerance);
    // and it cares less about king safety than the defensive profile
    expect(agg.safetyWeight).toBeLessThan(def.safetyWeight);
  });

  test('defensive/positional profiles weight safety or structure above attack', () => {
    for (const id of ['DEFENSIVE', 'POSITIONAL']) {
      const p = byId[id];
      expect(p).toBeDefined();
      const defensiveEmphasis = Math.max(p.safetyWeight, p.pawnStructureWeight);
      expect(defensiveEmphasis).toBeGreaterThanOrEqual(p.attackWeight);
    }
  });

  test('every aggressive-leaning profile maps to the AGGRESSIVE wasm enum', () => {
    for (const p of ALL) {
      if (p.attackWeight >= 1.5 && p.aggressionLevel >= 1.3) {
        expect(p.wasmPersonality).toBe('AGGRESSIVE');
      }
    }
  });
});
