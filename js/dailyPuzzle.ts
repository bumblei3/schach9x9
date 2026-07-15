/**
 * dailyPuzzle.ts
 *
 * Tägliches Puzzle (Daily Puzzle) — v1.2.0
 *
 * Reuses the existing `puzzleManager` infrastructure. Each calendar day maps
 * deterministically to one of the embedded puzzles via `getDailyPuzzleIndex`.
 * Solved state is tracked per-day in `localStorage` under
 * `dailyPuzzle.solved.YYYY-MM-DD` (local date), independent of the puzzle id
 * so repeating the same puzzle on a later day does not grant a stale streak.
 */

import { puzzleManager, type Puzzle } from './puzzleManager.js';

const DAY_MS = 86_400_000;
const STREAK_CAP = 365;
const BEST_STREAK_KEY = 'dailyPuzzle.bestStreak';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function dailyKey(date: Date): string {
  // Local date — NOT toISOString (which is UTC and would rotate at the wrong time).
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local-day index base: number of local calendar days since a fixed epoch.
// Using local Y-M-D (via Date.UTC of the local components) keeps this on the
// SAME basis as `dailyKey`, so the shown puzzle and the solved-tracking key can
// never disagree across timezones (both rotate at local midnight).
const LOCAL_EPOCH = Date.UTC(2000, 0, 1);

function localDayIndex(date: Date): number {
  const localEpochMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((localEpochMs - LOCAL_EPOCH) / DAY_MS);
}

export class DailyPuzzleManager {
  /**
   * Stable per-day index into `puzzleManager.puzzles`, rotating at LOCAL
   * midnight. Derived from the same local Y-M-D basis as `getDailyKey`, so the
   * shown puzzle and the solved-tracking key stay consistent in every timezone.
   * Same local date always yields the same index.
   */
  getDailyPuzzleIndex(date: Date = new Date()): number {
    const length = puzzleManager.puzzles.length;
    if (length === 0) return 0;
    return localDayIndex(date) % length;
  }

  /** Local `YYYY-MM-DD` key for the given date. */
  getDailyKey(date: Date = new Date()): string {
    return dailyKey(date);
  }

  /** The puzzle selected for the given day, or null if none are embedded. */
  getTodaysPuzzle(date: Date = new Date()): Puzzle | null {
    const puzzles = puzzleManager.puzzles;
    if (puzzles.length === 0) return null;
    return puzzles[this.getDailyPuzzleIndex(date)] ?? null;
  }

  /** Whether today's daily puzzle has been solved. */
  isSolvedToday(date: Date = new Date()): boolean {
    try {
      return localStorage.getItem(`dailyPuzzle.solved.${dailyKey(date)}`) === '1';
    } catch (e) {
      console.warn('LocalStorage error:', e);
      return false;
    }
  }

  /** Mark today's daily puzzle as solved (daily-key storage only). */
  markSolvedToday(date: Date = new Date()): void {
    try {
      localStorage.setItem(`dailyPuzzle.solved.${dailyKey(date)}`, '1');
      // Peak streak for this run: walk forward to the end of the consecutive
      // solved chain, then count backwards (handles marking older days after
      // newer ones were already marked).
      let end = date;
      for (let n = 1; n < STREAK_CAP; n++) {
        const next = new Date(date.getTime() + n * DAY_MS);
        let solved = false;
        try {
          solved = localStorage.getItem(`dailyPuzzle.solved.${dailyKey(next)}`) === '1';
        } catch {
          solved = false;
        }
        if (!solved) break;
        end = next;
      }
      const current = this.getStreak(end);
      const best = this.getBestStreak();
      if (current > best) {
        localStorage.setItem(BEST_STREAK_KEY, String(current));
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  /**
   * Count consecutive solved days walking backwards from `date`. Capped to
   * avoid an unbounded loop. Returns 0 when the current day is unsolved.
   */
  getStreak(date: Date = new Date()): number {
    let streak = 0;
    for (let n = 0; n < STREAK_CAP; n++) {
      const d = new Date(date.getTime() - n * DAY_MS);
      const solved = (() => {
        try {
          return localStorage.getItem(`dailyPuzzle.solved.${dailyKey(d)}`) === '1';
        } catch (e) {
          console.warn('LocalStorage error:', e);
          return false;
        }
      })();
      if (!solved) break;
      streak++;
    }
    return streak;
  }

  /** All-time best consecutive daily solves (persisted). */
  getBestStreak(): number {
    try {
      const raw = localStorage.getItem(BEST_STREAK_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (e) {
      console.warn('LocalStorage error:', e);
      return 0;
    }
  }

  /**
   * Human-readable streak summary for menu badges / solve toast.
   * Example: "🔥 3 Tage · Best 7" or empty string when never solved.
   */
  formatStreakLabel(date: Date = new Date()): string {
    const current = this.getStreak(date);
    const best = Math.max(this.getBestStreak(), current);
    if (current <= 0 && best <= 0) return '';
    if (current <= 0) return `Best ${best}`;
    const dayWord = current === 1 ? 'Tag' : 'Tage';
    return `🔥 ${current} ${dayWord} · Best ${best}`;
  }
}

export const dailyPuzzle = new DailyPuzzleManager();
