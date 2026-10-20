import { describe, expect, test } from 'vitest';
import { PIECE_TYPE_CODE, pieceToCode } from '../js/pieceCodes.js';

const LETTERS = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e', 'j'] as const;

describe('PIECE_TYPE_CODE', () => {
  test('covers the standard six plus the four fairy pieces', () => {
    expect(Object.keys(PIECE_TYPE_CODE).sort()).toEqual([...LETTERS].sort());
  });

  test('assigns the documented codes', () => {
    expect(PIECE_TYPE_CODE).toEqual({
      p: 1,
      n: 2,
      b: 3,
      r: 4,
      q: 5,
      k: 6,
      a: 7,
      c: 8,
      e: 9,
      j: 10,
    });
  });
});

describe('pieceToCode', () => {
  test('returns 0 for an empty square', () => {
    expect(pieceToCode(null)).toBe(0);
  });

  test('returns the unsigned code for white pieces', () => {
    for (const letter of LETTERS) {
      expect(pieceToCode({ type: letter, color: 'white', hasMoved: false })).toBe(
        PIECE_TYPE_CODE[letter]
      );
    }
  });

  test('negates the code for black pieces', () => {
    for (const letter of LETTERS) {
      expect(pieceToCode({ type: letter, color: 'black', hasMoved: false })).toBe(
        -PIECE_TYPE_CODE[letter]
      );
    }
  });

  test('returns 0 for an unknown piece type', () => {
    expect(pieceToCode({ type: 'x' as never, color: 'white', hasMoved: false })).toBe(0);
  });
});
