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
} from '../js/ai/transpositionTable.js';
import {
  TYPE_MASK,
  COLOR_MASK,
  PIECE_TYPE_INDEX,
} from '../js/ai/BoardDefinitions.js';

setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);

function zobVal(piece: number, sq: number): number {
  const type = piece & TYPE_MASK;
  const color = piece & COLOR_MASK;
  const ti = PIECE_TYPE_INDEX[type];
  if (ti === -1) return 0;
  return zobristTable[sq][ti][color === COLOR_WHITE ? 0 : 1];
}

// Incremental hash after a sequence of moves — mirrors search.ts makeMoveHash.
function incrementalHash(startBoard: Int8Array, moves: any[], startSide: number): { hash: number; board: Int8Array; side: number } {
  const bb = startBoard.slice();
  let hash = computeZobristHash(bb, startSide);
  let side = startSide;
  for (const mv of moves) {
    const piece = bb[mv.from];
    hash ^= zobVal(piece, mv.from);
    if (mv.flags === 'ep') {
      const undo = makeMove(bb, mv);
      if (undo.epVictimSq >= 0) hash ^= zobVal(undo.epVictimPiece, undo.epVictimSq);
    } else {
      if (mv.flags === 'castle-k' || mv.flags === 'castle-q') {
        const rookFrom = mv.flags === 'castle-k' ? mv.from + 3 : mv.from - 4;
        const rookTo = mv.flags === 'castle-k' ? mv.from + 1 : mv.from - 1;
        hash ^= zobVal(bb[rookFrom], rookFrom);
        hash ^= zobVal(bb[rookTo], rookTo);
      }
      const newPiece = mv.promotion ? (piece & COLOR_MASK) | (mv.promotion & TYPE_MASK) : piece;
      const captured = bb[mv.to];
      if (captured !== 0) hash ^= zobVal(captured, mv.to);
      hash ^= zobVal(newPiece, mv.to);
      makeMove(bb, mv);
    }
    hash ^= sideToMoveValue;
    side = side === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
  }
  return { hash, board: bb, side };
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
    if (inc.hash !== full) {
      fails++;
      if (fails <= 3) {
        console.log(`!!! trial ${t} MISMATCH inc=${inc.hash} full=${full} plies=${moves.length}`);
      }
    }
  }
  console.log(`HASH TEST: ${tests - fails}/${tests} passed, ${fails} failed`);
  if (fails > 0) process.exit(1);
  console.log('DONE');
}

main();
