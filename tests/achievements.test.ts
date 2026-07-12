import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the dependencies used by AchievementsManager
const statistics = {
  getStatistics: vi.fn(() => ({ wins: 0, losses: 0, draws: 0, currentStreak: 0, bestStreak: 0 })),
};
vi.mock('../js/statisticsManager.js', () => ({
  statisticsManager: statistics,
}));

const showToast = vi.fn();
vi.mock('../js/ui/OverlayManager.js', () => ({
  showToast,
}));

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
};
vi.mock('../js/logger.js', () => ({ logger }));

const { AchievementsManager } = await import('../js/achievements');

// Provide a fresh localStorage for each test
function freshStorage() {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

describe('AchievementsManager', () => {
  let mgr: any;

  beforeEach(() => {
    freshStorage();
    statistics.getStatistics.mockReturnValue({
      wins: 0,
      losses: 0,
      draws: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
    showToast.mockClear();
    logger.info.mockClear();
    logger.error.mockClear();
    mgr = new AchievementsManager();
  });

  test('initializes default achievements when storage empty', () => {
    const all = mgr.getAll();
    expect(all.length).toBe(6);
    expect(all.map((a: any) => a.id)).toEqual([
      'first_win',
      'win_streak_5',
      'ten_wins',
      'checkmate_in_5',
      'promote_pawn',
      'win_with_king_only',
    ]);
    expect(all.every((a: any) => a.unlocked === false)).toBe(true);
  });

  test('persists default achievements to localStorage on init', () => {
    const raw = (globalThis as any).localStorage.getItem('schach9x9_achievements');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.length).toBe(6);
  });

  // --- load() branches ---
  test('load parses stored achievements array', () => {
    (globalThis as any).localStorage.setItem(
      'schach9x9_achievements',
      JSON.stringify([{ id: 'first_win', name: 'X', description: 'd', unlocked: true }])
    );
    const m = new AchievementsManager();
    expect(m.getAll().length).toBe(1);
    expect(m.isUnlocked('first_win')).toBe(true);
  });

  test('load falls back to empty when stored value is not an array', () => {
    (globalThis as any).localStorage.setItem(
      'schach9x9_achievements',
      JSON.stringify({ foo: 'bar' })
    );
    const m = new AchievementsManager();
    // empty -> defaults initialized
    expect(m.getAll().length).toBe(6);
  });

  test('load handles JSON parse error gracefully', () => {
    (globalThis as any).localStorage.setItem('schach9x9_achievements', '{not valid json');
    const m = new AchievementsManager();
    expect(logger.error).toHaveBeenCalled();
    expect(m.getAll().length).toBe(6); // defaults
  });

  test('load handles missing storage key', () => {
    (globalThis as any).localStorage.removeItem('schach9x9_achievements');
    const m = new AchievementsManager();
    expect(m.getAll().length).toBe(6);
  });

  // --- save() branch ---
  test('save handles storage write error gracefully', () => {
    mgr.unlock('first_win');
    // now make setItem throw
    (globalThis as any).localStorage.setItem = () => {
      throw new Error('quota');
    };
    // trigger a save via checkAndUnlock
    mgr.checkAndUnlock('win', 10, false, false);
    expect(logger.error).toHaveBeenCalled();
  });

  // --- isUnlocked / getAll ---
  test('isUnlocked returns false for unknown id', () => {
    expect(mgr.isUnlocked('nope')).toBe(false);
  });

  // --- unlock() branches ---
  test('unlock marks achievement and shows toast', () => {
    const ok = mgr.unlock('first_win');
    expect(ok).toBe(true);
    expect(mgr.isUnlocked('first_win')).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Erfolg freigeschaltet: Erster Sieg', 'success');
    expect(logger.info).toHaveBeenCalled();
  });

  test('unlock returns false when already unlocked (idempotent)', () => {
    mgr.unlock('first_win');
    showToast.mockClear();
    const ok = mgr.unlock('first_win');
    expect(ok).toBe(false);
    expect(showToast).not.toHaveBeenCalled();
  });

  test('unlock returns false for unknown id', () => {
    expect(mgr.unlock('ghost')).toBe(false);
  });

  // --- checkAndUnlock() branches ---
  test('win unlocks first_win and ten_wins when reaching target', () => {
    statistics.getStatistics.mockReturnValue({
      wins: 10,
      losses: 0,
      draws: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
    mgr.checkAndUnlock('win', 10, false, false);
    expect(mgr.isUnlocked('first_win')).toBe(true);
    expect(mgr.isUnlocked('ten_wins')).toBe(true);
  });

  test('win below ten_wins target only updates progress', () => {
    statistics.getStatistics.mockReturnValue({
      wins: 3,
      losses: 0,
      draws: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
    mgr.checkAndUnlock('win', 10, false, false);
    expect(mgr.isUnlocked('ten_wins')).toBe(false);
    const ten = mgr.getAll().find((a: any) => a.id === 'ten_wins');
    expect(ten.progress).toBe(3);
  });

  test('loss does not unlock first_win', () => {
    mgr.checkAndUnlock('loss', 10, false, false);
    expect(mgr.isUnlocked('first_win')).toBe(false);
  });

  test('draw does not unlock first_win', () => {
    mgr.checkAndUnlock('draw', 10, false, false);
    expect(mgr.isUnlocked('first_win')).toBe(false);
  });

  test('win within 5 moves unlocks checkmate_in_5', () => {
    statistics.getStatistics.mockReturnValue({
      wins: 1,
      losses: 0,
      draws: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
    mgr.checkAndUnlock('win', 5, false, false);
    expect(mgr.isUnlocked('checkmate_in_5')).toBe(true);
  });

  test('win with more than 5 moves does not unlock checkmate_in_5', () => {
    statistics.getStatistics.mockReturnValue({
      wins: 1,
      losses: 0,
      draws: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
    mgr.checkAndUnlock('win', 12, false, false);
    expect(mgr.isUnlocked('checkmate_in_5')).toBe(false);
  });

  test('loss with <=5 moves does not unlock checkmate_in_5', () => {
    mgr.checkAndUnlock('loss', 3, false, false);
    expect(mgr.isUnlocked('checkmate_in_5')).toBe(false);
  });

  test('hasPromotion unlocks promote_pawn', () => {
    mgr.checkAndUnlock('win', 20, true, false);
    expect(mgr.isUnlocked('promote_pawn')).toBe(true);
  });

  test('no promotion does not unlock promote_pawn', () => {
    mgr.checkAndUnlock('win', 20, false, false);
    expect(mgr.isUnlocked('promote_pawn')).toBe(false);
  });

  test('kingOnlyWin unlocks win_with_king_only', () => {
    mgr.checkAndUnlock('win', 20, false, true);
    expect(mgr.isUnlocked('win_with_king_only')).toBe(true);
  });

  test('not kingOnly does not unlock win_with_king_only', () => {
    mgr.checkAndUnlock('win', 20, false, false);
    expect(mgr.isUnlocked('win_with_king_only')).toBe(false);
  });

  test('checkAndUnlock persists via save', () => {
    const before = (globalThis as any).localStorage.getItem('schach9x9_achievements');
    mgr.checkAndUnlock('win', 10, false, false);
    const after = (globalThis as any).localStorage.getItem('schach9x9_achievements');
    expect(after).not.toBe(before);
    expect(JSON.parse(after).find((a: any) => a.id === 'first_win').unlocked).toBe(true);
  });
});
