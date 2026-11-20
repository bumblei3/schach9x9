/**
 * Regelzustand fuer die Integer-Engine (Rochade + en passant).
 *
 * MoveGenerator haelt castling/ep in Modul-Globalzustand. Die KI-Worker
 * fragen die Stellung nicht nach diesem Zustand, darum muss er pro Anfrage
 * mitgegeben werden — sonst sucht 9x9 ohne en passant und 8x8 mit veralteten
 * Rochadenrechten.
 */
import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import {
  getAllLegalMoves,
  setRules,
  resetRules,
  CR_ALL,
  CR_WK,
  CR_WQ,
} from '../js/ai/MoveGenerator.js';
import { convertBoardToInt, getTopMoves, rulesFromPosition } from '../js/aiEngine.js';
import type { Piece, Player } from '../js/types/core.js';

function piece(type: Piece['type'], color: Player, hasMoved = false): Piece {
  return { type, color, hasMoved };
}

function empty(size: number): (Piece | null)[][] {
  return Array.from({ length: size }, () => Array<Piece | null>(size).fill(null));
}

function uci(move: { from: { r: number; c: number }; to: { r: number; c: number } } | null): string {
  if (!move) return 'null';
  return `${move.from.r},${move.from.c}->${move.to.r},${move.to.c}`;
}

beforeEach(() => {
  resetRules();
});

afterEach(() => {
  setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
  resetRules();
});

describe('rulesFromPosition', () => {
  test('9x9: en-passant-Ziel aus dem Doppelschritt', () => {
    setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
    const board = empty(9);
    board[8][4] = piece('k', 'white');
    board[0][4] = piece('k', 'black');
    board[4][4] = piece('p', 'white'); // e5
    board[4][3] = piece('p', 'black'); // d5 nach d7d5
    const lastMove = { piece: piece('p', 'black'), to: { r: 4, c: 3 }, isDoublePawnPush: true };
    const rules = rulesFromPosition(board, lastMove);
    expect(rules.castling).toBe(0);
    expect(rules.ep).toBe(3 * 9 + 3); // d6
  });

  test('9x9: kein EP ohne Doppelschritt', () => {
    setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
    const board = empty(9);
    board[8][4] = piece('k', 'white');
    board[0][4] = piece('k', 'black');
    board[4][4] = piece('p', 'white');
    board[4][3] = piece('p', 'black');
    expect(rulesFromPosition(board, null).ep).toBe(-1);
    expect(
      rulesFromPosition(board, { piece: piece('p', 'black'), to: { r: 4, c: 3 } }).ep
    ).toBe(-1);
  });

  test('8x8: Rochadenrechte folgen hasMoved', () => {
    setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
    const board = empty(8);
    board[7][4] = piece('k', 'white', true); // Koenig schon gelaufen
    board[7][7] = piece('r', 'white');
    board[7][0] = piece('r', 'white');
    board[0][4] = piece('k', 'black');
    expect(rulesFromPosition(board, null).castling).toBe(0);

    board[7][4] = piece('k', 'white', false);
    expect(rulesFromPosition(board, null).castling).toBe(CR_WK | CR_WQ);

    board[7][7] = piece('r', 'white', true); // h1-Turm gelaufen
    expect(rulesFromPosition(board, null).castling).toBe(CR_WQ);
  });
});

describe('Engine beachtet den Regelzustand', () => {
  test('9x9: getTopMoves mit Regeln findet das en passant', async () => {
    setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
    const board = empty(9);
    board[8][4] = piece('k', 'white');
    board[0][4] = piece('k', 'black');
    board[4][4] = piece('p', 'white'); // e5
    board[4][3] = piece('p', 'black'); // d5 nach d7d5
    const lastMove = { piece: piece('p', 'black'), to: { r: 4, c: 3 }, isDoublePawnPush: true };
    const rules = rulesFromPosition(board, lastMove);

    const mit = await getTopMoves(board, 'white', 5, 2, 2500, undefined, rules);
    expect(mit.map(m => uci(m.move))).toContain('4,4->3,3');

    // Gegenprobe: ohne Regeln bleibt das EP unsichtbar.
    resetRules();
    const ohne = await getTopMoves(board, 'white', 5, 2, 2500, undefined, undefined);
    expect(ohne.map(m => uci(m.move))).not.toContain('4,4->3,3');
    expect(
      getAllLegalMoves(convertBoardToInt(board), 'white').filter(m => m.flags === 'ep')
    ).toHaveLength(0);
  });

  test('8x8: getTopMoves ohne Rochadenrechte bietet keine Rochade an', async () => {
    setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
    const board = empty(8);
    board[7][4] = piece('k', 'white', true); // Koenig schon gelaufen
    board[7][7] = piece('r', 'white');
    board[7][0] = piece('r', 'white');
    board[0][4] = piece('k', 'black');
    const rules = rulesFromPosition(board, null);
    expect(rules.castling).toBe(0);

    const top = await getTopMoves(board, 'white', 8, 2, 2500, undefined, rules);
    const zuege = top.map(m => uci(m.move));
    expect(zuege.some(z => z.startsWith('7,4->'))).toBe(false);

    // Gegenprobe: mit CR_ALL ist die Rochade im Wurzelbaum vorhanden.
    setRules({ castling: CR_ALL, ep: -1 });
    const mitCr = getAllLegalMoves(convertBoardToInt(board), 'white').filter(
      m => m.flags === 'castle-k' || m.flags === 'castle-q'
    );
    expect(mitCr.length).toBeGreaterThan(0);
  });
});
