import {
  PIECE_NONE,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_CHANCELLOR,
  PIECE_ANGEL,
  TYPE_MASK,
  COLOR_MASK,
} from './BoardDefinitions';
import type { Move } from './MoveGenerator';
import { makeMove, isInCheck } from './MoveGenerator';

// Order Constants
const HASH_MOVE_SCORE = 3000000;
const WINNING_CAPTURE_SCORE = 2000000; // MVV-LVA
const KILLER_MOVE_1_SCORE = 900000;
const KILLER_MOVE_2_SCORE = 800000;
const COUNTER_MOVE_SCORE = 700000;
const HISTORY_SCORE_MAX = 100000; // Cap
const PROMOTION_SCORE = 1500000;
const THREAT_CHECK_SCORE = 300000; // Bonus for moves that give check

const PIECE_VALUES: Record<number, number> = {
  [PIECE_PAWN]: 100,
  [PIECE_KNIGHT]: 320,
  [PIECE_BISHOP]: 330,
  [PIECE_ROOK]: 500,
  [PIECE_QUEEN]: 900,
  [PIECE_KING]: 20000,
  [PIECE_ARCHBISHOP]: 600,
  [PIECE_CHANCELLOR]: 700,
  [PIECE_ANGEL]: 1000,
};

// Counter Move Table (Indexed by [prevMoveFrom][prevMoveTo] -> BestMove)
// Pack move {from, to} into Int16: (from << 8) | to
let counterMoveTable = new Int16Array(81 * 81);

export function clearMoveOrdering(): void {
  counterMoveTable.fill(0);
}

export function updateCounterMove(prevMove: Move | null, bestMove: Move | null): void {
  if (!prevMove || !bestMove) return;
  // prevMove: {from, to}
  // bestMove: {from, to}
  const idx = prevMove.from * 81 + prevMove.to;
  if (idx < counterMoveTable.length) {
    // Pack bestMove: (from << 8) | to
    counterMoveTable[idx] = (bestMove.from << 8) | bestMove.to;
  }
}

function getCounterMove(prevMove: Move | null): Move | null {
  if (!prevMove) return null;
  const idx = prevMove.from * 81 + prevMove.to;
  if (idx >= counterMoveTable.length || idx < 0) return null; // Safety check
  const packed = counterMoveTable[idx];
  if (packed === 0) return null;
  return { from: (packed >> 8) & 0xff, to: packed & 0xff };
}

function areMovesEqual(m1: Move | null, m2: Move | null): boolean {
  if (!m1 || !m2) return false;
  return m1.from === m2.from && m1.to === m2.to;
}

export function orderMoves(
  board: number[] | Int8Array,
  moves: Move[],
  ttMove: Move | null,
  killers: (Move | null)[] | null,
  history: Int32Array | null,
  prevMove: Move | null
): Move[] {
  // Basic score assignment
  // Map moves to { move, score }

  // Counter move lookup
  const counterMove = getCounterMove(prevMove);

  const scoredMoves = moves.map(move => {
    let score = 0;

    // 1. TT Move
    if (areMovesEqual(move, ttMove)) {
      score = HASH_MOVE_SCORE;
    } else {
      // 2. Captures (MVV-LVA + SEE)
      const target = board[move.to];
      if (target !== PIECE_NONE) {
        const victimVal = PIECE_VALUES[target & TYPE_MASK] || 0;
        const attackerVal = PIECE_VALUES[board[move.from] & TYPE_MASK] || 0;

        // MVV-LVA
        score = WINNING_CAPTURE_SCORE + victimVal * 10 - attackerVal;

        // SEE penalty if bad capture?
        // if (see(board, move) < 0) score -= 500000;
        // For speed, trust MVV-LVA for now.
      } else {
        // 3. Killer Moves
        if (killers) {
          if (areMovesEqual(move, killers[0])) score = KILLER_MOVE_1_SCORE;
          else if (areMovesEqual(move, killers[1])) score = KILLER_MOVE_2_SCORE;
        }

        // 4. Counter Move
        if (counterMove && areMovesEqual(move, counterMove)) {
          score = Math.max(score, COUNTER_MOVE_SCORE);
        }

        // 5. History
        if (history) {
          const hIdx = move.from * 81 + move.to;
          let hScore = history[hIdx] || 0;
          if (hScore > HISTORY_SCORE_MAX) hScore = HISTORY_SCORE_MAX;
          score += hScore;
        }
      }
    }

    // Promotion?
    if (move.flags === 'promotion') score += PROMOTION_SCORE;

    // 6. Threat: check if move gives check
    const moverPiece = board[move.from];
    const moverColor = moverPiece & COLOR_MASK;
    if (moverColor !== 0) {
      const opponentColor = moverColor ^ COLOR_MASK;
      // Copy board to avoid modifying original
      const boardCopy = new Int8Array(board);
      makeMove(boardCopy, move);
      if (isInCheck(boardCopy, opponentColor)) {
        score += THREAT_CHECK_SCORE;
      }
    }

    return { move, score };
  });

  // Sort desc
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves.map(sm => sm.move);
}