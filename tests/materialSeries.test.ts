/**
 * Unit tests for js/analyze/materialSeries.ts — material-balance series.
 */
import { describe, it, expect } from 'vitest';
import { computeMaterialSeries } from '../js/analyze/materialSeries.js';
import type { MoveHistoryEntry, Piece } from '../js/gameEngine.js';

function piece(type: string, color: 'white' | 'black'): Piece {
  return { type, color, hasMoved: true } as Piece;
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

describe('computeMaterialSeries', () => {
  it('starts at the initial material for an empty history', () => {
    const s = computeMaterialSeries([], 0, 0);
    expect(s.points).toHaveLength(1);
    expect(s.points[0].diff).toBe(0);
    expect(s.finalDiff).toBe(0);
  });

  it('subtracts a captured piece from the captured side', () => {
    // White captures a black rook (value 500) on move 1.
    const s = computeMaterialSeries(
      [move(8, 4, 4, 4, { captured: piece('r', 'black') })],
      0,
      0
    );
    expect(s.points[1].blackMaterial).toBe(-500);
    expect(s.points[1].diff).toBe(500); // white is up 500
    expect(s.finalDiff).toBe(500);
    expect(s.bestWhiteMove).toBe(1);
  });

  it('handles a queen capture (value 900)', () => {
    const s = computeMaterialSeries(
      [move(8, 4, 4, 4, { captured: piece('q', 'white') })],
      0,
      0
    );
    expect(s.points[1].whiteMaterial).toBe(-900);
    expect(s.points[1].diff).toBe(-900);
    expect(s.bestBlackMove).toBe(1);
  });

  it('handles promotion (pawn -> stronger piece raises own material)', () => {
    // White pawn promotes to queen (delta = 900 - 100 = 800).
    const s = computeMaterialSeries(
      [move(1, 4, 0, 4, { promotion: 'q', piece: piece('p', 'white') })],
      0,
      0
    );
    expect(s.points[1].whiteMaterial).toBe(800);
    expect(s.points[1].diff).toBe(800);
  });

  it('tracks a capture sequence across multiple moves', () => {
    const s = computeMaterialSeries(
      [
        move(8, 4, 4, 4, { captured: piece('n', 'black') }), // white +320
        move(4, 4, 0, 4, { captured: piece('b', 'white') }), // black captures white bishop +330
      ],
      0,
      0
    );
    expect(s.points[1].diff).toBe(320); // after move 1
    expect(s.points[2].diff).toBe(320 - 330); // after move 2: -10
    expect(s.finalDiff).toBe(-10);
  });

  it('ignores castling (no material change)', () => {
    const s = computeMaterialSeries(
      [move(8, 4, 8, 6, { isCastling: true })],
      0,
      0
    );
    expect(s.points[1].diff).toBe(0);
  });
});
