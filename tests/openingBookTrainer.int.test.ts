import { describe, expect, test } from 'vitest';
import {
  createInitialBoard,
  boardToUi,
  applyMoveInt,
  isTerminalInt,
  getBoardHashInt,
} from '../js/utils/OpeningBookTrainer.js';
import {
  WHITE_PAWN,
  WHITE_KNIGHT,
  WHITE_BISHOP,
  WHITE_ROOK,
  WHITE_QUEEN,
  WHITE_KING,
  WHITE_ARCHBISHOP,
  WHITE_CHANCELLOR,
  WHITE_ANGEL,
  WHITE_NIGHTRIDER,
  PIECE_NONE,
} from '../js/ai/BoardDefinitions.js';

// `OpeningBookTrainer` is Node/fs-heavy, but it exports a handful of
// DOM-free pure helpers that operate on the internal Int8Array board
// (the engine's packed-piece representation). We lock those here:
//   boardToUi        - Int8Array -> UI piece map (all 9 fairy types)
//   applyMoveInt     - mutating make-move on the Int8Array
//   isTerminalInt    - terminal/checkmate/stalemate detection
//   getBoardHashInt - position hashing (turn-sensitive)

function emptyInt(): Int8Array {
  return new Int8Array(81).fill(PIECE_NONE);
}

describe('OpeningBookTrainer.boardToUi — packed-piece decoding', () => {
  test('decodes all 9 white piece types to their string codes', () => {
    const b = emptyInt();
    // place one of every white type on the first rank
    const codes = [
      WHITE_PAWN,
      WHITE_KNIGHT,
      WHITE_BISHOP,
      WHITE_ROOK,
      WHITE_QUEEN,
      WHITE_KING,
      WHITE_ARCHBISHOP,
      WHITE_CHANCELLOR,
      WHITE_ANGEL,
    ];
    codes.forEach((code, c) => {
      b[c] = code;
    });
    // also a nightrider on an extra square
    b[10] = WHITE_NIGHTRIDER;

    const ui = boardToUi(b);
    expect(ui[0][0]).toEqual({ type: 'p', color: 'white', hasMoved: false });
    expect(ui[0][1]).toEqual({ type: 'n', color: 'white', hasMoved: false });
    expect(ui[0][2]).toEqual({ type: 'b', color: 'white', hasMoved: false });
    expect(ui[0][3]).toEqual({ type: 'r', color: 'white', hasMoved: false });
    expect(ui[0][4]).toEqual({ type: 'q', color: 'white', hasMoved: false });
    expect(ui[0][5]).toEqual({ type: 'k', color: 'white', hasMoved: false });
    expect(ui[0][6]).toEqual({ type: 'a', color: 'white', hasMoved: false });
    expect(ui[0][7]).toEqual({ type: 'c', color: 'white', hasMoved: false });
    expect(ui[0][8]).toEqual({ type: 'e', color: 'white', hasMoved: false });
    expect(ui[1][1]).toEqual({ type: 'j', color: 'white', hasMoved: false });
  });

  test('empty squares map to null', () => {
    const ui = boardToUi(emptyInt());
    expect(ui[4][4]).toBeNull();
  });
});

describe('OpeningBookTrainer.applyMoveInt — make-move on Int8Array', () => {
  test('moves the piece and vacates the source square', () => {
    const b = emptyInt();
    b[0] = WHITE_ROOK;
    applyMoveInt(b, { from: { r: 0, c: 0 }, to: { r: 0, c: 3 } });
    expect(b[0]).toBe(PIECE_NONE);
    expect(b[3]).toBe(WHITE_ROOK);
  });
});

describe('OpeningBookTrainer.isTerminalInt — end-of-game detection', () => {
  test('the initial position is not terminal (both sides have moves)', () => {
    const board = createInitialBoard();
    const white = isTerminalInt(board, 'white');
    const black = isTerminalInt(board, 'black');
    expect(white.terminal).toBe(false);
    expect(black.terminal).toBe(false);
    expect(white.result).toBeNull();
  });
});

describe('OpeningBookTrainer.getBoardHashInt — position hashing', () => {
  test('identical boards hash identically', () => {
    const a = createInitialBoard();
    const c = createInitialBoard();
    expect(getBoardHashInt(a, 'white')).toBe(getBoardHashInt(c, 'white'));
  });

  test('hash changes after a real pawn move', () => {
    const before = createInitialBoard();
    const after = createInitialBoard();
    // White pawns sit on rank 7 (board index 63..71); push (7,0)->(6,0).
    applyMoveInt(after, { from: { r: 7, c: 0 }, to: { r: 6, c: 0 } });
    expect(getBoardHashInt(before, 'white')).not.toBe(getBoardHashInt(after, 'white'));
  });

  test('hash is turn-sensitive (same board, different side to move)', () => {
    const board = createInitialBoard();
    expect(getBoardHashInt(board, 'white')).not.toBe(getBoardHashInt(board, 'black'));
  });
});
