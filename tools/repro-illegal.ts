/**
 * repro-illegal.ts (v2) — deterministischer Reproducer für illegal-ours.
 *
 * Setzt das EXAKTE Benchmark-Setup (setBoardVariant standard8x8 + createJsSearch
 * + search.run mit rules). Prüft auf Zufalls-Positionen:
 *   1. gibt die Engine einen konkreten from/to-Zug zurück, der NICHT in der
 *      legalen Liste steht?  -> echter illegaler Zug (Bug)
 *   2. gibt die Engine null zurück, obwohl legale Züge existieren? -> Bug
 *   3. verlässt search.run das übergebene Brett in mutiertem Zustand? -> Bug
 *      (Restauration verletzt)
 *
 * Zufalls-Bretter mit Schachmatt/Remis (legalMoves===0) sind KEIN Bug, wenn
 * die Engine null liefert.
 */

import { setBoardVariant, BOARD_VARIANTS, getCurrentBoardSize } from '../js/config.js';
import { createJsSearch } from '../js/search.js';
import {
  getAllLegalMoves,
  setRules,
  getRules,
  CR_ALL,
} from '../js/ai/MoveGenerator.js';
import {
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_KING,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
} from '../js/ai/BoardDefinitions.js';

const SIZE = getCurrentBoardSize();

function randBoard(): Int8Array {
  const b = new Int8Array(SIZE * SIZE);
  const pieces = [
    PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN,
    PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN,
    PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP,
  ];
  const occupied = new Set<number>();
  const place = (sq: number, color: number, type: number) => {
    b[sq] = color | type;
    occupied.add(sq);
  };
  place(0, COLOR_WHITE, PIECE_KING);
  place(63, COLOR_BLACK, PIECE_KING);
  for (let i = 0; i < pieces.length; i++) {
    let sq = Math.floor(Math.random() * (SIZE * SIZE));
    let guard = 0;
    while (occupied.has(sq) && guard++ < 50) sq = Math.floor(Math.random() * (SIZE * SIZE));
    if (occupied.has(sq)) continue;
    const color = Math.random() < 0.5 ? COLOR_WHITE : COLOR_BLACK;
    place(sq, color, pieces[i]!);
  }
  return b;
}

function turnOf(): 'white' | 'black' {
  return Math.random() < 0.5 ? 'white' : 'black';
}

async function main() {
  setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
  setRules({ castling: CR_ALL, ep: -1 });

  const depths = [4, 5, 6];
  const N = 300;

  for (const depth of depths) {
    let badMove = 0;     // concrete from/to not in legal list
    let badNull = 0;      // null but legal moves exist
    let badRestore = 0;   // board not restored after run()
    const examples: string[] = [];
    for (let i = 0; i < N; i++) {
      const b = randBoard();
      const turn = turnOf();
      const before = b.slice();
      const search = createJsSearch({ personality: 'NORMAL' });
      const res = await search.run(b, turn, depth, { ...getRules() });
      // Restauration: Brett muss nach run() mit vorher identisch sein.
      let restored = true;
      for (let k = 0; k < b.length; k++) if (b[k] !== before[k]) { restored = false; break; }
      if (!restored) {
        badRestore++;
        if (examples.length < 3) examples.push(`RESTORE depth=${depth} turn=${turn} move=${JSON.stringify(res.move)}`);
      }
      const legal = getAllLegalMoves(b, turn);
      if (legal.length === 0) continue; // mate/stalemate => null is correct
      if (!res.move) {
        badNull++;
        if (examples.length < 3) examples.push(`NULLBUTLEGAL depth=${depth} turn=${turn} legalCount=${legal.length}`);
        continue;
      }
      const ok = legal.some(
        (m) => m.from === res.move!.from && m.to === res.move!.to
      );
      if (!ok) {
        badMove++;
        if (examples.length < 3) {
          examples.push(
            `BADMOVE depth=${depth} turn=${turn} move=${JSON.stringify(res.move)} ` +
            `score=${res.score} fromPiece=${before[res.move.from]} board=${Array.from(before).join(',')}`
          );
        }
      }
    }
    console.log(`[depth ${depth}] badMove=${badMove} badNull=${badNull} badRestore=${badRestore} / ${N}`);
    for (const ex of examples) console.log('  ' + ex);
  }
  console.log('DONE');
}

main().catch((e) => {
  console.error('REPRO ERROR', e);
  process.exit(1);
});
