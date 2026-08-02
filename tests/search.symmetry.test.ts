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

import { describe, test, expect, beforeEach } from 'vitest';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import { resetRules } from '../js/ai/MoveGenerator.js';

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
  beforeEach(() => {
    // Other suites (8×8) mutate module globals; pin 9×9 + no castling/EP.
    setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
    resetRules();
  });

  test(
    'position and its mirror score as opposites (no systematic asymmetry)',
    async () => {
      const search = searchMod.createJsSearch();
      const pos = symmetricStart();
      const mirrored = mirror(pos);

      // The two root searches are mirror images: white-to-move on S and
      // black-to-move on mirror(S). Their scores must be opposites.
      //
      // Depth 4 (not 6): deeper searches often hit MAX_SEARCH_TIME (8s) under
      // full-suite load, producing wall-clock-dependent incomplete IDs and
      // false asymmetry. Depth 4 stays well under the budget while still
      // exercising null-move / LMR enough to catch the perspective bug.
      const white = await search.run(pos, 'white', 4);
      const black = await search.run(mirrored, 'black', 4);
      const diff = white.score + black.score;
      console.log(`DEBUG d=4 white=${white.score} black=${black.score} diff=${diff}`);
      expect(Math.abs(diff)).toBeLessThan(100);
    },
    30000
  );
});
