import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { LeaderboardManager } from '../js/leaderboard.js';

describe('LeaderboardManager', () => {
  let manager: LeaderboardManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new LeaderboardManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('constructor loads empty when no stored data', () => {
    expect(manager.getAll()).toEqual([]);
  });

  test('add stores a win entry', () => {
    manager.add('win', 20, 'medium');
    const entries = manager.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].result).toBe('win');
    expect(entries[0].moveCount).toBe(20);
    expect(entries[0].difficulty).toBe('medium');
    expect(entries[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('add sorts wins before draws before losses', () => {
    manager.add('loss', 10, 'easy');
    manager.add('draw', 15, 'easy');
    manager.add('win', 25, 'easy');
    const entries = manager.getAll();
    expect(entries[0].result).toBe('win');
    expect(entries[1].result).toBe('draw');
    expect(entries[2].result).toBe('loss');
  });

  test('add sorts wins by move count (fewer first)', () => {
    manager.add('win', 30, 'easy');
    manager.add('win', 10, 'easy');
    manager.add('win', 20, 'easy');
    const entries = manager.getAll();
    expect(entries[0].moveCount).toBe(10);
    expect(entries[1].moveCount).toBe(20);
    expect(entries[2].moveCount).toBe(30);
  });

  test('add caps at 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      manager.add('win', i + 1, 'easy');
    }
    expect(manager.getAll()).toHaveLength(10);
  });

  test('getAll returns a copy', () => {
    manager.add('win', 5, 'easy');
    const a = manager.getAll();
    const b = manager.getAll();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  test('clear empties entries and storage', () => {
    manager.add('win', 5, 'easy');
    manager.clear();
    expect(manager.getAll()).toEqual([]);
    // reload
    const m2 = new LeaderboardManager();
    expect(m2.getAll()).toEqual([]);
  });

  test('load handles corrupt JSON gracefully', () => {
    localStorage.setItem('schach9x9_leaderboard', '{not json');
    const m = new LeaderboardManager();
    expect(m.getAll()).toEqual([]);
  });

  test('load restores persisted entries', () => {
    manager.add('win', 7, 'hard');
    const m2 = new LeaderboardManager();
    expect(m2.getAll()).toHaveLength(1);
    expect(m2.getAll()[0].moveCount).toBe(7);
  });
});
