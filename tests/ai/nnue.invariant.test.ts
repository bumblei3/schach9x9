import { describe, it, expect } from 'vitest';
import {
  encodeBoard,
  nnueEvalProb,
  probToCp,
  loadNnueWeights,
  type NnueWeights,
} from '../../js/ai/nnue.js';
import { COLOR_WHITE, COLOR_BLACK, PIECE_PAWN, PIECE_KING } from '../../js/ai/BoardDefinitions.js';

// ============================================================================
// Invariant suite for js/ai/nnue.ts — pure inference helpers.
// The NNUE blend is default-off (w=0), but the inference code must stay
// correct: encoding is the mover-perspective one-hot contract, the forward
// pass must reproduce hand-computed values on tiny synthetic weights, and
// probToCp must clamp + be monotonic.
// ============================================================================

const SQ = 81;
const PLANES = 14;

function emptyBoard(): Int8Array {
  return new Int8Array(SQ);
}

describe('encodeBoard', () => {
  it('returns a Float32Array of length 81*14', () => {
    const x = encodeBoard(emptyBoard(), true);
    expect(x).toBeInstanceOf(Float32Array);
    expect(x.length).toBe(SQ * PLANES);
  });

  it('encodes an empty board as all zeros', () => {
    expect(encodeBoard(emptyBoard(), true).every((v) => v === 0)).toBe(true);
  });

  // KNOWN QUIRK (documented, NOT asserted as "correct"): the colour-bit check
  // `((p >> 4) & 1) === 0` treats COLOR_WHITE|t (=16+t, bit4 SET) as black and
  // COLOR_BLACK|t (=32+t, bit4 CLEAR) as white — i.e. the two colour channels
  // are SWAPPED relative to their documented meaning. This is consistent with
  // the Python trainer (same check), so inference stays self-consistent and
  // the blend works; fixing it would silently invalidate trained weights and
  // needs its own gate, not a test-driven patch. The suite locks the ACTUAL
  // behaviour so any accidental change to the encoding contract is caught.

  it('places exactly one 1.0 entry for a single piece', () => {
    const b = emptyBoard();
    b[40] = COLOR_WHITE | PIECE_PAWN;
    const x = encodeBoard(b, true);
    let ones = 0;
    for (const v of x) if (v === 1.0) ones++;
    expect(ones).toBe(1);
  });

  it('routes colours into disjoint channels (white→type+7, black→type — SWAPPED, see quirk)', () => {
    const b = emptyBoard();
    b[10] = COLOR_WHITE | PIECE_PAWN;
    b[20] = COLOR_BLACK | PIECE_PAWN;
    const x = encodeBoard(b, true);
    expect(x[10 * PLANES + 7]).toBe(1.0); // white pawn lands in channel 7 (swapped)
    expect(x[20 * PLANES + 0]).toBe(1.0); // black pawn lands in channel 0 (swapped)
    expect(x[10 * PLANES + 0]).toBe(0);
    expect(x[20 * PLANES + 7]).toBe(0);
  });

  it('flips the view square for black-to-move (mover perspective)', () => {
    const b = emptyBoard();
    b[0] = COLOR_WHITE | PIECE_KING;
    const xw = encodeBoard(b, true);
    const xb = encodeBoard(b, false);
    // king channel is 5+7=12 under the swapped quirk; flip logic unchanged
    expect(xw[0 * PLANES + 12]).toBe(1.0); // viewSq 0
    expect(xb[80 * PLANES + 12]).toBe(1.0); // flipped: 80-0
    expect(xb[0 * PLANES + 12]).toBe(0);
  });

  it('is deterministic', () => {
    const b = emptyBoard();
    b[3] = COLOR_BLACK | PIECE_PAWN;
    b[70] = COLOR_WHITE | PIECE_KING;
    expect(Array.from(encodeBoard(b, true))).toEqual(Array.from(encodeBoard(b, true)));
  });
});

/** Tiny hand-checkable network: inDim=2, h0=2, h1=2. */
function tinyWeights(): NnueWeights {
  return {
    w0: new Float32Array([1, -1, 2, 0]), // (2,2): col j-major? flattened row-major [i*h0+j]
    b0: new Float32Array([0, 1]),
    w1: new Float32Array([1, 0, 0, 1]),
    b1: new Float32Array([0, 0]),
    b2: new Float32Array([0]),
    w2: new Float32Array([1, -1]),
    shape: [2, 2, 2],
  };
}

describe('nnueEvalProb', () => {
  it('computes the hand-derived value for a known input', () => {
    const w = tinyWeights();
    // x=[1,0]: h0j0 = b00 + x0*w000 + x1*w010 = 0+1*1+0*2 = 1 → relu 1
    //          h0j1 = b01 + x0*w001 + x1*w011 = 1+(-1)+0 = 0 → relu 0
    // h1: a1_0 = a0_0*w1_00 = 1; a1_1 = a0_1*w1_11 = 0
    // o = w2b(0) + 1*1 + 0*(-1) = 1 → sigmoid(1)
    const x = new Float32Array([1, 0]);
    expect(nnueEvalProb(x, w)).toBeCloseTo(1 / (1 + Math.exp(-1)), 6);
  });

  it('stays inside [0,1] even for extreme inputs (sigmoid saturates, never NaN)', () => {
    const w = tinyWeights();
    for (const v of [-100, -1, 0, 1, 100]) {
      const p = nnueEvalProb(new Float32Array([v, v]), w);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(Number.isNaN(p)).toBe(false);
    }
  });

  it('is monotone along an all-positive weight direction', () => {
    // w0 row drives everything positive: larger input → larger output
    const w: NnueWeights = {
      w0: new Float32Array([1, 1, 1, 1]),
      b0: new Float32Array([0, 0]),
      w1: new Float32Array([1, 1, 1, 1]),
      b1: new Float32Array([0, 0]),
      b2: new Float32Array([0]),
      w2: new Float32Array([1, 1]),
      shape: [2, 2, 2],
    };
    const lo = nnueEvalProb(new Float32Array([0, 0]), w);
    const hi = nnueEvalProb(new Float32Array([5, 5]), w);
    expect(hi).toBeGreaterThan(lo);
  });

  it('is deterministic for identical inputs', () => {
    const w = tinyWeights();
    const x = new Float32Array([0.5, -0.25]);
    expect(nnueEvalProb(x, w)).toBe(nnueEvalProb(Float32Array.from(x), w));
  });
});

describe('probToCp', () => {
  it('maps 0.5 to 0 (no advantage)', () => {
    expect(probToCp(0.5)).toBe(0);
  });

  it('clamps extreme probabilities instead of returning ±Infinity', () => {
    expect(Number.isFinite(probToCp(0.9999999))).toBe(true);
    expect(Number.isFinite(probToCp(0.0000001))).toBe(true);
  });

  it('is monotonically increasing in probability', () => {
    let prev = probToCp(0.001);
    for (let p = 0.01; p <= 0.999; p += 0.01) {
      const cp = probToCp(p);
      expect(cp).toBeGreaterThanOrEqual(prev);
      prev = cp;
    }
  });

  it('is antisymmetric around 0.5', () => {
    for (const d of [0.05, 0.1, 0.3]) {
      expect(probToCp(0.5 + d)).toBe(-probToCp(0.5 - d));
    }
  });
});

describe('loadNnueWeights', () => {
  it('caches: second call returns the identical object without reading again', async () => {
    // Write a minimal weights file to a temp path via the module's own contract.
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'nnue-test-'));
    const path = join(dir, 'w.json');
    writeFileSync(
      path,
      JSON.stringify({
        w0: Array.from({ length: 4 }, (_, i) => i),
        b0: [0, 0],
        w1: [1, 0, 0, 1],
        b1: [0, 0],
        b2: [0],
        w2: [1, -1],
        shape: [2, 2, 2],
      }),
    );
    const first = loadNnueWeights(path);
    const second = loadNnueWeights(path);
    expect(second).toBe(first); // cached identity — no re-read
    expect(first.w0).toBeInstanceOf(Float32Array);
    expect(first.shape).toEqual([2, 2, 2]);
  });
});
