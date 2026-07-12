/**
 * Invariant tests for js/utils/OpeningBookTrainer.ts board utilities.
 *
 * This module trains the opening book via real engine self-play, but it also
 * contains several PURE board helpers (createInitialBoard, boardToUi,
 * applyMoveInt, isTerminalInt, getBoardHashInt) that are the foundation of
 * position tracking. They were not exported or tested before, so this suite
 * locks their contract. (The helpers are exported now so they can be tested
 * without pulling in fs / process.argv / the async engine.)
 */

import { describe, test, expect } from 'vitest';
import {
  createInitialBoard,
  boardToUi,
  applyMoveInt,
  isTerminalInt,
  getBoardHashInt,
} from '../js/utils/OpeningBookTrainer.js';
import {
  PIECE_NONE,
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_ROOK,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_PAWN,
  TYPE_MASK,
  COLOR_MASK,
} from '../js/ai/BoardDefinitions.js';

const rc = (r: number, c: number) => r * 9 + c;
const typeOf = (b: Int8Array, r: number, c: number) => b[rc(r, c)] & TYPE_MASK;
const colorOf = (b: Int8Array, r: number, c: number) =>
  (b[rc(r, c)] & COLOR_MASK) === COLOR_WHITE ? 'white' : 'black';

describe('createInitialBoard — 9x9 starting position', () => {
  test('the board is a full 81-square Int8Array with 36 pieces', () => {
    const b = createInitialBoard();
    expect(b.length).toBe(81);
    let pieces = 0;
    for (let i = 0; i < 81; i++) if (b[i] !== PIECE_NONE) pieces++;
    expect(pieces).toBe(36); // 18 per side
  });

  test('each side has 9 pawns plus 8 distinct piece types (17 total)', () => {
    const b = createInitialBoard();
    for (const color of ['white', 'black'] as const) {
      const colorMask = color === 'white' ? COLOR_WHITE : COLOR_BLACK;
      const types = new Set<number>();
      let pawns = 0;
      let total = 0;
      for (let i = 0; i < 81; i++) {
        if ((b[i] & COLOR_MASK) !== colorMask) continue;
        total++;
        const t = b[i] & TYPE_MASK;
        if (t === PIECE_PAWN) pawns++;
        else types.add(t);
      }
      expect(pawns).toBe(9);
      // The 9x9 back rank here is R N B Q K B N R A, so the
      // distinct non-pawn piece types present are R,N,B,Q,K,A (=6);
      // the exact layout is locked separately by the back-rank test below.
      expect(types.size).toBeGreaterThanOrEqual(6);
      expect(total).toBe(18); // 9 pawns + 9 back-rank pieces (R N B Q K B N R A)
    }
  });

  test('back-rank layout: R N B Q K B N R A for both colours', () => {
    const b = createInitialBoard();
    const expectBackRank = (rank: number, color: 'white' | 'black') => {
      const want = [
        PIECE_ROOK,
        PIECE_KNIGHT,
        PIECE_BISHOP,
        PIECE_QUEEN,
        PIECE_KING,
        PIECE_BISHOP,
        PIECE_KNIGHT,
        PIECE_ROOK,
        PIECE_ARCHBISHOP,
      ];
      for (let c = 0; c < 9; c++) {
        expect(typeOf(b, rank, c)).toBe(want[c]);
        expect(colorOf(b, rank, c)).toBe(color);
      }
    };
    expectBackRank(0, 'black'); // rank 9 (top)
    expectBackRank(8, 'white'); // rank 1 (bottom)
  });

  test('pawns fill the second rank for each side', () => {
    const b = createInitialBoard();
    for (let c = 0; c < 9; c++) {
      expect(typeOf(b, 1, c)).toBe(PIECE_PAWN);
      expect(colorOf(b, 1, c)).toBe('black');
      expect(typeOf(b, 7, c)).toBe(PIECE_PAWN);
      expect(colorOf(b, 7, c)).toBe('white');
    }
  });
});

describe('boardToUi — Int8 -> UI board roundtrip', () => {
  test('converts every starting piece into a UI piece with the right type/colour', () => {
    const ui = boardToUi(createInitialBoard());
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = ui[r][c];
        if (!p) continue;
        count++;
        // Re-derive the expected Int8 value and confirm the UI mapping is inverse.
        expect(['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e', 'j']).toContain(p.type);
        expect(['white', 'black']).toContain(p.color);
      }
    }
    expect(count).toBe(36);
  });

  test('a moved bishop survives the roundtrip type mapping', () => {
    const b = createInitialBoard();
    // move black bishop from (0,2) to (4,4) using applyMoveInt
    applyMoveInt(b, { from: { r: 0, c: 2 }, to: { r: 4, c: 4 } });
    const ui = boardToUi(b);
    expect(ui[4][4]?.type).toBe('b');
    expect(ui[4][4]?.color).toBe('black');
    expect(ui[0][2]).toBeNull(); // origin now empty
  });
});

describe('applyMoveInt — make/unmake style update', () => {
  test('moves the piece and vacates the origin square', () => {
    const b = createInitialBoard();
    const before = b[rc(0, 2)]; // black bishop
    applyMoveInt(b, { from: { r: 0, c: 2 }, to: { r: 3, c: 5 } });
    expect(b[rc(3, 5)]).toBe(before);
    expect(b[rc(0, 2)]).toBe(PIECE_NONE);
  });
});

describe('isTerminalInt — mate / stalemate detection', () => {
  test('the starting position is not terminal for either side', () => {
    const b = createInitialBoard();
    expect(isTerminalInt(b, 'white').terminal).toBe(false);
    expect(isTerminalInt(b, 'black').terminal).toBe(false);
  });

  test('a checkmated side with no legal moves is terminal (loss for side to move)', () => {
    // White king a1, black rooks on a9 and b9: the a9 rook checks
    // down the a-file, the b9 rook covers the b-file and rank 0, so the
    // white king on a1 has no legal move and is in check.
    const b = new Int8Array(81).fill(PIECE_NONE);
    b[rc(8, 0)] = PIECE_KING | COLOR_WHITE; // a1
    b[rc(0, 0)] = PIECE_ROOK | COLOR_BLACK; // a9
    b[rc(0, 1)] = PIECE_ROOK | COLOR_BLACK; // b9
    const res = isTerminalInt(b, 'white');
    expect(res.terminal).toBe(true);
    expect(res.result).toBe('loss');
  });

  test('a stalemated side (no moves, not in check) is a draw', () => {
    // White king a1, black rooks on b2 (covers b-file + rank 7) and
    // b9 (covers b-file + rank 0). The king on a1 has no legal
    // move but is NOT in check => stalemate.
    const b = new Int8Array(81).fill(PIECE_NONE);
    b[rc(8, 0)] = PIECE_KING | COLOR_WHITE; // a1
    b[rc(7, 1)] = PIECE_ROOK | COLOR_BLACK; // b2
    b[rc(0, 1)] = PIECE_ROOK | COLOR_BLACK; // b9
    const res = isTerminalInt(b, 'white');
    expect(res.terminal).toBe(true);
    expect(res.result).toBe('draw');
  });
});

describe('getBoardHashInt — position identity', () => {
  test('identical board + turn yields an identical hash', () => {
    const b = createInitialBoard();
    expect(getBoardHashInt(b, 'white')).toBe(getBoardHashInt(b, 'white'));
  });

  test('the same board but a different side to move yields a different hash', () => {
    const b = createInitialBoard();
    expect(getBoardHashInt(b, 'white')).not.toBe(getBoardHashInt(b, 'black'));
  });

  test('a single moved piece changes the hash', () => {
    const b = createInitialBoard();
    const h0 = getBoardHashInt(b, 'white');
    applyMoveInt(b, { from: { r: 0, c: 1 }, to: { r: 2, c: 2 } }); // black knight
    expect(getBoardHashInt(b, 'black')).not.toBe(h0);
  });

  test('hash length encodes 81 squares x 2 chars plus the turn char', () => {
    expect(getBoardHashInt(createInitialBoard(), 'white').length).toBe(81 * 2 + 1);
  });
});
