/**
 * Engine smoke tests for js/search.ts — the alpha-beta search core.
 *
 * search.ts is the heart of the Schach 9x9 engine and had only indirect
 * coverage (driven through higher-level AI tests). These tests drive
 * createJsSearch().run() directly with hand-built IntBoards (flat 81-element
 * arrays, index = r*9+c, value = COLOR|PIECE_TYPE) to lock the contract that
 * must never regress:
 *   - run() always returns a result with a finite score, node count and depth,
 *   - materially winning positions score decisively in the mover's favour
 *     (white-with-queen vs bare king -> large positive; same for black to move),
 *   - the search is deterministic for a fixed position and depth,
 *   - it never throws on a small scramble with both kings present.
 *
 * This is intentionally a black-box smoke test, not a full search-tree unit
 * test — the goal is regression protection for the public search entry point,
 * not line-by-line coverage of the alpha-beta internals. Note: run() returns
 * JsSearchResult { score, nodes, depth } (no bestMove field).
 */

import { describe, test, expect } from 'vitest';

const searchMod = await import('../js/search.js');
const boardDefs = await import('../js/ai/BoardDefinitions.js');

const { COLOR_WHITE, COLOR_BLACK, PIECE_KING, PIECE_QUEEN, PIECE_PAWN, PIECE_KNIGHT, BOARD_SIZE } = boardDefs;

// Build an empty IntBoard (all PIECE_NONE = 0).
function emptyBoard(): number[] {
  return new Array(BOARD_SIZE * BOARD_SIZE).fill(0);
}

// place a piece: value = color | type
function place(b: number[], r: number, c: number, color: number, type: number): void {
  b[r * BOARD_SIZE + c] = color | type;
}

// Both kings + a white knight that has clear L-jumps (no own pieces in the
// way, kings far apart -> no self-check risk). Guarantees legal moves exist
// so the search actually visits nodes.
function knightBoard(): number[] {
  const b = emptyBoard();
  place(b, 6, 0, COLOR_WHITE, PIECE_KING);
  place(b, 8, 8, COLOR_BLACK, PIECE_KING);
  place(b, 4, 4, COLOR_WHITE, PIECE_KNIGHT);
  return b;
}

// White queen vs bare black king — white to move, decisively winning.
function whiteWinningBoard(): number[] {
  const b = emptyBoard();
  place(b, 6, 4, COLOR_WHITE, PIECE_KING);
  place(b, 8, 4, COLOR_BLACK, PIECE_KING);
  place(b, 0, 4, COLOR_WHITE, PIECE_QUEEN);
  return b;
}

// Same position but the winning queen belongs to black and black is to move.
function blackWinningBoard(): number[] {
  const b = emptyBoard();
  place(b, 6, 4, COLOR_WHITE, PIECE_KING);
  place(b, 8, 4, COLOR_BLACK, PIECE_KING);
  place(b, 0, 4, COLOR_BLACK, PIECE_QUEEN);
  return b;
}

describe('createJsSearch / run — engine smoke', () => {
  test('returns a result with finite score, node count and depth', async () => {
    const search = searchMod.createJsSearch();
    const result = await search.run(knightBoard(), 'white', 3);
    expect(result).toBeDefined();
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.depth).toBeGreaterThanOrEqual(1);
  });

  test('a materially winning side scores decisively in its favour', async () => {
    const search = searchMod.createJsSearch();
    const whiteResult = await search.run(whiteWinningBoard(), 'white', 4);
    // White has a queen vs a bare king -> strongly positive for the mover (white).
    expect(whiteResult.score).toBeGreaterThan(300);

    const blackResult = await search.run(blackWinningBoard(), 'black', 4);
    // Black has the queen and is to move -> score is from black's perspective,
    // so it is also strongly positive (black is winning).
    expect(blackResult.score).toBeGreaterThan(300);
  });

  test('search is deterministic for a fixed position and depth', async () => {
    const search = searchMod.createJsSearch();
    const a = await search.run(whiteWinningBoard(), 'white', 3);
    const b = await search.run(whiteWinningBoard(), 'white', 3);
    // The evaluation score must be stable across identical searches.
    expect(a.score).toBe(b.score);
  });

  test('does not throw on a pawn-only scramble (both kings present)', async () => {
    const b = emptyBoard();
    place(b, 6, 4, COLOR_WHITE, PIECE_KING);
    place(b, 8, 4, COLOR_BLACK, PIECE_KING);
    place(b, 7, 3, COLOR_WHITE, PIECE_PAWN);
    place(b, 7, 5, COLOR_BLACK, PIECE_PAWN);
    const search = searchMod.createJsSearch();
    const result = await search.run(b, 'white', 2);
    expect(result).toBeDefined();
    expect(Number.isFinite(result.score)).toBe(true);
  });
});
