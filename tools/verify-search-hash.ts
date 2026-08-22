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
import { computeZobristHash, zobristTable, sideToMoveValue } from '../js/ai/transpositionTable.js';
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
function zobVal(piece: number, sq: number): number {
  const type = piece & TYPE_MASK;
  const color = piece & COLOR_MASK;
  const ti = PIECE_TYPE_INDEX[type];
  if (ti === -1) return 0;
  return zobristTable[sq][ti][color === COLOR_WHITE ? 0 : 1];
}
// mirror of search.ts pure makeMoveHash
function makeMoveHash(b: Int8Array, move: any, hash: number): number {
  let h = hash;
  const piece = b[move.from];
  h ^= zobVal(piece, move.from);
  if (move.flags === 'ep') {
    const width = Math.sqrt(b.length) | 0;
    const victimSq = move.from + ((move.to % width) - (move.from % width));
    const victim = b[victimSq];
    if (victim !== 0) h ^= zobVal(victim, victimSq);
    h ^= zobVal(piece, move.to);
  } else {
    if (move.flags === 'castle-k' || move.flags === 'castle-q') {
      const rookFrom = move.flags === 'castle-k' ? move.from + 3 : move.from - 4;
      const rookTo = move.flags === 'castle-k' ? move.from + 1 : move.from - 1;
      h ^= zobVal(b[rookFrom], rookFrom);
      h ^= zobVal(b[rookTo], rookTo);
    }
    const newPiece = move.promotion ? (piece & COLOR_MASK) | (move.promotion & TYPE_MASK) : piece;
    const captured = b[move.to];
    if (captured !== 0) h ^= zobVal(captured, move.to);
    h ^= zobVal(newPiece, move.to);
  }
  h ^= sideToMoveValue;
  return h;
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
    let h = computeZobristHash(b, side);
    const plies = 2 + Math.floor(rnd() * 6);
    for (let i = 0; i < plies && legal.length > 0; i++) {
      const mv = legal[Math.floor(rnd() * legal.length)];
      const child = makeMoveHash(b, mv, h);
      makeMove(b, mv);
      total++;
      const opp = side === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
      const fullOk = computeZobristHash(b, opp);
      if (child !== fullOk) {
        fails++;
        console.log(`MISMATCH trial=${trial} ply=${i} flags=${mv.flags} inc=${child} full=${fullOk}`);
        break;
      }
      h = child;
      side = opp;
      legal = getAllLegalMoves(b, side === COLOR_WHITE ? 'white' : 'black');
    }
  }
  console.log(`SEQ: ${total - fails}/${total} OK, ${fails} fails`);
}
seq();
