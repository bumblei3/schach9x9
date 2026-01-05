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
  TYPE_MASK
} from './BoardDefinitions.js';

// import { see } from './MoveGenerator.js';

// Order Constants
const HASH_MOVE_SCORE = 3000000;
const WINNING_CAPTURE_SCORE = 2000000; // MVV-LVA
const KILLER_MOVE_1_SCORE = 900000;
const KILLER_MOVE_2_SCORE = 800000;
const COUNTER_MOVE_SCORE = 700000;
const HISTORY_SCORE_MAX = 100000; // Cap
// const PROMOTION_SCORE = 1500000;

const PIECE_VALUES = {
  [PIECE_PAWN]: 100,
  [PIECE_KNIGHT]: 320,
  [PIECE_BISHOP]: 330,
  [PIECE_ROOK]: 500,
  [PIECE_QUEEN]: 900,
  [PIECE_KING]: 20000,
  [PIECE_ARCHBISHOP]: 600,
  [PIECE_CHANCELLOR]: 700,
  [PIECE_ANGEL]: 1000
};

// Counter Move Table (Indexed by [prevMoveTo][prevMovePieceType] -> BestMove)
// Or simple [prevTo][currTo]? 
// Old logic: updateCounterMove(prevMove, bestMove).
// let counterMoveTable = new Int32Array(SQUARE_COUNT * SQUARE_COUNT); // ?
// Let's use a simpler structure or Map for now.
// For Grand Refactor speed, fixed array is best.
// Index by 'prevMove.to' (0-80). Store 'bestMove' (packed int).
// This is "Last move reply". 
// A full [from][to] table is too big? 81*81 = 6561. Small!
// We can track [prevMove.to] -> responseMove. (1D array).
// Or [prevMove.from][prevMove.to]? (6561 * 2 bytes). 13KB. Easy.

const counterMoveTable = new Int16Array(81 * 81); // Pack move {from, to} into Int16

export function clearMoveOrdering() {
  counterMoveTable.fill(0);
}

export function updateCounterMove(prevMove, bestMove) {
  if (!prevMove || !bestMove) return;
  // prevMove: {from, to}
  // bestMove: {from, to}
  const idx = prevMove.from * 81 + prevMove.to;
  if (idx < counterMoveTable.length) {
    // Pack bestMove: (from << 8) | to
    counterMoveTable[idx] = (bestMove.from << 8) | bestMove.to;
  }
}

function getCounterMove(prevMove) {
  if (!prevMove) return null;
  const idx = prevMove.from * 81 + prevMove.to;
  const packed = counterMoveTable[idx];
  if (packed === 0) return null;
  return { from: (packed >> 8) & 0xFF, to: packed & 0xFF };
}

function areMovesEqual(m1, m2) {
  if (!m1 || !m2) return false;
  return m1.from === m2.from && m1.to === m2.to;
}

export function orderMoves(board, moves, ttMove, killers, history, prevMove) {
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
        score = WINNING_CAPTURE_SCORE + (victimVal * 10) - attackerVal;

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
    // if (move.flags === 'promotion') score += PROMOTION_SCORE;

    return { move, score };
  });

  // Sort desc
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves.map(sm => sm.move);
}
