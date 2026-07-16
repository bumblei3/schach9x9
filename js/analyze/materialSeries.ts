/**
 * Material-series analysis for the post-game material chart.
 *
 * Given a move history, reconstructs the material balance (white vs black,
 * in centi-pawns) after each move. Pure function — no DOM, fully testable.
 * Rendering lives in the UI layer (renderMaterialGraph).
 *
 * Material is tracked incrementally from the starting material: a capture
 * lowers the captured side's material by the captured piece's value; a
 * promotion raises the promoting side's material by (promotedValue - pawnValue).
 * Castling does not change material.
 */
import type { MoveHistoryEntry, Piece } from '../gameEngine.js';

/** Centipawn values per piece type (mirrors engine eval weights). */
const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0, // king has no material value for balance purposes
  a: 800, // archbishop
  c: 900, // chancellor
  e: 1200, // angel
  j: 1100, // nightrider
};

export interface MaterialPoint {
  /** index of the move that produced this state (0 = initial position) */
  moveIndex: number;
  whiteMaterial: number;
  blackMaterial: number;
  /** whiteMaterial - blackMaterial (centi-pawns) */
  diff: number;
}

export interface MaterialSeries {
  points: MaterialPoint[];
  /** final material advantage for white (centi-pawns) */
  finalDiff: number;
  /** the move index at which white's material lead was largest */
  bestWhiteMove: number;
  /** the move index at which black's material lead was largest */
  bestBlackMove: number;
}

function valueOf(piece: Piece | null | undefined): number {
  if (!piece) return 0;
  return PIECE_VALUE[piece.type] ?? 0;
}

/**
 * Build the material series from a move history.
 * `initialWhite` / `initialBlack` let the caller pass the starting material
 * (e.g. a custom variant); defaults to the standard 9x9 opening material.
 */
export function computeMaterialSeries(
  history: MoveHistoryEntry[],
  initialWhite = 0,
  initialBlack = 0
): MaterialSeries {
  let white = initialWhite;
  let black = initialBlack;

  const points: MaterialPoint[] = [
    { moveIndex: 0, whiteMaterial: white, blackMaterial: black, diff: white - black },
  ];

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    // Capture: the side that had a piece on `to` loses it.
    if (move.captured) {
      const capturedColor = move.captured.color;
      const v = valueOf(move.captured);
      if (capturedColor === 'white') white -= v;
      else black -= v;
    }
    // Promotion: own pawn becomes a stronger piece.
    if (move.promotion) {
      const promoType = move.promotion;
      const promoVal = PIECE_VALUE[promoType] ?? 0;
      const side = move.piece?.color;
      const delta = promoVal - PIECE_VALUE['p'];
      if (side === 'white') white += delta;
      else if (side === 'black') black += delta;
    }
    const diff = white - black;
    points.push({ moveIndex: i + 1, whiteMaterial: white, blackMaterial: black, diff });
  }

  const finalDiff = points[points.length - 1].diff;
  let bestWhiteMove = 0;
  let bestBlackMove = 0;
  let maxWhite = -Infinity;
  let minBlack = Infinity;
  for (const p of points) {
    if (p.diff > maxWhite) {
      maxWhite = p.diff;
      bestWhiteMove = p.moveIndex;
    }
    if (p.diff < minBlack) {
      minBlack = p.diff;
      bestBlackMove = p.moveIndex;
    }
  }

  return { points, finalDiff, bestWhiteMove, bestBlackMove };
}
