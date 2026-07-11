import { describe, expect, test } from 'vitest';
import { canPieceMove } from '../js/tutor/TacticsDetector.js';
// `canPieceMove(type, dr, dc)` is a pure, DOM-free predicate that
// encodes how each sliding/fairy piece may step along a ray
// (dr = row delta sign, dc = col delta sign). It is exercised by
// the discovered-attack / skewer / pin detectors but had no direct
// tests. We lock its movement geometry per piece type.

describe('TacticsDetector.canPieceMove — ray geometry', () => {
  test('rook / chancellor move orthogonally only', () => {
    // orthogonal step -> allowed
    expect(canPieceMove('r', 0, 1)).toBe(true);
    expect(canPieceMove('r', 1, 0)).toBe(true);
    expect(canPieceMove('c', 0, -1)).toBe(true);
    expect(canPieceMove('c', -1, 0)).toBe(true);
    // diagonal step -> rejected
    expect(canPieceMove('r', 1, 1)).toBe(false);
    expect(canPieceMove('c', 1, -1)).toBe(false);
    // no step at all -> rejected
    expect(canPieceMove('r', 0, 0)).toBe(false);
  });

  test('bishop / archbishop move diagonally only', () => {
    expect(canPieceMove('b', 1, 1)).toBe(true);
    expect(canPieceMove('b', 1, -1)).toBe(true);
    expect(canPieceMove('a', -1, 1)).toBe(true);
    expect(canPieceMove('a', -1, -1)).toBe(true);
    // orthogonal step -> rejected
    expect(canPieceMove('b', 1, 0)).toBe(false);
    expect(canPieceMove('a', 0, 1)).toBe(false);
    // no step -> rejected
    expect(canPieceMove('b', 0, 0)).toBe(false);
  });

  test('queen moves both orthogonally and diagonally', () => {
    expect(canPieceMove('q', 0, 1)).toBe(true);
    expect(canPieceMove('q', 1, 0)).toBe(true);
    expect(canPieceMove('q', 1, 1)).toBe(true);
    expect(canPieceMove('q', 1, -1)).toBe(true);
    expect(canPieceMove('q', 0, 0)).toBe(false);
  });

  test('non-sliding pieces (pawn, knight, king) can never move along a ray', () => {
    expect(canPieceMove('p', 1, 0)).toBe(false);
    expect(canPieceMove('n', 2, 1)).toBe(false);
    expect(canPieceMove('k', 1, 1)).toBe(false);
    expect(canPieceMove('z' as unknown as string, 1, 1)).toBe(false);
  });

  test('direction sign only matters, not magnitude', () => {
    // a far diagonal step still reports the same diagonal permission
    expect(canPieceMove('b', -5, -5)).toBe(true);
    expect(canPieceMove('r', 0, 3)).toBe(true);
    // mixed orthogonal+diagonal is never a single ray
    expect(canPieceMove('r', 2, 1)).toBe(false);
    expect(canPieceMove('b', 2, 0)).toBe(false);
  });
});
