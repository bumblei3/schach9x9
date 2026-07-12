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

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function dailyKey(date: Date): string {
  // Local date — NOT toISOString (which is UTC and would rotate at the wrong time).
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export class DailyPuzzleManager {
  /**
   * Stable per-day index into `puzzleManager.puzzles`, rotating at local
   * midnight. Same date always yields the same index.
   */
  getDailyPuzzleIndex(date: Date = new Date()): number {
    const length = puzzleManager.puzzles.length;
    if (length === 0) return 0;
    return Math.floor(date.getTime() / DAY_MS) % length;
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
}

export const dailyPuzzle = new DailyPuzzleManager();
