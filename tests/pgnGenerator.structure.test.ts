import { describe, expect, test } from 'vitest';
import { moveToNotation, generatePGN } from '../js/utils/PGNGenerator.js';

// Supplementary coverage for js/utils/PGNGenerator.ts. The sibling
// pgnNotation.correctness.test.ts locks moveToNotation's
// disambiguation / castling / promotion / check-mate behaviour.
// Here we add the DOM-free pieces it does NOT cover:
//   - moveToNotation basic capture + pawn-capture file disambiguation
//     + the full fairy-letter mapping
//   - generatePGN structure: headers, numbered move text, the
//     ongoing/decisive result, and the cross-board FEN/SetUp variant

type Piece = { type: string; color: 'white' | 'black'; hasMoved?: boolean };
type Board = (Piece | null)[][];

function emptyBoard(): Board {
  return Array(9).fill(null).map(() => Array(9).fill(null));
}

function move(
  f: [number, number],
  t: [number, number],
  extra: Record<string, unknown> = {},
) {
  return {
    from: { r: f[0], c: f[1] },
    to: { r: t[0], c: t[1] },
    piece: { type: 'p', color: 'white' } as Piece,
    ...extra,
  } as any;
}

function gameWith(board: Board, history: unknown[], extra: Record<string, unknown> = {}) {
  return { board, moveHistory: history, boardShape: 'standard', ...extra } as any;
}

describe('PGNGenerator.moveToNotation — capture & fairy letters', () => {
  test('a plain rook capture appends "x" and the from square', () => {
    const board = emptyBoard();
    board[0][0] = { type: 'r', color: 'white', hasMoved: true };
    const m = move([0, 0], [0, 4], {
      piece: { type: 'r', color: 'white' },
      captured: { type: 'p', color: 'black' },
    });
    // (0,0)=a9 -> (0,4)=e9, rook captures -> Rxe9 (unambiguous: no from square)
    expect(moveToNotation(m, gameWith(board, []))).toBe('Rxe9');
  });

  test('a pawn capture is disambiguated by its source file', () => {
    const board = emptyBoard();
    board[6][2] = { type: 'p', color: 'white', hasMoved: true };
    const m = move([6, 2], [5, 3], {
      piece: { type: 'p', color: 'white' },
      captured: { type: 'p', color: 'black' },
    });
    // pawn on c-file captures on d4 -> cxd4
    expect(moveToNotation(m, gameWith(board, []))).toBe('cxd4');
  });

  test('all fairy piece letters map (R N B Q K A C E J)', () => {
    const letters: Record<string, string> = {
      r: 'R', n: 'N', b: 'B', q: 'Q', k: 'K', a: 'A', c: 'C', e: 'E', j: 'J',
    };
    for (const [type, letter] of Object.entries(letters)) {
      const board = emptyBoard();
      board[7][0] = { type, color: 'white', hasMoved: true } as Piece;
      const m = move([7, 0], [5, 0], { piece: { type, color: 'white' } });
      // (7,0)=a2 -> (5,0)=a4, letter + destination only (unambiguous)
      expect(moveToNotation(m, gameWith(board, []))).toBe(`${letter}a4`);
    }
  });
});

describe('PGNGenerator.generatePGN — structure', () => {
  test('emits standard headers, numbered moves and an ongoing result', () => {
    const board = emptyBoard();
    board[8][4] = { type: 'k', color: 'white', hasMoved: true };
    board[0][4] = { type: 'k', color: 'black', hasMoved: true };
    const g = gameWith(board, [
      move([6, 0], [5, 0], { piece: { type: 'p', color: 'white' } }),
      move([1, 8], [2, 8], { piece: { type: 'p', color: 'black' } }),
      move([6, 1], [5, 1], { piece: { type: 'p', color: 'white' } }),
    ]);
    const pgn = generatePGN(g, { white: 'Alice', black: 'Bob' }, false);
    expect(pgn).toContain('[Event "Schach 9x9 Game"]');
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('[Black "Bob"]');
    expect(pgn).toContain('[Variant "9x9"]');
    // move-numbering: 1. a4 (white) i7 (black)  2. b4 (white)
    expect(pgn).toContain('1. a4 i7');
    expect(pgn).toContain('2. b4');
    expect(pgn.trimEnd().endsWith('*')).toBe(true); // ongoing
  });

  test('a decisive winner produces a 1-0 / 0-1 result', () => {
    const board = emptyBoard();
    board[8][4] = { type: 'k', color: 'white', hasMoved: true };
    board[0][4] = { type: 'k', color: 'black', hasMoved: true };
    const g = gameWith(board, [], { winner: 'white' });
    const pgn = generatePGN(g, {}, false);
    expect(pgn.trimEnd().endsWith('1-0')).toBe(true);
  });

  test('the cross board shape emits FEN / SetUp / Variant headers', () => {
    const board = emptyBoard();
    board[8][4] = { type: 'k', color: 'white', hasMoved: true };
    board[0][4] = { type: 'k', color: 'black', hasMoved: true };
    const g = gameWith(board, [], { boardShape: 'cross' });
    const pgn = generatePGN(g, {}, false);
    expect(pgn).toContain('[Variant "Cross"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain('[FEN ');
  });
});
