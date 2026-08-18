/**
 * repro-debug.ts — fokussierter Debugger für einen einzelnen badMove-Fall.
 * Sammelt den ersten konkreten illegalen from/to-Zug und loggt das Brett
 * präzise (Länge, from/to-Werte, Inhalt an from/to, turn, Gültigkeitsbereich),
 * damit der Root-Cause nicht mehr geraten werden muss.
 */

import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
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

const SIZE = 8;

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
  setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
  setRules({ castling: CR_ALL, ep: -1 });
  const depth = 6;
  for (let i = 0; i < 5000; i++) {
    const b = randBoard();
    const turn = turnOf();
    const before = b.slice();
    const search = createJsSearch({ personality: 'NORMAL' });
    const res = await search.run(b, turn, depth, { ...getRules() });
    if (!res.move) continue;
    const legal = getAllLegalMoves(b, turn);
    if (legal.length === 0) continue;
    const ok = legal.some(
      (m) => m.from === res.move!.from && m.to === res.move!.to && (m.promotion ?? 0) === (res.move!.promotion ?? 0)
    );
    if (ok) continue;
    // BADMOVE gefunden — präzise ausgeben und abbrechen.
    const f = res.move.from;
    const t = res.move.to;
    console.log('FIRST BADMOVE:');
    console.log('  depth=' + depth + ' turn=' + turn);
    console.log('  move=' + JSON.stringify(res.move) + ' score=' + res.score);
    console.log('  from=' + f + ' to=' + t);
    console.log('  fromInRange=' + (f >= 0 && f < 64) + ' toInRange=' + (t >= 0 && t < 64));
    console.log('  beforeLen=' + before.length);
    console.log('  before[from]=' + before[f] + ' before[to]=' + before[t]);
    console.log('  turnColor=' + (turn === 'white' ? COLOR_WHITE : COLOR_BLACK));
    console.log('  fromHasOwnPiece=' + ((before[f] & 48) === (turn === 'white' ? COLOR_WHITE : COLOR_BLACK)));
    console.log('  legalMoves(first 10)=' + JSON.stringify(legal.slice(0, 10).map((m) => ({ f: m.from, t: m.to }))));
    console.log('  fullBefore=' + Array.from(before).join(','));
    const directlyLegal = legal.some((m) => m.from === res.move!.from && m.to === res.move!.to);
    console.log('  directlyLegal(just from/to)=' + directlyLegal);
    const withPromo = legal.some(
      (m) => m.from === res.move!.from && m.to === res.move!.to && (m.promotion ?? 0) === (res.move!.promotion ?? 0)
    );
    console.log('  withPromoCheck=' + withPromo);
    console.log('  res.move.promotion=' + JSON.stringify(res.move.promotion));
    console.log('  sampleLegalPromo=' + JSON.stringify(legal.slice(0, 3).map((m) => m.promotion)));
    return;
  }
  console.log('no badmove found in 5000 tries');
}

main().catch((e) => {
  console.error('REPRO ERROR', e);
  process.exit(1);
});
