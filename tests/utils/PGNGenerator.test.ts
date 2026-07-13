/**
 * Focused tests for js/utils/PGNGenerator.ts — algebraic notation + PGN export.
 *
 * PGNGenerator had NO dedicated test file before this. Chess notation is
 * notoriously error-prone (disambiguation, castling, promotion, check/mate
 * suffixes, engine annotations), so it is driven directly here with crafted
 * MoveHistoryEntry objects and asserted as exact strings derived from the
 * module's own coordinate mapping (colToFile: a..i = 0..8, rowToRank: 9-r).
 * The DOM-dependent helpers (copyPGNToClipboard/downloadPGN) are not exercised
 * — they only touch navigator/document and carry no logic worth isolating.
 */

import { describe, test, expect } from 'vitest';

const { moveToNotation, generatePGN } = await import('../../js/utils/PGNGenerator.js');

// colToFile(c) = String.fromCharCode(97+c) => c4 -> 'e'
// rowToRank(r) = 9 - r                => r7 -> '2', r6 -> '3', r5 -> '4'
// So a pawn from {r:7,c:4} to {r:6,c:4} is e2->e3 and renders as 'e3'
// (pawns have no letter and only the destination is written).

function gameWithBoard(board: any[][]): any {
  return { board } as any;
}

function empty9x9(): any[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(null));
}

function mv(over: any = {}): any {
  return {
    from: { r: 7, c: 4 },
    to: { r: 6, c: 4 },
    piece: { type: 'p', color: 'white' },
    ...over,
  };
}

describe('moveToNotation — basic piece moves', () => {
  test('pawn push writes only the destination square', () => {
    expect(moveToNotation(mv(), null)).toBe('e3');
  });

  test('knight move is prefixed with N and writes destination', () => {
    expect(
      moveToNotation(
        mv({ piece: { type: 'n', color: 'white' }, from: { r: 7, c: 1 }, to: { r: 5, c: 2 } }),
        null
      )
    ).toBe('Nc4'); // b2 -> c4
  });

  test('returns ?? for a malformed / null move', () => {
    expect(moveToNotation(null as any, null)).toBe('??');
    expect(moveToNotation(mv({ from: null }) as any, null)).toBe('??');
  });
});

describe('moveToNotation — castling', () => {
  test('kingside castling (to.c > from.c) is O-O', () => {
    expect(moveToNotation(mv({ isCastling: true, from: { r: 8, c: 4 }, to: { r: 8, c: 6 } }), null)).toBe('O-O');
  });
  test('queenside castling (to.c < from.c) is O-O-O', () => {
    expect(moveToNotation(mv({ isCastling: true, from: { r: 8, c: 4 }, to: { r: 8, c: 2 } }), null)).toBe('O-O-O');
  });
});

describe('moveToNotation — captures + check/mate', () => {
  test('pawn capture prefixes source file then x then destination', () => {
    // pawn e2xe3 -> 'e' (fromFile) + 'x' + 'e3'
    expect(moveToNotation(mv({ captured: { type: 'p' } }), null)).toBe('exe3');
  });
  test('check adds +', () => {
    expect(moveToNotation(mv({ isCheck: true }), null)).toBe('e3+');
  });
  test('checkmate adds #', () => {
    expect(moveToNotation(mv({ isCheckmate: true }), null)).toBe('e3#');
  });
  test('capture + check combines x and +', () => {
    expect(moveToNotation(mv({ captured: { type: 'r' }, isCheck: true }), null)).toBe('exe3+');
  });
});

describe('moveToNotation — promotion', () => {
  test('promotion to queen appends =Q', () => {
    expect(
      moveToNotation(mv({ promotion: 'q', from: { r: 1, c: 4 }, to: { r: 0, c: 4 } }), null)
    ).toBe('e9=Q'); // e8 -> e9
  });
  test('promotion to a custom piece (archbishop) uses its letter', () => {
    expect(
      moveToNotation(mv({ promotion: 'a', from: { r: 1, c: 4 }, to: { r: 0, c: 4 } }), null)
    ).toBe('e9=A');
  });
});

describe('moveToNotation — disambiguation', () => {
  test('two knights of same colour can reach dest -> disambiguate by FILE', () => {
    const board = empty9x9();
    board[7][1] = { type: 'n', color: 'white' }; // b2 (r7c1)
    board[7][3] = { type: 'n', color: 'white' }; // d2 (r7c3)
    // Move the d2 knight to c4 (r5c2): both knights reach c4 via L-jump.
    const move = mv({
      piece: { type: 'n', color: 'white' },
      from: { r: 7, c: 3 },
      to: { r: 5, c: 2 },
    });
    expect(moveToNotation(move, gameWithBoard(board))).toBe('Ndc4');
  });

  test('two knights same FILE, different rank, both reach dest -> disambiguate by RANK', () => {
    const board = empty9x9();
    board[7][2] = { type: 'n', color: 'white' }; // c2 (r7c2)
    board[5][2] = { type: 'n', color: 'white' }; // c4 (r5c2)
    // Move the c2 knight to a7 (r6c0): the c4 knight also reaches a7.
    const move = mv({
      piece: { type: 'n', color: 'white' },
      from: { r: 7, c: 2 },
      to: { r: 6, c: 0 },
    });
    // sameFile true (both col 2), sameRank false -> disambiguate by rank (r7 -> '2')
    // dest a7 is r6c0 -> file 'a', rank 9-6 = '3' => 'a3'
    expect(moveToNotation(move, gameWithBoard(board))).toBe('N2a3');
  });
});

describe('moveToNotation — engine annotations', () => {
  test('quality symbol (blunder) appended', () => {
    const move = mv({ classification: 'blunder' });
    expect(moveToNotation(move, null, true)).toBe('e3 ??');
  });

  test('eval score formatted as centipawns with explicit + sign', () => {
    const move = mv({ evalScore: 150 });
    expect(moveToNotation(move, null, true)).toBe('e3 [%eval +1.5]');
  });

  test('negative eval score keeps its own sign', () => {
    const move = mv({ evalScore: -200 });
    expect(moveToNotation(move, null, true)).toBe('e3 [%eval -2]');
  });

  test('clock time formatted as mm:ss', () => {
    const move = mv({ timeUsed: 125 }); // 2:05
    expect(moveToNotation(move, null, true)).toBe('e3 [%clk 2:05]');
  });

  test('principal variation is rendered recursively', () => {
    const move = mv({
      pv: [mv({ from: { r: 0, c: 0 }, to: { r: 2, c: 1 }, piece: { type: 'n', color: 'black' } })],
    });
    // pv knight a9 -> b7
    expect(moveToNotation(move, null, true)).toBe('e3 [%pv Nb7]');
  });

  test('good classification yields no quality glyph; eval + clock combine', () => {
    const move = mv({ classification: 'good', evalScore: 50, timeUsed: 5 });
    expect(moveToNotation(move, null, true)).toBe('e3 [%eval +0.5] [%clk 0:05]');
  });

  test('without includeEngineAnnotations, no annotations are added', () => {
    const move = mv({ classification: 'blunder', evalScore: 100 });
    expect(moveToNotation(move, null, false)).toBe('e3');
  });
});

describe('generatePGN — headers + result + move numbering', () => {
  function baseGame(over: any = {}): any {
    return { moveHistory: [], boardShape: 'square', ...over } as any;
  }

  test('emits standard 9x9 headers and a 1-0 result', () => {
    const game = baseGame({
      winner: 'white',
      moveHistory: [
        mv(),
        mv({ piece: { type: 'p', color: 'black' }, from: { r: 1, c: 4 }, to: { r: 2, c: 4 } }),
      ],
    });
    const pgn = generatePGN(game, {}, false);
    expect(pgn).toContain('[Variant "9x9"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('1. e3 e7 1-0');
  });

  test('ongoing game uses * as result', () => {
    const game = baseGame({ moveHistory: [mv()] });
    const pgn = generatePGN(game, {}, false);
    expect(pgn).toContain('[Result "*"]');
    expect(pgn.trim().endsWith('*')).toBe(true);
  });

  test('cross variant adds Variant/FEN/SetUp headers', () => {
    const game = baseGame({ boardShape: 'cross', moveHistory: [] });
    const pgn = generatePGN(game, {}, false);
    expect(pgn).toContain('[Variant "Cross"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain('[FEN "3pp3/3pp3/3pp3/pppppppp/pppkpppb/pppppppp/3pp3/3pp3/3pp3 w - - 0 1"]');
  });

  test('custom options override default headers', () => {
    const game = baseGame({ moveHistory: [] });
    const pgn = generatePGN(game, { white: 'Alice', black: 'Bob', round: '3' }, false);
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('[Black "Bob"]');
    expect(pgn).toContain('[Round "3"]');
  });

  test('engine annotations in move text when enabled', () => {
    const game = baseGame({ moveHistory: [mv({ classification: 'blunder' })], boardShape: 'square' });
    const pgn = generatePGN(game, {}, true);
    expect(pgn).toContain('[Annotator "Schach9x9 Engine"]');
    expect(pgn).toContain('1. e3 ??');
  });

  test('move numbering advances correctly across multiple full moves', () => {
    const game = baseGame({
      moveHistory: [
        mv(), // 1. white e3
        mv({ piece: { type: 'p', color: 'black' }, from: { r: 1, c: 4 }, to: { r: 2, c: 4 } }), // 1... e7
        mv({ from: { r: 6, c: 3 }, to: { r: 5, c: 3 } }), // 2. white d4 (d3->d4)
        mv({ piece: { type: 'p', color: 'black' }, from: { r: 2, c: 4 }, to: { r: 3, c: 4 } }), // 2... e6
      ],
    });
    const pgn = generatePGN(game, {}, false);
    expect(pgn).toContain('1. e3 e7 2. d4 e6');
  });
});
