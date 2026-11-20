/**
 * Root-Hash der Transpositionstabelle.
 *
 * Die TT ist prozessglobal und wird nie geleert. Der Root-Hash darf deshalb
 * nicht nur Brett + Farbe enthalten, sondern auch Rochadenrechte und das
 * en-passant-Ziel — sonst kollidieren zwei Stellungen, die sich nur in den
 * Rechten unterscheiden, und die TT-Antwort (ein gespeicherter Zug) kann in der
 * aktuellen Stellung illegal sein. Genau das war der `illegal-ours`-Mechanismus
 * im Such-Server (STATUS.md, 0-ms-Antworten).
 */
import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import {
  getAllLegalMoves,
  setRules,
  resetRules,
  CR_ALL,
} from '../js/ai/MoveGenerator.js';
import { createJsSearch } from '../js/search.js';
import {
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_PAWN,
  PIECE_KING,
  PIECE_ROOK,
} from '../js/ai/BoardDefinitions.js';

function endgameBoard(): Int8Array {
  const b = new Int8Array(64);
  b[60] = COLOR_WHITE | PIECE_KING; // e1
  b[63] = COLOR_WHITE | PIECE_ROOK; // h1
  b[56] = COLOR_WHITE | PIECE_ROOK; // a1
  b[4] = COLOR_BLACK | PIECE_KING; // e8
  b[0] = COLOR_BLACK | PIECE_ROOK; // a8
  b[7] = COLOR_BLACK | PIECE_ROOK; // h8
  return b;
}

beforeEach(() => {
  setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
  resetRules();
});

afterEach(() => {
  setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
  resetRules();
});

describe('TT root hash', () => {
  test('sucht erneut, wenn sich nur die Rechte unterscheiden (kein TT-Leak)', async () => {
    const board = endgameBoard();

    // 1) Suche mit vollen Rochadenrechten — befuellt die prozessglobale TT.
    setRules({ castling: CR_ALL, ep: -1 });
    const erste = await createJsSearch({ personality: 'NORMAL' }).run(board, 'white', 4);
    expect(erste.nodes).toBeGreaterThan(50);

    // 2) Gleiches Brett, Rechte verloren (Konig ist gelaufen). Ein Root-Hash
    //    ohne Rechte ware ein TT-Treffer mit wenigen Knoten; korrekt ist eine
    //    echte neue Suche mit vergleichbarer Knotenzahl.
    setRules({ castling: 0, ep: -1 });
    const zweite = await createJsSearch({ personality: 'NORMAL' }).run(board, 'white', 4);
    expect(zweite.nodes).toBeGreaterThan(50);
    expect(zweite.nodes).toBeGreaterThan(erste.nodes * 0.5);

    // Und der zuruckgegebene Zug ist in der Rechte-0-Stellung legal.
    const legal = getAllLegalMoves(board, 'white');
    expect(
      legal.some(m => m.from === zweite.move?.from && m.to === zweite.move?.to)
    ).toBe(true);
  });

  test('EP-Ziel steht im Root-Hash (gleiches Brett, anderes EP-Ziel)', async () => {
    const board = new Int8Array(64);
    board[60] = COLOR_WHITE | PIECE_KING; // e1
    board[4] = COLOR_BLACK | PIECE_KING; // e8
    board[28] = COLOR_WHITE | PIECE_PAWN; // e5 (Bauer)
    board[27] = COLOR_BLACK | PIECE_PAWN; // d5 (Bauer, gerade doppelt gezogen)

    setRules({ castling: 0, ep: 19 }); // d6
    const mitEp = await createJsSearch({ personality: 'NORMAL' }).run(board, 'white', 4);
    expect(mitEp.nodes).toBeGreaterThan(50);

    setRules({ castling: 0, ep: -1 });
    const ohneEp = await createJsSearch({ personality: 'NORMAL' }).run(board, 'white', 4);
    expect(ohneEp.nodes).toBeGreaterThan(50);
    expect(ohneEp.nodes).toBeGreaterThan(mitEp.nodes * 0.5);
  });
});
