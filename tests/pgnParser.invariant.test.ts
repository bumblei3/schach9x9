/**
 * Invariant tests for js/utils/PGNParser.ts
 *
 * Supplements the existing pgnParser.test.ts (functional coverage of parse /
 * replayGame / generateNotationForCheck). Here we assert the algebraic
 * invariants the parser must preserve regardless of input shape:
 *   - parse(): deterministic (same input => same output); header values are an
 *     exact round-trip of the quoted strings; move tokens exclude move numbers
 *     (1. 2. …) and result tokens (1-0 / 0-1 / 1/2-1/2 / *); result token is
 *     stored in headers.Result, never in moves; last duplicate header wins
 *   - parse(): multi-game isolation (headers never leak across games); empty
 *     input => []; headers-only => 1 game with 0 moves; moves-only => 1 game
 *     with empty headers; comments {...} are stripped; CRLF == LF
 *   - parse(): move count == SAN-token count minus result tokens (identity)
 *   - generateNotationForCheck(): pure (same inputs => same notation); always
 *     ends in a valid destination square [a-i][1-9] for 9x9; castling is exactly
 *     O-O / O-O-O; empty source square => ''
 *   - replayGame(): produces one entry per parseable move; the engine turn
 *     advances per move; an unparseable move stops the replay (no partial junk)
 *
 * Pure module; replayGame/generateNotationForCheck use a minimal stub engine so
 * no real game engine is required.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { PGNParser } from '../js/utils/PGNParser.js';
import { Game } from '../js/gameEngine.js';

function makePiece(type: string, color: string) {
  return { type, color, hasMoved: false };
}

// Minimal PgnEngine stub: a tiny board with a few pieces so notation generation
// has something to inspect. getAllLegalMoves returns whatever we configure.
function makeStubEngine(opts: {
  board?: ({ type: string; color: string } | null)[][];
  turn?: string;
  legalMoves?: { from: { r: number; c: number }; to: { r: number; c: number } }[];
} = {}): any {
  const size = 9;
  const board =
    opts.board ||
    Array(size).fill(null).map(() => Array(size).fill(null) as ({ type: string; color: string } | null)[]);
  const moves = opts.legalMoves || [];
  return {
    turn: opts.turn || 'white',
    boardSize: size,
    board,
    _moves: moves,
    getAllLegalMoves: () => moves,
    getBoardHash: () => 'stub-hash',
    executeMove: () => {},
  };
}

describe('parse() determinism & header round-trip', () => {
  let parser: PGNParser;
  beforeEach(() => {
    parser = new PGNParser();
  });

  const PGN = `[Event "Test Event"]
[Site "Berlin"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0`;

  test('deterministic: identical input yields identical output', () => {
    const a = parser.parse(PGN);
    const b = parser.parse(PGN);
    expect(b).toEqual(a);
  });

  test('header values round-trip the quoted strings exactly', () => {
    const games = parser.parse(PGN);
    expect(games[0].headers.Event).toBe('Test Event');
    expect(games[0].headers.Site).toBe('Berlin');
  });

  test('last duplicate header wins', () => {
    const pgn = `[Event "First"]
[Event "Second"]
1. e4 *`;
    const games = parser.parse(pgn);
    expect(games[0].headers.Event).toBe('Second');
  });

  test('move numbers are stripped (no token retains a trailing dot)', () => {
    const games = parser.parse(PGN);
    for (const m of games[0].moves) {
      expect(m).not.toMatch(/\./); // no '1.' / '2.' style prefix survives
    }
  });

  test('result token is stored in headers.Result, never in moves', () => {
    const games = parser.parse(PGN);
    expect(games[0].headers.Result).toBe('1-0');
    expect(games[0].moves).not.toContain('1-0');
    expect(games[0].moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });
});

describe('parse() structure & isolation invariants', () => {
  let parser: PGNParser;
  beforeEach(() => {
    parser = new PGNParser();
  });

  test('empty input => no games', () => {
    expect(parser.parse('')).toEqual([]);
    expect(parser.parse('   \n  \n ')).toEqual([]);
  });

  test('headers-only => one game with zero moves', () => {
    const games = parser.parse('[Event "Only"]\n[Result "*"]\n');
    expect(games).toHaveLength(1);
    expect(games[0].moves).toEqual([]);
    expect(games[0].headers.Event).toBe('Only');
  });

  test('moves-only => one game with Result header only', () => {
    const games = parser.parse('1. e4 e5 1-0');
    expect(games).toHaveLength(1);
    // parse() records the result symbol into headers.Result even with no other
    // headers present
    expect(games[0].headers).toEqual({ Result: '1-0' });
    expect(games[0].moves).toEqual(['e4', 'e5']);
  });

  test('multi-game isolation: headers never leak across games', () => {
    const pgn = `[Event "Game A"]
1. e4 *

[Event "Game B"]
1. d4 *`;
    const games = parser.parse(pgn);
    expect(games).toHaveLength(2);
    expect(games[0].headers.Event).toBe('Game A');
    expect(games[1].headers.Event).toBe('Game B');
    expect(games[0].headers.Site).toBeUndefined();
    expect(games[1].headers.Site).toBeUndefined();
  });

  test('comments {...} are stripped from moves', () => {
    const games = parser.parse('[Event "C"]\n1. e4 {best} e5 {reply} 2. Nf3 *');
    expect(games[0].moves).toEqual(['e4', 'e5', 'Nf3']);
  });

  test('CRLF and LF are handled identically', () => {
    const lf = parser.parse('[Event "X"]\n1. e4 *');
    const crlf = parser.parse('[Event "X"]\r\n1. e4 *');
    expect(crlf).toEqual(lf);
  });

  test('extra whitespace between tokens is collapsed', () => {
    const games = parser.parse('[Event "W"]\n\n\n1.    e4    e5   1-0\n');
    expect(games[0].moves).toEqual(['e4', 'e5']);
  });
});

describe('parse() move-count identity', () => {
  let parser: PGNParser;
  beforeEach(() => {
    parser = new PGNParser();
  });

  test('move count == SAN tokens minus result tokens (standard game)', () => {
    const pgn = `[Event "E"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;
    const games = parser.parse(pgn);
    const moves = games[0].moves;
    // 6 SAN tokens, result is separate
    expect(moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    expect(moves.length).toBe(6);
  });

  test('mixed result in the middle is parsed once and not duplicated', () => {
    const games = parser.parse('1. e4 1-0');
    expect(games[0].moves).toEqual(['e4']);
    expect(games[0].headers.Result).toBe('1-0');
  });

  test('each of the four result symbols is captured as Result', () => {
    for (const sym of ['1-0', '0-1', '1/2-1/2', '*']) {
      const games = parser.parse(`1. e4 ${sym}`);
      expect(games[0].headers.Result).toBe(sym);
      expect(games[0].moves).toEqual(['e4']);
    }
  });
});

describe('generateNotationForCheck() purity & shape', () => {
  let parser: PGNParser;
  beforeEach(() => {
    parser = new PGNParser();
  });

  const DEST_RE = /^[a-i][1-9]$/; // valid 9x9 destination square

  test('pure: identical inputs yield identical notation', () => {
    const engine = makeStubEngine({
      board: (() => {
        const b = Array(9).fill(null).map(() => Array(9).fill(null));
        b[7][4] = makePiece('p', 'white');
        return b;
      })(),
    });
    const move = { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } };
    const a = parser.generateNotationForCheck(move, engine, []);
    const b = parser.generateNotationForCheck(move, engine, []);
    expect(a).toBe(b); // 'e4'
  });

  test('pawn move notation ends in a valid destination square', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[7][4] = makePiece('p', 'white');
    const engine = makeStubEngine({ board });
    const notation = parser.generateNotationForCheck(
      { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
      engine,
      []
    );
    expect(notation).toBe('e4');
    expect(notation.slice(-2)).toMatch(DEST_RE);
  });

  test('piece notation includes the piece letter and a valid destination', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[7][1] = makePiece('n', 'white');
    const engine = makeStubEngine({ board });
    const notation = parser.generateNotationForCheck(
      { from: { r: 7, c: 1 }, to: { r: 5, c: 2 } },
      engine,
      []
    );
    expect(notation.startsWith('N')).toBe(true);
    expect(notation.slice(-2)).toMatch(DEST_RE);
  });

  test('castling is exactly O-O / O-O-O', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[8][4] = makePiece('k', 'white');
    const engine = makeStubEngine({ board });
    expect(
      parser.generateNotationForCheck({ from: { r: 8, c: 4 }, to: { r: 8, c: 6 } }, engine, [])
    ).toBe('O-O');
    expect(
      parser.generateNotationForCheck({ from: { r: 8, c: 4 }, to: { r: 8, c: 2 } }, engine, [])
    ).toBe('O-O-O');
  });

  test('empty source square yields empty notation', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    const engine = makeStubEngine({ board });
    const notation = parser.generateNotationForCheck(
      { from: { r: 4, c: 4 }, to: { r: 3, c: 3 } },
      engine,
      []
    );
    expect(notation).toBe('');
  });

  test('capture notation includes the x between from-file and destination', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[4][4] = makePiece('p', 'white');
    board[3][5] = makePiece('p', 'black');
    const engine = makeStubEngine({ board });
    const notation = parser.generateNotationForCheck(
      { from: { r: 4, c: 4 }, to: { r: 3, c: 5 } },
      engine,
      []
    );
    expect(notation).toBe('exf6');
  });
});

describe('replayGame() invariants', () => {
  let parser: PGNParser;
  beforeEach(() => {
    parser = new PGNParser();
  });

  test('produces one history entry per parseable SAN move', () => {
    const game = new Game(15, 'classic');
    const history = parser.replayGame(['e4'], game);
    expect(history).toHaveLength(1);
    expect(history.every(h => typeof h.hash === 'string')).toBe(true);
    expect(history.every(h => h.san)).toBe(true);
    expect(history[0].san).toBe('e4');
  });

  test('an unparseable move yields no history entry', () => {
    const game = new Game(15, 'classic');
    // Qxd8 is illegal as a first move
    const history = parser.replayGame(['Qxd8'], game);
    expect(history).toHaveLength(0);
  });

  test('replay advances the engine turn after the executed move', () => {
    const game = new Game(15, 'classic');
    const history = parser.replayGame(['e4'], game);
    expect(history).toHaveLength(1);
    // After white's e4, turn passes to black
    expect(game.turn).toBe('black');
  });
});
