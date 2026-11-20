/**
 * Regelzustand fuer die Integer-Engine (Rochade + en passant).
 *
 * `MoveGenerator` haelt castling/ep in Modul-Globalzustand. Jede Suche muss
 * den Zustand ihrer eigenen Stellung installieren — darum wird er aus der
 * UI-Stellung abgeleitet und mit der Anfrage mitgegeben.
 *
 * Bewusst ein eigenes Modul (nicht Teil von `aiEngine.ts`): Test-Mocks fuer
 * `aiEngine` sollen nicht diesen reinen Helfer zwingen zu hoeren.
 */
import type { Piece, Square } from '../types/core.js';
import { CR_WK, CR_WQ, CR_BK, CR_BQ, type RuleState } from './MoveGenerator.js';

export type { RuleState } from './MoveGenerator.js';

export type UiBoard = (Piece | null)[][];

export interface LastMoveInput {
  piece: Piece;
  to: Square;
  isDoublePawnPush?: boolean;
}

/**
 * Leitet die Rochadenrechte (nur 8×8) und das en-passant-Ziel aus einer
 * UI-Stellung ab. `hasMoved` liegt an den Piece-Objekten, das EP-Ziel aus
 * dem letzten Zug.
 */
export function rulesFromPosition(board: UiBoard, lastMove?: LastMoveInput | null): RuleState {
  const size = board.length;
  let castling = 0;
  if (size === 8) {
    const wk = board[7][4];
    const wh = board[7][7];
    const wa = board[7][0];
    const bk = board[0][4];
    const bh = board[0][7];
    const ba = board[0][0];
    if (wk && wk.type === 'k' && wk.color === 'white' && !wk.hasMoved) {
      if (wh && wh.type === 'r' && wh.color === 'white' && !wh.hasMoved) castling |= CR_WK;
      if (wa && wa.type === 'r' && wa.color === 'white' && !wa.hasMoved) castling |= CR_WQ;
    }
    if (bk && bk.type === 'k' && bk.color === 'black' && !bk.hasMoved) {
      if (bh && bh.type === 'r' && bh.color === 'black' && !bh.hasMoved) castling |= CR_BK;
      if (ba && ba.type === 'r' && ba.color === 'black' && !ba.hasMoved) castling |= CR_BQ;
    }
  }
  let ep = -1;
  if (lastMove && lastMove.isDoublePawnPush && lastMove.piece.type === 'p') {
    const skippedRow = lastMove.piece.color === 'white' ? lastMove.to.r + 1 : lastMove.to.r - 1;
    if (skippedRow >= 0 && skippedRow < size) {
      ep = skippedRow * size + lastMove.to.c;
    }
  }
  return { castling, ep };
}
