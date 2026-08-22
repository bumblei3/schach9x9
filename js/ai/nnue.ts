/**
 * nnue.ts — NNUE inference for the 9×9 engine (JS side).
 *
 * Loads weights exported by tools/nnue-train.py (npz → converted to .json)
 * and runs the forward pass: input 81×14 one-hot piece-square plane
 * (mover perspective, board flipped for black) → 256 ReLU → 32 ReLU → sigmoid.
 *
 * The eval is blended: final = w_nnue*nnueCp + (1-w_nnue)*pstScore.
 * w_nnue=0 keeps pure PST behavior (default until the selfmatch gate passes).
 */

import { readFileSync } from 'node:fs';

export interface NnueWeights {
  w0: Float32Array; // (1134, hidden0) flattened
  b0: Float32Array;
  w1: Float32Array;
  b1: Float32Array;
  w2: Float32Array;
  b2: Float32Array;
  shape: number[]; // [in, h0, h1, 1]
}

const N_TYPES = 7;
const PLANES = 14; // 7 black types + 7 white types
const SQ = 81;

let cached: NnueWeights | null = null;

/** Load weights from a JSON file produced by tools/nnue-export-weights.py. */
export function loadNnueWeights(path: string): NnueWeights {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const arr = (a: number[] | Float32Array) => Float32Array.from(a);
  cached = {
    w0: arr(raw.w0), b0: arr(raw.b0),
    w1: arr(raw.w1), b1: arr(raw.b1),
    w2: arr(raw.w2), b2: arr(raw.b2),
    shape: raw.shape,
  };
  return cached;
}

/** Encode board to mover-perspective input vector (length SQ*PLANES). */
export function encodeBoard(b: Int8Array, whiteToMove: boolean): Float32Array {
  const x = new Float32Array(SQ * PLANES);
  const PIECE_INDEX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };
  for (let sq = 0; sq < SQ; sq++) {
    const p = b[sq];
    if (p === 0) continue;
    const t = PIECE_INDEX[p & 15];
    const isWhite = ((p >> 4) & 1) === 0; // COLOR_WHITE=16 → bit4=0
    const ch = isWhite ? t : t + N_TYPES;
    const viewSq = whiteToMove ? sq : 80 - sq;
    x[viewSq * PLANES + ch] = 1.0;
  }
  return x;
}

/** Forward pass → probability in [0,1] that the mover wins. */
export function nnueEvalProb(x: Float32Array, w: NnueWeights): number {
  const [inDim, h0, h1] = w.shape;
  // layer 0
  const a0 = new Float32Array(h0);
  for (let j = 0; j < h0; j++) {
    let s = w.b0[j];
    for (let i = 0; i < inDim; i++) s += x[i] * w.w0[i * h0 + j];
    a0[j] = s > 0 ? s : 0;
  }
  // layer 1
  const a1 = new Float32Array(h1);
  for (let j = 0; j < h1; j++) {
    let s = w.b1[j];
    for (let i = 0; i < h0; i++) s += a0[i] * w.w1[i * h1 + j];
    a1[j] = s > 0 ? s : 0;
  }
  // output (sigmoid)
  let o = w.b2[0];
  for (let i = 0; i < h1; i++) o += a1[i] * w.w2[i];
  return 1 / (1 + Math.exp(-o));
}

/** Convert win probability to centipawn-ish score via logistic inverse, scaled. */
export function probToCp(p: number): number {
  const clamped = Math.min(0.999, Math.max(0.001, p));
  return Math.round((Math.log10(clamped / (1 - clamped))) * 400);
}
