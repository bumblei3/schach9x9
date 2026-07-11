/**
 * Focused invariant tests for the "tutor is smarter than the opponent AI" rule.
 *
 * The tutor advises the human player against the opponent AI. For its hints to
 * be trustworthy it must search STRICTLY DEEPER than the opponent at every
 * difficulty. These tests lock that contract at the single source of truth
 * (config.ts: getOpponentDepth / getTutorDepth), so a future depth-table edit
 * can never silently make the tutor weaker than the opponent again.
 *
 * Background: this regression previously existed — HintGenerator computed
 * tutorDepth = aiDepth + 2, but aiEngine.getTopMoves then searched at
 * `searchDepth - 3`, making the effective tutor depth aiDepth - 1 (shallower
 * than the opponent). The fix centralised depth in getTutorDepth().
 */

import { describe, test, expect } from 'vitest';
import {
  AI_DEPTH_CONFIG,
  AI_DIFFICULTIES,
  TUTOR_DEPTH_BONUS,
  TUTOR_MIN_DEPTH,
  getOpponentDepth,
  getTutorDepth,
} from '../js/config.js';

const ALL_DIFFICULTIES = Object.values(AI_DIFFICULTIES);

describe('tutor vs opponent search depth', () => {
  test('tutor searches strictly deeper than the opponent at every difficulty', () => {
    for (const d of ALL_DIFFICULTIES) {
      const opponent = getOpponentDepth(d);
      const tutor = getTutorDepth(d);
      expect(tutor, `tutor must beat opponent at "${d}"`).toBeGreaterThan(opponent);
    }
  });

  test('tutor depth is opponent + bonus, or the minimum floor, whichever is larger', () => {
    for (const d of ALL_DIFFICULTIES) {
      const opponent = getOpponentDepth(d);
      const expected = Math.max(TUTOR_MIN_DEPTH, opponent + TUTOR_DEPTH_BONUS);
      expect(getTutorDepth(d)).toBe(expected);
    }
  });

  test('the depth advantage is at least the configured bonus', () => {
    for (const d of ALL_DIFFICULTIES) {
      const advantage = getTutorDepth(d) - getOpponentDepth(d);
      expect(advantage).toBeGreaterThanOrEqual(TUTOR_DEPTH_BONUS);
    }
  });

  test('opponent depth matches AI_DEPTH_CONFIG for known difficulties', () => {
    for (const d of ALL_DIFFICULTIES) {
      expect(getOpponentDepth(d)).toBe(
        AI_DEPTH_CONFIG[d as keyof typeof AI_DEPTH_CONFIG]
      );
    }
  });
});

describe('depth helpers — edge cases', () => {
  test('unknown difficulty falls back to a safe opponent depth of 3', () => {
    expect(getOpponentDepth('nonexistent-mode')).toBe(3);
  });

  test('unknown difficulty still yields a tutor deeper than the fallback opponent', () => {
    expect(getTutorDepth('nonexistent-mode')).toBeGreaterThan(getOpponentDepth('nonexistent-mode'));
  });

  test('tutor never searches below the minimum floor', () => {
    for (const d of ALL_DIFFICULTIES) {
      expect(getTutorDepth(d)).toBeGreaterThanOrEqual(TUTOR_MIN_DEPTH);
    }
  });

  test('even the hardest opponent (expert) is out-searched by the tutor', () => {
    const expert = getOpponentDepth(AI_DIFFICULTIES.EXPERT);
    // Expert is the deepest opponent; if the tutor beats it, it beats them all.
    expect(getTutorDepth(AI_DIFFICULTIES.EXPERT)).toBeGreaterThan(expert);
    // Sanity: expert really is the max opponent depth.
    const maxOpponent = Math.max(...ALL_DIFFICULTIES.map(getOpponentDepth));
    expect(expert).toBe(maxOpponent);
  });
});
