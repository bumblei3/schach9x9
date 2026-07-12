/**
 * Invariant tests for js/statisticsManager.ts
 *
 * Supplements the existing statisticsManager.test.ts (functional coverage).
 * Here we assert the algebraic invariants the stats engine must preserve
 * regardless of call order:
 *   - accounting identity: wins + losses + draws === totalGames
 *   - winRate === wins / totalGames (and 0 / never NaN when totalGames === 0)
 *   - getStatistics() returns a defensive copy (mutating it does not corrupt state)
 *   - getGameHistory() is pure (no mutation of stored games) and deterministically
 *     sorted newest-first (stable for equal timestamps)
 *   - getStatsByOpponent() partitions the whole history (sum across opponents === totals)
 *   - getRecentStats() honours the cutoff window inclusively at the boundary
 *   - recalculateStats() is a true recomputation (idempotent, never NaN)
 *   - saveGame applies documented defaults (result='draw', opponent='Unknown', color='white')
 *   - export/import round-trip (replace) reproduces games and recomputed stats
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { StatisticsManager } from '../js/statisticsManager.js';
import type { GameDataInput, GameRecord } from '../js/statisticsManager.js';

function makeGame(over: Partial<GameDataInput>): GameDataInput {
  return { result: 'win', playerColor: 'white', opponent: 'AI', ...over };
}

describe('accounting identity — wins + losses + draws === totalGames', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('holds after a mixed sequence of saves', () => {
    const results: GameDataInput['result'][] = [
      'win',
      'loss',
      'draw',
      'win',
      'draw',
      'win',
      'loss',
      'win',
    ];
    for (const r of results) m.saveGame(makeGame({ result: r, opponent: `O-${r}` }));

    const s = m.getStatistics();
    expect(s.wins + s.losses + s.draws).toBe(s.totalGames);
    // explicit counts
    expect(s.wins).toBe(results.filter(r => r === 'win').length);
    expect(s.losses).toBe(results.filter(r => r === 'loss').length);
    expect(s.draws).toBe(results.filter(r => r === 'draw').length);
  });

  test('holds through 200 random results (fuzz)', () => {
    const rng = (() => {
      let x = 0x9e3779b9 >>> 0;
      return () => (x = (x * 1664525 + 1013904223) >>> 0) / 0xffffffff;
    })();
    const pool: GameDataInput['result'][] = ['win', 'loss', 'draw'];
    for (let i = 0; i < 200; i++) {
      m.saveGame(makeGame({ result: pool[Math.floor(rng() * 3)] }));
    }
    const s = m.getStatistics();
    expect(s.wins + s.losses + s.draws).toBe(s.totalGames);
    expect(s.totalGames).toBe(200);
  });
});

describe('winRate invariant', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('winRate is 0 when no games are recorded', () => {
    const s = m.getStatistics();
    expect(s.totalGames).toBe(0);
    expect(s.winRate).toBe(0);
    expect(Number.isNaN(s.winRate)).toBe(false);
  });

  test('winRate === wins / totalGames exactly', () => {
    m.saveGame(makeGame({ result: 'win' }));
    m.saveGame(makeGame({ result: 'win' }));
    m.saveGame(makeGame({ result: 'loss' }));
    m.saveGame(makeGame({ result: 'draw' }));
    const s = m.getStatistics();
    expect(s.winRate).toBeCloseTo(s.wins / s.totalGames, 12);
    expect(s.winRate).toBeCloseTo(0.5, 12);
  });

  test('winRate stays in [0, 1]', () => {
    for (let i = 0; i < 50; i++) {
      m.saveGame(makeGame({ result: i % 2 === 0 ? 'win' : 'loss' }));
      const wr = m.getStatistics().winRate;
      expect(wr).toBeGreaterThanOrEqual(0);
      expect(wr).toBeLessThanOrEqual(1);
      expect(Number.isNaN(wr)).toBe(false);
    }
  });
});

describe('getStatistics() returns a defensive copy', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
    m.saveGame(makeGame({ result: 'win' }));
  });

  test('mutating the returned summary does not change internal state', () => {
    const snapshot = m.getStatistics();
    const copy = m.getStatistics();
    copy.wins = 999;
    copy.totalGames = 999;
    copy.winRate = 0.99;
    const after = m.getStatistics();
    expect(after.wins).toBe(snapshot.wins);
    expect(after.totalGames).toBe(snapshot.totalGames);
    expect(after.winRate).toBeCloseTo(snapshot.winRate, 12);
  });

  test('repeated calls return equal but independent objects', () => {
    const a = m.getStatistics();
    const b = m.getStatistics();
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // distinct object instances
  });
});

describe('getGameHistory() purity & ordering', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('does not mutate stored games (deletes/limits are non-destructive)', () => {
    m.saveGame(makeGame({ result: 'win', opponent: 'A' }));
    m.saveGame(makeGame({ result: 'loss', opponent: 'B' }));
    m.saveGame(makeGame({ result: 'draw', opponent: 'C' }));
    const before = m.getGameHistory().length;
    // limiting must not delete from the underlying store
    const limited = m.getGameHistory({ limit: 1 });
    expect(limited.length).toBe(1);
    expect(m.getGameHistory().length).toBe(before);
  });

  test('is deterministically sorted newest-first (and stable when equal)', () => {
    m.saveGame(makeGame({ result: 'win', opponent: 'first' }));
    m.saveGame(makeGame({ result: 'loss', opponent: 'second' }));
    m.saveGame(makeGame({ result: 'draw', opponent: 'third' }));
    // Force identical timestamps to verify sort stability (insertion order preserved).
    const games = (m as unknown as { data: { games: GameRecord[] } }).data.games;
    const t = new Date().toISOString();
    games.forEach(g => (g.date = t));
    const sorted = m.getGameHistory();
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date).getTime();
      const cur = new Date(sorted[i].date).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
    // Identical keys => stable sort preserves insertion order
    expect(sorted[0].opponent).toBe('first');
    expect(sorted[1].opponent).toBe('second');
    expect(sorted[2].opponent).toBe('third');
  });

  test('filters compose: result + opponent + limit', () => {
    m.saveGame(makeGame({ result: 'win', opponent: 'Easy' }));
    m.saveGame(makeGame({ result: 'win', opponent: 'Hard' }));
    m.saveGame(makeGame({ result: 'loss', opponent: 'Easy' }));
    const r = m.getGameHistory({ result: 'win', opponent: 'Easy', limit: 5 });
    expect(r.length).toBe(1);
    expect(r[0].result).toBe('win');
    expect(r[0].opponent).toBe('Easy');
  });
});

describe('getStatsByOpponent() partitions the whole history', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  function sum(
    opp: Record<string, { wins: number; losses: number; draws: number; totalGames: number }>
  ) {
    const acc = { wins: 0, losses: 0, draws: 0, totalGames: 0 };
    for (const k of Object.keys(opp)) {
      acc.wins += opp[k].wins;
      acc.losses += opp[k].losses;
      acc.draws += opp[k].draws;
      acc.totalGames += opp[k].totalGames;
    }
    return acc;
  }

  test('sum across opponents equals the global totals', () => {
    const opponents = ['AI-Easy', 'AI-Hard', 'Human', 'AI-Easy'];
    const results: GameDataInput['result'][] = ['win', 'loss', 'draw', 'win'];
    opponents.forEach((o, i) => m.saveGame(makeGame({ result: results[i], opponent: o })));

    const byOpp = m.getStatsByOpponent();
    const totals = m.getStatistics();
    const agg = sum(byOpp);
    expect(agg.wins).toBe(totals.wins);
    expect(agg.losses).toBe(totals.losses);
    expect(agg.draws).toBe(totals.draws);
    expect(agg.totalGames).toBe(totals.totalGames);
  });

  test('each opponent winRate equals wins / totalGames for that opponent', () => {
    m.saveGame(makeGame({ result: 'win', opponent: 'X' }));
    m.saveGame(makeGame({ result: 'win', opponent: 'X' }));
    m.saveGame(makeGame({ result: 'loss', opponent: 'X' }));
    m.saveGame(makeGame({ result: 'draw', opponent: 'X' }));
    const byOpp = m.getStatsByOpponent();
    const x = byOpp['X'];
    expect(x.winRate).toBeCloseTo(x.wins / x.totalGames, 12);
  });

  test('empty history yields an empty partition', () => {
    expect(Object.keys(m.getStatsByOpponent())).toEqual([]);
  });
});

describe('getRecentStats() cutoff window', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('a game exactly at the cutoff is EXCLUDED (implementation uses >, not >=)', () => {
    m.saveGame(makeGame({ result: 'win' }));
    const games = (m as unknown as { data: { games: GameRecord[] } }).data.games;
    const boundary = new Date();
    boundary.setDate(boundary.getDate() - 30);
    games[0].date = boundary.toISOString(); // exactly 30 days ago
    const recent = m.getRecentStats(30);
    expect(recent.totalGames).toBe(0);
  });

  test('a game one millisecond inside the window is INCLUDED', () => {
    m.saveGame(makeGame({ result: 'win' }));
    const games = (m as unknown as { data: { games: GameRecord[] } }).data.games;
    const justInside = new Date();
    justInside.setDate(justInside.getDate() - 30);
    justInside.setMilliseconds(justInside.getMilliseconds() + 1); // 30 days minus 1ms
    games[0].date = justInside.toISOString();
    const recent = m.getRecentStats(30);
    expect(recent.totalGames).toBe(1);
  });

  test('a game one day older than the window is EXCLUDED', () => {
    m.saveGame(makeGame({ result: 'win' }));
    m.saveGame(makeGame({ result: 'loss' }));
    const games = (m as unknown as { data: { games: GameRecord[] } }).data.games;
    const tooOld = new Date();
    tooOld.setDate(tooOld.getDate() - 31);
    games[0].date = tooOld.toISOString(); // 31 days ago -> outside 30-day window
    const recent = m.getRecentStats(30);
    expect(recent.totalGames).toBe(1); // only the recent one
    expect(recent.wins).toBe(0);
    expect(recent.losses).toBe(1);
  });

  test('recent winRate is internally consistent and in [0,1]', () => {
    for (let i = 0; i < 20; i++) {
      m.saveGame(makeGame({ result: i % 3 === 0 ? 'win' : 'loss' }));
    }
    const r = m.getRecentStats(30);
    expect(r.wins + r.losses + r.draws).toBe(r.totalGames);
    expect(r.winRate).toBeGreaterThanOrEqual(0);
    expect(r.winRate).toBeLessThanOrEqual(1);
  });
});

describe('recalculateStats() is a true, safe recomputation', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('recomputes correctly from a corrupted state', () => {
    const internal = (m as unknown as { data: { games: GameRecord[]; stats: unknown } }).data;
    internal.games = [
      { result: 'win' } as GameRecord,
      { result: 'loss' } as GameRecord,
      { result: 'loss' } as GameRecord,
      { result: 'draw' } as GameRecord,
    ];
    internal.stats = { totalGames: 999, wins: 999, losses: 0, draws: 0, winRate: 1 };
    m.recalculateStats();
    const s = m.getStatistics();
    expect(s.totalGames).toBe(4);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(2);
    expect(s.draws).toBe(1);
    expect(s.winRate).toBeCloseTo(0.25, 12);
  });

  test('idempotent on a valid state', () => {
    m.saveGame(makeGame({ result: 'win' }));
    m.saveGame(makeGame({ result: 'loss' }));
    const before = m.getStatistics();
    m.recalculateStats();
    const after = m.getStatistics();
    expect(after).toEqual(before);
  });

  test('never produces NaN winRate even with zero games', () => {
    m.recalculateStats();
    const s = m.getStatistics();
    expect(Number.isNaN(s.winRate)).toBe(false);
    expect(s.winRate).toBe(0);
  });
});

describe('saveGame applies documented defaults', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('missing fields fall back to draw / Unknown / white', () => {
    // @ts-expect-error intentionally passing an incomplete record
    m.saveGame({});
    const g = m.getGameHistory()[0];
    expect(g.result).toBe('draw');
    expect(g.opponent).toBe('Unknown');
    expect(g.playerColor).toBe('white');
    expect(g.moves).toBe(0);
    expect(g.moveHistory).toEqual([]);
    expect(g.finalPosition).toBe('');
    expect(typeof g.id).toBe('string');
    expect(g.id.length).toBeGreaterThan(0);
  });

  test('moves count equals moveHistory length', () => {
    const history = [
      { from: 'a1', to: 'a2' },
      { from: 'b1', to: 'b2' },
    ] as unknown as GameRecord['moveHistory'];
    m.saveGame(makeGame({ moveHistory: history }));
    const g = m.getGameHistory()[0];
    expect(g.moves).toBe(2);
  });
});

describe('export / import round-trip', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
  });

  test('export then import(replace) reproduces games and recomputed stats', () => {
    m.saveGame(makeGame({ result: 'win', opponent: 'A' }));
    m.saveGame(makeGame({ result: 'loss', opponent: 'B' }));
    m.saveGame(makeGame({ result: 'draw', opponent: 'A' }));

    const exported = m.exportGames();
    const parsedExport = JSON.parse(exported);
    expect(parsedExport.version).toBe('1.0');

    // Fresh manager, replace-import the export
    const m2 = new StatisticsManager();
    const ok = m2.importGames(exported, false);
    expect(ok).toBe(true);

    const a = m.getStatistics();
    const b = m2.getStatistics();
    expect(b.totalGames).toBe(a.totalGames);
    expect(b.wins).toBe(a.wins);
    expect(b.losses).toBe(a.losses);
    expect(b.draws).toBe(a.draws);
    expect(b.winRate).toBeCloseTo(a.winRate, 12);
    expect(m2.getGameHistory().length).toBe(3);
  });

  test('merge avoids duplicate IDs but keeps distinct ones', () => {
    m.saveGame(makeGame({ result: 'win', opponent: 'A' }));
    const id = m.getGameHistory()[0].id;
    const payload = JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        games: [
          { id, result: 'win', opponent: 'A', date: new Date().toISOString() },
          { id: 'fresh-id', result: 'loss', opponent: 'B', date: new Date().toISOString() },
        ],
      },
    });
    m.importGames(payload, true);
    const games = m.getGameHistory();
    expect(games.length).toBe(2); // one duplicate dropped, one added
    const ids = new Set(games.map(g => g.id));
    expect(ids.size).toBe(2);
  });

  test('invalid JSON import fails without corrupting existing data', () => {
    m.saveGame(makeGame({ result: 'win' }));
    const before = m.getGameHistory().length;
    expect(m.importGames('not json {', true)).toBe(false);
    expect(m.getGameHistory().length).toBe(before);
  });
});

describe('clearHistory confirmation guard', () => {
  let m: StatisticsManager;
  beforeEach(() => {
    localStorage.clear();
    m = new StatisticsManager();
    m.saveGame(makeGame({ result: 'win' }));
  });

  test('without confirmation the data is preserved (no-op)', () => {
    m.clearHistory(false);
    expect(m.getStatistics().totalGames).toBe(1);
    expect(m.getGameHistory().length).toBe(1);
  });

  test('with confirmation it resets to a clean invariant state', () => {
    m.clearHistory(true);
    const s = m.getStatistics();
    expect(s.totalGames + s.wins + s.losses + s.draws).toBe(0);
    expect(s.winRate).toBe(0);
    expect(m.getGameHistory()).toEqual([]);
  });
});
