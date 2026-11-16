import { describe, expect, it } from 'vitest';
import { placePlundererPawn } from '../../js/campaign/plunderer.js';
import { placeSprungfederKnight } from '../../js/campaign/sprungfeder.js';
import type { Piece } from '../../js/types/core.js';

function emptyBoard(size = 9): (Piece | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

describe('placeSprungfederKnight', () => {
  it('puts the knight on the back rank, beside the king square', () => {
    const board = emptyBoard();
    expect(placeSprungfederKnight(board)).toBe(true);
    expect(board[8][4]).toMatchObject({ type: 'n', color: 'white', gifted: true });
  });

  it('leaves the Plünderer pawn where it is', () => {
    const board = emptyBoard();
    placePlundererPawn(board);
    placeSprungfederKnight(board);
    expect(board[7][4]).toMatchObject({ type: 'p', gifted: true });
    expect(board[8][4]).toMatchObject({ type: 'n', gifted: true });
  });

  it('steps aside when the center of the back rank is taken', () => {
    const board = emptyBoard();
    board[8][4] = { type: 'k', color: 'white' };
    expect(placeSprungfederKnight(board)).toBe(true);
    expect(board[8][3]).toMatchObject({ type: 'n', gifted: true });
  });

  it('returns false when White has no empty square', () => {
    const board = emptyBoard(1);
    board[0][0] = { type: 'k', color: 'white' };
    expect(placeSprungfederKnight(board)).toBe(false);
  });
});
