/**
 * verify-search-hash.ts — assert incremental childHash == computeZobristHash
 * on the post-move board, for random positions and random legal moves (9x9).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import {
  getAllLegalMoves,
  makeMove,
  setRules,
  resetRules,
  COLOR_WHITE,
  COLOR_BLACK,
} from '../js/ai/MoveGenerator.js';
import { computeZobristHash, zobristTable, sideToMoveValue, type Hash64 } from '../js/ai/transpositionTable.js';
import { TYPE_MASK, COLOR_MASK, PIECE_TYPE_INDEX } from '../js/ai/BoardDefinitions.js';

setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
resetRules();

const SIZE = 9;
const B = [5, 3, 4, 9, 8, 4, 3, 5, 7]; // back rank guess: R N B Q K B N R + extra
function startBoard(): Int8Array {
  const b = new Int8Array(SIZE * SIZE);
  for (let c = 0; c < SIZE; c++) {
    b[0 * SIZE + c] = COLOR_BLACK | B[c];
    b[1 * SIZE + c] = COLOR_BLACK | 1;
    b[7 * SIZE + c] = COLOR_WHITE | 1;
    b[8 * SIZE + c] = COLOR_WHITE | B[c];
  }
  return b;
}
function zobVal(piece: number, sq: number): [number, number] {
  const type = piece & TYPE_MASK;
  const color = piece & COLOR_MASK;
  const ti = PIECE_TYPE_INDEX[type];
  if (ti === -1) return [0, 0];
  return zobristTable[sq][ti][color === COLOR_WHITE ? 0 : 1];
}
// mirror of search.ts pure makeMoveHash (64-bit)
function makeMoveHash(b: Int8Array, move: any, hash: Hash64): Hash64 {
  let hLow = hash.low;
  let hHigh = hash.high;
  const piece = b[move.from];
  const [zl, zh] = zobVal(piece, move.from);
  hLow ^= zl;
  hHigh ^= zh;
  if (move.flags === 'ep') {
    const width = Math.sqrt(b.length) | 0;
    const victimSq = move.from + ((move.to % width) - (move.from % width));
    const victim = b[victimSq];
    if (victim !== 0) {
      const [vl, vh] = zobVal(victim, victimSq);
      hLow ^= vl;
      hHigh ^= vh;
    }
    const [pl, ph] = zobVal(piece, move.to);
    hLow ^= pl;
    hHigh ^= ph;
  } else {
    if (move.flags === 'castle-k' || move.flags === 'castle-q') {
      const rookFrom = move.flags === 'castle-k' ? move.from + 3 : move.from - 4;
      const rookTo = move.flags === 'castle-k' ? move.from + 1 : move.from - 1;
      const [rl1, rh1] = zobVal(b[rookFrom], rookFrom);
      hLow ^= rl1;
      hHigh ^= rh1;
      const [rl2, rh2] = zobVal(b[rookTo], rookTo);
      hLow ^= rl2;
      hHigh ^= rh2;
    }
    const newPiece = move.promotion ? (piece & COLOR_MASK) | (move.promotion & TYPE_MASK) : piece;
    const captured = b[move.to];
    if (captured !== 0) {
      const [cl, ch] = zobVal(captured, move.to);
      hLow ^= cl;
      hHigh ^= ch;
    }
    const [nl, nh] = zobVal(newPiece, move.to);
    hLow ^= nl;
    hHigh ^= nh;
  }
  hLow ^= sideToMoveValue[0];
  hHigh ^= sideToMoveValue[1];
  return { low: hLow, high: hHigh };
}

// multi-move sequence test
function seq(): void {
  let fails = 0, total = 0;
  // seedable RNG
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
  for (let trial = 0; trial < 200; trial++) {
    const b = startBoard();
    let side = trial % 2 === 0 ? COLOR_WHITE : COLOR_BLACK;
    setRules({ castling: 15, ep: -1 } as any);
    let legal = getAllLegalMoves(b, side === COLOR_WHITE ? 'white' : 'black');
    const initialHash = computeZobristHash(b, side);
    let hLow = initialHash.low;
    let hHigh = initialHash.high;
    const plies = 2 + Math.floor(rnd() * 6);
    for (let i = 0; i < plies && legal.length > 0; i++) {
      const mv = legal[Math.floor(rnd() * legal.length)];
      const child = makeMoveHash(b, mv, { low: hLow, high: hHigh });
      hLow = child.low;
      hHigh = child.high;
      makeMove(b, mv);
      total++;
      const opp = side === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
      const fullOk = computeZobristHash(b, opp);
      if (hLow !== fullOk.low || hHigh !== fullOk.high) {
        fails++;
        console.log(`MISMATCH trial=${trial} ply=${i} flags=${mv.flags} inc=${hLow},${hHigh} full=${fullOk.low},${fullOk.high}`);
        break;
      }
      side = opp;
      legal = getAllLegalMoves(b, side === COLOR_WHITE ? 'white' : 'black');
    }
  }
  console.log(`SEQ: ${total - fails}/${total} OK, ${fails} fails`);
}
seq();
