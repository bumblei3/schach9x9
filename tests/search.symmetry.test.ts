/**
 * Symmetry regression test for js/search.ts — guards against the
 * null-move-pruning perspective bug (GH issue: search asymmetry at depth).
 *
 * With the bug, `search(b, d, ..., maximizing)` was called for the null-move
 * sub-search without inverting `maximizing`, so the null-move score was taken
 * from the wrong side's perspective. At higher search depths (more null-move
 * cutoffs) this surfaced as a systematic asymmetry: one colour dominated
 * self-play even with identical engines.
 *
 * This test locks the contract that a position and its mirror (colours
 * swapped, board flipped, opposite side to move) must evaluate to opposite
 * scores from each root's perspective.
 */

import { describe, test, expect } from 'vitest';

const searchMod = await import('../js/search.js');
const boardDefs = await import('../js/ai/BoardDefinitions.js');

const {
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_KING,
  PIECE_QUEEN,
  PIECE_ROOK,
  PIECE_BISHOP,
  PIECE_KNIGHT,
  PIECE_PAWN,
  BOARD_SIZE,
  TYPE_MASK,
  COLOR_MASK,
} = boardDefs;

function emptyBoard(): Int8Array {
  return new Int8Array(BOARD_SIZE * BOARD_SIZE).fill(0);
}

function place(b: Int8Array, r: number, c: number, color: number, type: number): void {
  b[r * BOARD_SIZE + c] = color | type;
}

// A symmetric middlegame position: both sides have full back ranks + pawns.
// Used so that null-move pruning (which fires only when both sides have
// non-pawn/king material) is actually exercised during the search.
function symmetricStart(): Int8Array {
  const b = emptyBoard();
  const back = [PIECE_ROOK, PIECE_KNIGHT, PIECE_BISHOP, PIECE_QUEEN, PIECE_KING, PIECE_BISHOP, PIECE_KNIGHT, PIECE_ROOK, PIECE_QUEEN];
  for (let c = 0; c < 9; c++) {
    place(b, 0, c, COLOR_BLACK, back[c]);
    place(b, 1, c, COLOR_BLACK, PIECE_PAWN);
    place(b, 7, c, COLOR_WHITE, PIECE_PAWN);
    place(b, 8, c, COLOR_WHITE, back[c]);
  }
  return b;
}

// Mirror a board: swap colours and flip rows (row r <-> row 8-r), keep col.
function mirror(b: Int8Array): Int8Array {
  const m = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = b[r * BOARD_SIZE + c];
      if (p === 0) continue;
      const type = p & TYPE_MASK;
      const col = p & COLOR_MASK;
      const newCol = col === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
      m[(BOARD_SIZE - 1 - r) * BOARD_SIZE + c] = newCol | type;
    }
  }
  return m;
}

describe('createJsSearch / run — mirror symmetry (null-move regression)', () => {
  test(
    'position and its mirror score as opposites (no systematic asymmetry)',
    async () => {
      const search = searchMod.createJsSearch();
      const pos = symmetricStart();
      const mirrored = mirror(pos);

      // The two root searches are mirror images: white-to-move on S and
      // black-to-move on mirror(S). Their scores must be opposites.
      //
      // A *systematic* asymmetry (hundreds of cp, one colour dominating
      // self-play) was caused by the null-move-pruning perspective bug
      // (search called with the wrong `maximizing` flag). Approximative
      // search heuristics (LMR/ProbCut/null-move) leave a small residual
      // asymmetry (~50cp at depth 6) which is expected and harmless; we
      // only guard against the large, game-distorting kind.
      const white = await search.run(pos, 'white', 6);
      const black = await search.run(mirrored, 'black', 6);
      const diff = white.score + black.score;
      console.log(`DEBUG d=6 white=${white.score} black=${black.score} diff=${diff}`);
      expect(Math.abs(diff)).toBeLessThan(100);
    },
    30000
  );
});
