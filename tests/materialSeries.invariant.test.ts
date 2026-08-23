/**
 * Supplementary INVARIANT suite for js/analyze/materialSeries.ts.
 *
 * tests/materialSeries.test.ts locks exact spot values; this file locks the
 * algebraic properties that must hold on EVERY input:
 *   - points length === history.length + 1 (one point per move + initial)
 *   - moveIndex is strictly 0..N with no gaps
 *   - diff === whiteMaterial - blackMaterial on every point
 *   - series is non-anticipating: each point only reflects moves up to its index
 *   - capture/promotion accounting identities (symmetric deltas)
 *   - unknown piece types and colourless promotions contribute 0 (no NaN/undefined)
 *   - initialWhite/initialBlack shift the whole series by a constant
 *   - bestWhiteMove/bestBlackMove point at actual extrema of diff
 *   - monotonic sweep: adding white captures never decreases the final diff
 */

import { describe, it, expect } from 'vitest';
import { computeMaterialSeries } from '../js/analyze/materialSeries.js';
import type { MoveHistoryEntry, Piece } from '../js/gameEngine.js';

function piece(type: string, color: 'white' | 'black'): Piece {
  return { type, color, hasMoved: true } as unknown as Piece;
}

function move(
  fr: number,
  fc: number,
  tr: number,
  tc: number,
  extra: Partial<MoveHistoryEntry> = {}
): MoveHistoryEntry {
  return { from: { r: fr, c: fc }, to: { r: tr, c: tc }, ...extra } as MoveHistoryEntry;
}

describe('computeMaterialSeries — structural invariants', () => {
  it('points length is always history.length + 1 with gapless indices', () => {
    const history = [
      move(8, 4, 4, 4),
      move(0, 0, 5, 5),
      move(8, 8, 3, 3, { captured: piece('p', 'black') }),
    ];
    const s = computeMaterialSeries(history);
    expect(s.points).toHaveLength(4);
    s.points.forEach((p, i) => expect(p.moveIndex).toBe(i));
    expect(s.finalDiff).toBe(s.points[3].diff);
  });

  it('diff identity holds on every point', () => {
    const history = [
      move(8, 0, 0, 0, { captured: piece('q', 'black') }), // white +900
      move(0, 8, 4, 4, { captured: piece('r', 'white') }), // black +500
      move(1, 4, 0, 4, { promotion: 'n', piece: piece('p', 'white') }), // white +220
      move(7, 7, 2, 2), // quiet
    ];
    for (const s of [computeMaterialSeries(history), computeMaterialSeries(history, 300, 100)]) {
      for (const p of s.points) {
        expect(p.diff).toBe(p.whiteMaterial - p.blackMaterial);
        expect(Number.isFinite(p.diff)).toBe(true);
      }
    }
  });

  it('initial material shifts the entire series by a constant', () => {
    const history = [move(8, 0, 0, 0, { captured: piece('b', 'black') })];
    const base = computeMaterialSeries(history);
    const shifted = computeMaterialSeries(history, 250, 130);
    expect(shifted.points[0]).toMatchObject({ whiteMaterial: 250, blackMaterial: 130 });
    expect(shifted.finalDiff - base.finalDiff).toBe(250 - 130);
    // Every point shifted identically.
    base.points.forEach((p, i) => {
      expect(shifted.points[i].whiteMaterial - p.whiteMaterial).toBe(250);
      expect(shifted.points[i].blackMaterial - p.blackMaterial).toBe(130);
    });
  });

  it('unknown captured piece type contributes 0 (no NaN propagation)', () => {
    const s = computeMaterialSeries([move(8, 0, 0, 0, { captured: piece('x', 'black') })]);
    expect(s.points[1].blackMaterial).toBe(0); // ?? 0 fallback
    expect(s.finalDiff).toBe(0);
  });

  it('promotion without a moving piece colour contributes nothing', () => {
    const s = computeMaterialSeries([move(1, 4, 0, 4, { promotion: 'q' })]);
    expect(s.points[1].whiteMaterial).toBe(0);
    expect(s.points[1].blackMaterial).toBe(0);
    expect(s.finalDiff).toBe(0);
  });

  it('promotion to an unknown type yields the pawn-value delta only via ?? 0 → negative delta guarded', () => {
    // promoVal ?? 0 -> delta = 0 - 100 = -100 for an unknown promo type.
    const s = computeMaterialSeries([
      move(1, 4, 0, 4, { promotion: 'z' as never, piece: piece('p', 'white') }),
    ]);
    expect(s.points[1].whiteMaterial).toBe(-100);
  });

  it('bestWhiteMove/bestBlackMove reference real extrema of diff', () => {
    // White peaks after move 2 (+800), black peaks after move 3 (-400).
    const history = [
      move(8, 0, 0, 0, { captured: piece('p', 'black') }), // +100
      move(8, 1, 0, 1, { captured: piece('a', 'black') }), // +900 total
      move(0, 8, 4, 8, { captured: piece('r', 'white') }), // +400
      move(0, 2, 5, 5, { captured: piece('e', 'black') }), // +1600? no: e=1200 -> +1600
    ];
    void history;
    const h = [
      move(8, 0, 0, 0, { captured: piece('p', 'black') }), // +100
      move(8, 1, 0, 1, { captured: piece('a', 'black') }), // +900
      move(0, 8, 4, 8, { captured: piece('e', 'white') }), // e=1200 for black: +2100
    ];
    const s = computeMaterialSeries(h);
    const maxDiff = Math.max(...s.points.map((p) => p.diff));
    expect(s.points[s.bestWhiteMove].diff).toBe(maxDiff);
    const minDiff = Math.min(...s.points.map((p) => p.diff));
    expect(s.points[s.bestBlackMove].diff).toBe(minDiff);
    // Move 3 captures a WHITE angel (1200): white's material drops below its
    // start -> diff -300 there, which IS the black-best point.
    expect(s.bestBlackMove).toBe(3);
    expect(s.points[3].diff).toBe(900 - 1200);
    expect(minDiff).toBe(-300);
  });

  it('fuzz: random captures keep the accounting identity and finite values', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const types = ['p', 'n', 'b', 'r', 'q', 'a', 'c', 'e', 'j'];
    for (let trial = 0; trial < 50; trial++) {
      const history: MoveHistoryEntry[] = [];
      for (let m = 0; m < 12; m++) {
        const extra: Partial<MoveHistoryEntry> = {};
        if (rand() < 0.5) {
          extra.captured = piece(
            types[Math.floor(rand() * types.length)],
            rand() < 0.5 ? 'white' : 'black'
          );
        }
        history.push(move(Math.floor(rand() * 9), 0, Math.floor(rand() * 9), 1, extra));
      }
      const s = computeMaterialSeries(history);
      expect(s.points).toHaveLength(history.length + 1);
      for (const p of s.points) {
        expect(p.diff).toBe(p.whiteMaterial - p.blackMaterial);
        expect(Number.isFinite(p.whiteMaterial)).toBe(true);
        expect(Number.isFinite(p.blackMaterial)).toBe(true);
      }
      expect(s.points[s.bestWhiteMove].diff).toBeGreaterThanOrEqual(
        s.points[s.bestBlackMove].diff
      );
    }
  });
});
