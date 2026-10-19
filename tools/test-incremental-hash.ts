/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * test-incremental-hash.ts — verify M1.1 incremental Zobrist hash matches
 * the full recompute (computeZobristHash) after make+undo and after move sequences.
 */

import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import {
  getAllLegalMoves,
  makeMove,
  setRules,
  CR_ALL,
  COLOR_WHITE,
  COLOR_BLACK,
} from '../js/ai/MoveGenerator.js';
import {
  computeZobristHash,
  zobristTable,
  sideToMoveValue,
  type Hash64,
} from '../js/ai/transpositionTable.js';
import {
  TYPE_MASK,
  COLOR_MASK,
  PIECE_TYPE_INDEX,
} from '../js/ai/BoardDefinitions.js';

setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);

function zobVal(piece: number, sq: number): [number, number] {
  const type = piece & TYPE_MASK;
  const color = piece & COLOR_MASK;
  const ti = PIECE_TYPE_INDEX[type];
  if (ti === -1) return [0, 0];
  return zobristTable[sq][ti][color === COLOR_WHITE ? 0 : 1];
}

// Incremental hash after a sequence of moves — mirrors search.ts makeMoveHash.
function incrementalHash(startBoard: Int8Array, moves: any[], startSide: number): { hash: Hash64; board: Int8Array; side: number } {
  const bb = startBoard.slice();
  const initialHash = computeZobristHash(bb, startSide);
  let hashLow = initialHash.low;
  let hashHigh = initialHash.high;
  let side = startSide;
  for (const mv of moves) {
    const piece = bb[mv.from];
    const [zl, zh] = zobVal(piece, mv.from);
    hashLow ^= zl;
    hashHigh ^= zh;
    if (mv.flags === 'ep') {
      // EP victim sits on the mover's rank, victim's file = destination file.
      const width = Math.sqrt(bb.length) | 0;
      const victimSq = mv.from + ((mv.to % width) - (mv.from % width));
      const victim = bb[victimSq];
      if (victim !== 0) {
        const [vl, vh] = zobVal(victim, victimSq);
        hashLow ^= vl;
        hashHigh ^= vh;
      }
      const [pl, ph] = zobVal(piece, mv.to);
      hashLow ^= pl;
      hashHigh ^= ph;
      makeMove(bb, mv);
    } else {
      if (mv.flags === 'castle-k' || mv.flags === 'castle-q') {
        const rookFrom = mv.flags === 'castle-k' ? mv.from + 3 : mv.from - 4;
        const rookTo = mv.flags === 'castle-k' ? mv.from + 1 : mv.from - 1;
        const [rl1, rh1] = zobVal(bb[rookFrom], rookFrom);
        hashLow ^= rl1;
        hashHigh ^= rh1;
        const [rl2, rh2] = zobVal(bb[rookTo], rookTo);
        hashLow ^= rl2;
        hashHigh ^= rh2;
      }
      const newPiece = mv.promotion ? (piece & COLOR_MASK) | (mv.promotion & TYPE_MASK) : piece;
      const captured = bb[mv.to];
      if (captured !== 0) {
        const [cl, ch] = zobVal(captured, mv.to);
        hashLow ^= cl;
        hashHigh ^= ch;
      }
      const [nl, nh] = zobVal(newPiece, mv.to);
      hashLow ^= nl;
      hashHigh ^= nh;
      makeMove(bb, mv);
    }
    hashLow ^= sideToMoveValue[0];
    hashHigh ^= sideToMoveValue[1];
    side = side === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
  }
  return { hash: { low: hashLow, high: hashHigh }, board: bb, side };
}

function initialBoard8x8(): Int8Array {
  const SIZE = 8;
  const b = new Int8Array(SIZE * SIZE);
  const B = [5, 3, 4, 8, 6, 4, 3, 5]; // R N B Q K B N R
  for (let c = 0; c < SIZE; c++) {
    b[0 * SIZE + c] = COLOR_BLACK | B[c]!;
    b[1 * SIZE + c] = COLOR_BLACK | 1;
    b[6 * SIZE + c] = COLOR_WHITE | 1;
    b[7 * SIZE + c] = COLOR_WHITE | B[c]!;
  }
  return b;
}

function main() {
  let fails = 0;
  let tests = 0;
  for (let t = 0; t < 300; t++) {
    const board = initialBoard8x8();
    setRules({ castling: CR_ALL, ep: -1 });
    let turn: 'white' | 'black' = 'white';
    const moves: any[] = [];
    const plies = 2 + Math.floor(Math.random() * 25);
    for (let p = 0; p < plies; p++) {
      const legal = getAllLegalMoves(board, turn);
      if (legal.length === 0) break;
      const mv = legal[Math.floor(Math.random() * legal.length)];
      moves.push(mv);
      makeMove(board, mv);
      turn = turn === 'white' ? 'black' : 'white';
    }
    const fresh = initialBoard8x8();
    setRules({ castling: CR_ALL, ep: -1 });
    const inc = incrementalHash(fresh, moves, COLOR_WHITE);
    const full = computeZobristHash(inc.board, inc.side);
    tests++;
    if (inc.hash.low !== full.low || inc.hash.high !== full.high) {
      fails++;
      if (fails <= 3) {
        console.log(`!!! trial ${t} MISMATCH inc=${inc.hash.low},${inc.hash.high} full=${full.low},${full.high} plies=${moves.length}`);
      }
    }
  }
  console.log(`HASH TEST: ${tests - fails}/${tests} passed, ${fails} failed`);
  if (fails > 0) process.exit(1);
  console.log('DONE');
}

main();
