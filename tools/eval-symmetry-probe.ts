 
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import { resetRules } from '../js/ai/MoveGenerator.js';
import { evaluate } from '../js/evaluate.js';
import {
  COLOR_WHITE, COLOR_BLACK, PIECE_KING, PIECE_QUEEN, PIECE_ROOK,
  PIECE_BISHOP, PIECE_KNIGHT, PIECE_PAWN, BOARD_SIZE, TYPE_MASK, COLOR_MASK,
} from '../js/ai/BoardDefinitions.js';

setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
resetRules();
function emptyBoard(): Int8Array { return new Int8Array(BOARD_SIZE * BOARD_SIZE).fill(0); }
function place(b: Int8Array, r: number, c: number, color: number, type: number): void {
  b[r * BOARD_SIZE + c] = color | type;
}
function symmetricStart(): Int8Array {
  const b = emptyBoard();
  const back = [PIECE_ROOK, PIECE_KNIGHT, PIECE_BISHOP, PIECE_QUEEN, PIECE_KING, PIECE_BISHOP, PIECE_KNIGHT, PIECE_ROOK, PIECE_QUEEN];
  for (let c = 0; c < 9; c++) {
    place(b, 0, c, COLOR_BLACK, back[c]!);
    place(b, 1, c, COLOR_BLACK, PIECE_PAWN);
    place(b, 7, c, COLOR_WHITE, PIECE_PAWN);
    place(b, 8, c, COLOR_WHITE, back[c]!);
  }
  return b;
}
function mirror(b: Int8Array): Int8Array {
  const m = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = b[r * BOARD_SIZE + c];
      if (p === 0) continue;
      const type = p & TYPE_MASK;
      const col = p & COLOR_MASK;
      const newCol = col === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
      m[(BOARD_SIZE - 1 - r) * BOARD_SIZE + c] = newCol | type;
    }
  return m;
}
const pos = symmetricStart();
const mir = mirror(pos);
const eW = evaluate(pos, COLOR_WHITE);
const eB = evaluate(mir, COLOR_BLACK);
console.log(`evaluate(pos,W)=${eW} evaluate(mirror,B)=${eB} sum=${eW + eB}`);
console.log(`evaluate(pos,B)=${evaluate(pos, COLOR_BLACK)} evaluate(mirror,W)=${evaluate(mir, COLOR_WHITE)}`);
