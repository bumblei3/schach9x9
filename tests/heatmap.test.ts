/**
 * Unit tests for js/analyze/heatmap.ts — the move-heatmap pure function.
 */
import { describe, it, expect } from 'vitest';
import { computeHeatmap, cellIntensity, BOARD_SIZE } from '../js/analyze/heatmap.js';
import type { MoveHistoryEntry } from '../js/gameEngine.js';

function move(
  fr: number,
  fc: number,
  tr: number,
  tc: number,
  extra: Partial<MoveHistoryEntry> = {}
): MoveHistoryEntry {
  return {
    from: { r: fr, c: fc },
    to: { r: tr, c: tc },
    ...extra,
  } as MoveHistoryEntry;
}

describe('computeHeatmap', () => {
  it('returns a 9x9 grid with all-zero cells for empty history', () => {
    const h = computeHeatmap([]);
    expect(h.grid.length).toBe(BOARD_SIZE);
    expect(h.grid[0].length).toBe(BOARD_SIZE);
    expect(h.totalMoves).toBe(0);
    expect(h.hottest).toBeNull();
    expect(h.maxCount).toBe(0);
  });

  it('counts from/to usage per square', () => {
    const h = computeHeatmap([
      move(8, 4, 6, 4), // pawn e2->e4 (1 from e2, 1 to e4)
      move(6, 4, 4, 4), // pawn e4->e6 (1 from e4, 1 to e6)
      move(8, 4, 6, 4), // pawn e2->e4 again (e2 from=2, e4 to=2)
    ]);
    expect(h.grid[8][4].from).toBe(2); // e2 used as source twice
    expect(h.grid[6][4].to).toBe(2); // e4 used as destination twice
    expect(h.grid[6][4].from).toBe(1); // e4 used as source once
    expect(h.grid[4][4].to).toBe(1); // e6 destination once
    expect(h.totalMoves).toBe(3);
  });

  it('identifies the hottest square (highest combined from+to)', () => {
    const h = computeHeatmap([
      move(8, 4, 6, 4),
      move(6, 4, 4, 4),
      move(4, 4, 2, 4),
      move(2, 4, 0, 4), // column e (c=4) heavily used
      move(0, 0, 1, 1), // one move elsewhere
    ]);
    // e2(r8,c4): from 1; e4(r6,c4): from1+to1=2; e6(r4,c4): from1+to1=2;
    // e8(r2,c4): from1+to1=2; e0(r0,c4): to1=1 -> max combined = 2 at several.
    expect(h.maxCount).toBeGreaterThanOrEqual(2);
    expect(h.hottest).not.toBeNull();
    expect(h.hottest!.count).toBe(h.maxCount);
  });

  it('ignores malformed moves without coordinates', () => {
    const bad = { from: undefined, to: undefined } as unknown as MoveHistoryEntry;
    const h = computeHeatmap([bad]);
    expect(h.totalMoves).toBe(1);
    expect(h.hottest).toBeNull();
    expect(h.maxCount).toBe(0);
  });
});

describe('cellIntensity', () => {
  it('is 0 for empty history (no divide-by-zero)', () => {
    expect(cellIntensity({ from: 0, to: 0 }, 0)).toBe(0);
  });
  it('scales linearly to the max count', () => {
    expect(cellIntensity({ from: 3, to: 1 }, 4)).toBeCloseTo(1);
    expect(cellIntensity({ from: 1, to: 1 }, 4)).toBeCloseTo(0.5);
  });
  it('never exceeds 1', () => {
    expect(cellIntensity({ from: 9, to: 9 }, 4)).toBe(1);
  });
});
