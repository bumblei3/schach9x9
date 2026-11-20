/**
 * En-passant-Feld in der FEN, wie `tools/stockfish-match.ts` sie an Stockfish
 * sendet.
 *
 * Warum das hier steht: 2026-11-19 brach `npm run match:stockfish` mit
 * `Stockfish wait timeout (120000ms)` ab. Stockfish war nicht kaputt — der
 * Backlog zeigte `CRITICAL ERROR: ... Invalid FEN. Invalid en-passant square.`
 * `epFen` gab das Feld ungeprüft aus; Stockfish verweigerte `position` und
 * antwortete nie auf `go`. Der Bug war wochenlang in keinem Test abgedeckt.
 *
 * Getestet werden die drei Bedingungen aus `epFen`: richtige Reihe, geschlagener
 * Bauer ist gegnerisch, ein eigener Bauer steht neben dem Zielfeld.
 */
import { describe, test, expect } from 'vitest';
import { epFen } from '../tools/stockfish-match.js';
import {
  PIECE_PAWN,
  PIECE_KING,
  COLOR_WHITE,
  COLOR_BLACK,
} from '../js/ai/BoardDefinitions.js';

const SIZE = 8;
/** Leeres 8x8-Brett (das Tool spielt Standard-Schach). */
function leer(): Int8Array {
  return new Int8Array(SIZE * SIZE);
}
/** Setzt eine Figur: r=0 ist die obere Reihe. */
function setze(b: Int8Array, r: number, c: number, farbe: number, typ: number): void {
  b[r * SIZE + c] = farbe | typ;
}
/** UCI-Feld -> Index (r von oben). */
function idx(uci: string): number {
  const c = uci.charCodeAt(0) - 97;
  const r = SIZE - Number(uci[1]);
  return r * SIZE + c;
}

describe('epFen', () => {
  test('gültiges En passant: Weiß am Zug, schwarzer Bauer auf r=3, Angreifer neben c5', () => {
    // Schwarzer Bauer von r=1 nach r=3 (Doppelzug) -> Zielfeld c6 (r=2).
    const b = leer();
    setze(b, 3, 2, COLOR_BLACK, PIECE_PAWN); // geschlagener Bauer auf c5
    setze(b, 3, 1, COLOR_WHITE, PIECE_PAWN); // Angreifer auf b5
    setze(b, 2, 4, COLOR_WHITE, PIECE_KING);
    setze(b, 6, 4, COLOR_BLACK, PIECE_KING);
    expect(epFen(idx('c6'), b, 'white')).toBe('c6');
  });

  test('gültiges En passant: Schwarz am Zug, weißer Bauer auf r=4, Angreifer neben f3', () => {
    const b = leer();
    setze(b, 4, 5, COLOR_WHITE, PIECE_PAWN); // geschlagener Bauer auf f4
    setze(b, 4, 4, COLOR_BLACK, PIECE_PAWN); // Angreifer auf e4
    expect(epFen(idx('f3'), b, 'black')).toBe('f3');
  });

  test('der Original-Fall: c5 bei Weiß am Zug ist falsch (falsche Reihe)', () => {
    // Genau diese FEN stand im Backlog: `... w k c5 0 13`.
    const b = leer();
    setze(b, 3, 2, COLOR_BLACK, PIECE_PAWN);
    setze(b, 3, 1, COLOR_WHITE, PIECE_PAWN);
    expect(epFen(idx('c5'), b, 'white')).toBe('-');
  });

  test('kein Angreifer neben dem Zielfeld -> Strich', () => {
    const b = leer();
    setze(b, 3, 2, COLOR_BLACK, PIECE_PAWN); // geschlagener Bauer
    setze(b, 5, 1, COLOR_WHITE, PIECE_PAWN); // zu weit weg
    expect(epFen(idx('c6'), b, 'white')).toBe('-');
  });

  test('der geschlagene Bauer ist vom eigenen Spieler -> Strich', () => {
    const b = leer();
    setze(b, 3, 2, COLOR_WHITE, PIECE_PAWN); // weiß statt schwarz
    setze(b, 3, 1, COLOR_WHITE, PIECE_PAWN);
    expect(epFen(idx('c6'), b, 'white')).toBe('-');
  });

  test('geschlagener Bauer ist eine andere Figur -> Strich', () => {
    const b = leer();
    setze(b, 3, 2, COLOR_BLACK, PIECE_KING);
    setze(b, 3, 1, COLOR_WHITE, PIECE_PAWN);
    expect(epFen(idx('c6'), b, 'white')).toBe('-');
  });

  test('Angreifer am Rand: nur rechts möglich', () => {
    const b = leer();
    setze(b, 3, 0, COLOR_BLACK, PIECE_PAWN); // a5
    setze(b, 3, 1, COLOR_WHITE, PIECE_PAWN); // b5 (rechts daneben)
    expect(epFen(idx('a6'), b, 'white')).toBe('a6');
  });

  test('kein EP-Feld (negativ) -> Strich', () => {
    expect(epFen(-1, leer(), 'white')).toBe('-');
  });
});
