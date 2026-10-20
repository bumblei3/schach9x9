/**
 * Piece type -> internal board code, shared by the engine worker and the
 * match harness.
 *
 * This mapping used to exist twice: once private in `engineNode.ts` and once as
 * a comment-labelled "mirror" in `matchRefs.ts`. Two copies drift — and a
 * drifted code mapping silently corrupts every position the harness feeds to
 * the engines, i.e. every strength number derived from them.
 *
 * Codes are signed: positive = white, negative = black, 0 = empty. The 9x9 set
 * extends the standard six with the fairy pieces (a=archbishop, c=chancellor,
 * e=angel, j=nightrider).
 */

import type { Piece } from './types/game.js';

/** Piece letter -> unsigned code. */
export const PIECE_TYPE_CODE: Record<string, number> = {
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
};

/** Map a piece to its signed internal code. `null`/unknown -> 0. */
export function pieceToCode(p: Piece | null): number {
  if (!p) return 0;
  const base = PIECE_TYPE_CODE[p.type] ?? 0;
  return p.color === 'white' ? base : -base;
}
