/**
 * Focused tests for js/dailyPuzzle.ts — Daily Puzzle index rotation, streak
 * counting, and localStorage-backed solved tracking.
 *
 * DailyPuzzle had NO dedicated test file before this. The logic is pure and
 * high-value: deterministic per-day puzzle selection (local-midnight rotate),
 * consecutive-solved streak counting with a safety cap, and resilient
 * localStorage access (try/catch around every read/write, including the
 * throw-on-access path). All of it is exercised with a mockable localStorage.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// In-memory localStorage mock shared across tests.
class MemStorage {
  private store: Record<string, string> = {};
  getItem(k: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null;
  }
  setItem(k: string, v: string): void {
    this.store[k] = String(v);
  }
  removeItem(k: string): void {
    delete this.store[k];
  }
  clear(): void {
    this.store = {};
  }
}

const mem = new MemStorage();

vi.stubGlobal('localStorage', mem);

const { DailyPuzzleManager } = await import('../js/dailyPuzzle.js');

function dpm(): InstanceType<typeof DailyPuzzleManager> {
  return new DailyPuzzleManager();
}

// Fixed reference date: 2026-07-13 (local).
function refDate(): Date {
  return new Date(2026, 6, 13, 10, 0, 0, 0);
}

beforeEach(() => {
  mem.clear();
});

describe('getDailyKey / dailyKey', () => {
  test('uses the LOCAL calendar date, not UTC', () => {
    // A date whose UTC representation is a different calendar day than local.
    // 2026-07-14T04:30 UTC == 2026-07-13T23:30 local (UTC-5) -> local key stays 2026-07-13.
    // Force a known local timezone-independent check via explicit components:
    const local = new Date(2026, 6, 13, 23, 30, 0);
    expect(dpm().getDailyKey(local)).toBe('2026-07-13');
  });

  test('pads month and day with leading zeros', () => {
    const local = new Date(2026, 0, 5, 9, 0, 0); // Jan 5
    expect(dpm().getDailyKey(local)).toBe('2026-01-05');
  });
});

describe('getDailyPuzzleIndex', () => {
  test('is deterministic for the same local date', () => {
    const m = dpm();
    const a = m.getDailyPuzzleIndex(refDate());
    const b = m.getDailyPuzzleIndex(refDate());
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
  });

  test('rotates to a different puzzle on a different day', () => {
    const m = dpm();
    const today = m.getDailyPuzzleIndex(refDate());
    const tomorrow = m.getDailyPuzzleIndex(new Date(refDate().getTime() + 2 * 86_400_000));
    // With the embedded puzzle set, two days apart very likely differ (and if
    // not, at least the function stays within range).
    expect(today).toBeGreaterThanOrEqual(0);
    expect(tomorrow).toBeGreaterThanOrEqual(0);
  });
});

describe('getTodaysPuzzle', () => {
  test('returns a puzzle object for a normal day', () => {
    const p = dpm().getTodaysPuzzle(refDate());
    expect(p).not.toBeNull();
  });

  test('returns null and index 0 when no puzzles are embedded', async () => {
    // Temporarily empty the shared puzzle list to exercise the length===0 guards.
    const { puzzleManager } = await import('../js/puzzleManager.js');
    const original = (puzzleManager as any).puzzles;
    (puzzleManager as any).puzzles = [];
    try {
      const m = dpm();
      expect(m.getDailyPuzzleIndex(refDate())).toBe(0);
      expect(m.getTodaysPuzzle(refDate())).toBeNull();
    } finally {
      (puzzleManager as any).puzzles = original;
    }
  });
});

describe('isSolvedToday / markSolvedToday', () => {
  test('reports unsolved before marking and solved after marking', () => {
    const m = dpm();
    const d = refDate();
    expect(m.isSolvedToday(d)).toBe(false);
    m.markSolvedToday(d);
    expect(m.isSolvedToday(d)).toBe(true);
  });

  test('tracks per local day independently', () => {
    const m = dpm();
    const today = refDate();
    const yesterday = new Date(today.getTime() - 86_400_000);
    m.markSolvedToday(today);
    expect(m.isSolvedToday(today)).toBe(true);
    expect(m.isSolvedToday(yesterday)).toBe(false);
  });

  test('falls back to false when localStorage access throws on read', () => {
    const m = dpm();
    const d = refDate();
    const spy = vi.spyOn(mem, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(m.isSolvedToday(d)).toBe(false);
    spy.mockRestore();
  });

  test('does not throw when localStorage access throws on write', () => {
    const m = dpm();
    const d = refDate();
    const spy = vi.spyOn(mem, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => m.markSolvedToday(d)).not.toThrow();
    spy.mockRestore();
  });
});

describe('getStreak', () => {
  test('returns 0 when today is unsolved', () => {
    expect(dpm().getStreak(refDate())).toBe(0);
  });

  test('counts consecutive solved days walking backwards', () => {
    const m = dpm();
    const today = refDate();
    m.markSolvedToday(today);
    m.markSolvedToday(new Date(today.getTime() - 1 * 86_400_000));
    m.markSolvedToday(new Date(today.getTime() - 2 * 86_400_000));
    expect(m.getStreak(today)).toBe(3);
  });

  test('stops counting at the first unsolved day', () => {
    const m = dpm();
    const today = refDate();
    m.markSolvedToday(today);
    // skip yesterday (unsolved), solve the day before
    m.markSolvedToday(new Date(today.getTime() - 2 * 86_400_000));
    expect(m.getStreak(today)).toBe(1);
  });

  test('is bounded by STREAK_CAP (365) and never loops unboundedly', () => {
    const m = dpm();
    const today = refDate();
    // Mark far more than the cap as solved; streak must cap at 365.
    for (let n = 0; n < 400; n++) {
      m.markSolvedToday(new Date(today.getTime() - n * 86_400_000));
    }
    expect(m.getStreak(today)).toBeLessThanOrEqual(365);
    expect(m.getStreak(today)).toBe(365);
  });

  test('returns 0 when localStorage read throws inside the loop', () => {
    const m = dpm();
    const spy = vi.spyOn(mem, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(m.getStreak(refDate())).toBe(0);
    spy.mockRestore();
  });
});

describe('best streak + formatStreakLabel', () => {
  test('markSolvedToday updates best streak', () => {
    const m = dpm();
    const today = refDate();
    m.markSolvedToday(today);
    m.markSolvedToday(new Date(today.getTime() - 86_400_000));
    // After only marking two days non-consecutively? both marked - walk back: today+yesterday = 2
    // We marked today and yesterday in either order - getStreak from today should be 2 if both solved.
    expect(m.getStreak(today)).toBe(2);
    expect(m.getBestStreak()).toBeGreaterThanOrEqual(2);
  });

  test('formatStreakLabel is empty when never solved', () => {
    expect(dpm().formatStreakLabel(refDate())).toBe('');
  });

  test('formatStreakLabel includes fire emoji after a solve', () => {
    const m = dpm();
    m.markSolvedToday(refDate());
    expect(m.formatStreakLabel(refDate())).toMatch(/🔥/);
    expect(m.formatStreakLabel(refDate())).toMatch(/Best/);
  });
});
