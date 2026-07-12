import {
  SQUARE_COUNT,
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
  PIECE_NIGHTRIDER,
  TYPE_MASK,
  COLOR_MASK,
  COLOR_WHITE,
  COLOR_BLACK,
  indexToRow,
  indexToCol,
} from './BoardDefinitions';
import type { Move, BoardStorage } from './MoveGenerator';
import {
  makeMove,
  isInCheck,
  see,
  getAllThreats,
  getXRayThreats,
  getDiscoveredAttackPotential,
} from './MoveGenerator';
import { getCurrentBoardShape, isBlockedSquare } from '../config.js';
// Order Constants
const HASH_MOVE_SCORE = 3000000;
const WINNING_CAPTURE_SCORE = 2000000; // MVV-LVA
const KILLER_MOVE_1_SCORE = 900000;
const KILLER_MOVE_2_SCORE = 800000;
const COUNTER_MOVE_SCORE = 700000;
const HISTORY_SCORE_MAX = 100000; // Cap
const PROMOTION_SCORE = 1500000;
const THREAT_CHECK_SCORE = 300000; // Bonus for moves that give check

// Move offsets (duplicated from MoveGenerator to avoid circular deps)

const KNIGHT_OFFSETS = [-19, -17, -11, -7, 7, 11, 17, 19];
const KING_OFFSETS = [-10, -9, -8, -1, 1, 8, 9, 10];
const BISHOP_OFFSETS = [-10, -8, 8, 10];
const ROOK_OFFSETS = [-9, 9, -1, 1];

function isValidSquare(idx: number): boolean {
  return idx >= 0 && idx < SQUARE_COUNT;
}

// Threat scoring constants
const THREAT_CAPTURE_HIGH_VALUE = 200000; // Attacking Queen/Rook/Archbishop/etc (value >= 500)
const THREAT_CAPTURE_MID_VALUE = 100000; // Attacking Knight/Bishop (value >= 300)
const THREAT_CAPTURE_LOW_VALUE = 50000; // Attacking Pawn
const THREAT_XRAY_HIGH = 80000; // Discovered attack on high-value piece
const THREAT_XRAY_MID = 40000; // Discovered attack on mid-value piece
const THREAT_DISCOVERED_CHECK = 150000; // Moving blocker reveals check
const THREAT_PIN_BREAK = 60000; // Breaking a pin (freeing own piece)
const THREAT_KING_SAFETY_PENALTY = -50000; // Move exposes own king to threat
const THREAT_HANGING_PIECE_BONUS = 100000; // Capturing a hanging piece (not defended)

// Piece values for threat evaluation
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
  [PIECE_NIGHTRIDER]: 600,
};

// Counter Move Table (Indexed by [prevMoveFrom][prevMoveTo] -> BestMove)
// Pack move {from, to} into Int16: (from << 8) | to
const counterMoveTable = new Int16Array(81 * 81);

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
  // Pre-compute threat data for the side to move
  // Determine side to move from first piece that moves (or from board)
  let sideToMoveColor = COLOR_WHITE;
  for (const move of moves) {
    const piece = board[move.from];
    if (piece !== PIECE_NONE) {
      sideToMoveColor = piece & COLOR_MASK;
      break;
    }
  }
  const opponentColor = sideToMoveColor === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;

  // Counter move lookup
  const counterMove = getCounterMove(prevMove);

  const scoredMoves = moves.map(move => {
    let score = 0;

    // Target square piece (needed for both capture logic and threat analysis)
    const target = board[move.to];

    // 1. TT Move
    if (areMovesEqual(move, ttMove)) {
      score = HASH_MOVE_SCORE;
    } else {
      // 2. Captures (MVV-LVA + SEE)
      if (target !== PIECE_NONE) {
        const victimVal = PIECE_VALUES[target & TYPE_MASK] || 0;
        const attackerVal = PIECE_VALUES[board[move.from] & TYPE_MASK] || 0;

        // MVV-LVA + SEE: penalize losing captures
        const seeScore = see(board, move);
        if (seeScore < 0) {
          score = WINNING_CAPTURE_SCORE + seeScore; // Use SEE score directly for losing captures
        } else {
          score = WINNING_CAPTURE_SCORE + victimVal * 10 - attackerVal;
        }

        // --- THREAT: Hanging piece bonus ---
        // Check if captured piece is defended
        const isDefended = isSquareAttacked(board, move.to, opponentColor);
        if (!isDefended && victimVal > 0) {
          score += THREAT_HANGING_PIECE_BONUS;
        }
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

    // --- THREAT ANALYSIS (only for non-captures and non-TT moves to avoid double-counting) ---
    const moverPiece = board[move.from];
    const moverColor = moverPiece & COLOR_MASK;
    if (moverColor !== 0 && target === PIECE_NONE) {
      // 6. Threat: Check if move gives check (direct or discovered)
      const boardCopy = new Int8Array(board);
      makeMove(boardCopy, move);
      if (isInCheck(boardCopy, opponentColor)) {
        score += THREAT_CHECK_SCORE;
      }

      // 7. Threat: Direct attacks on enemy pieces (non-captures that attack valuable pieces)
      // Check if this move creates a new attack on an enemy piece
      const moveThreats = getAllThreats(boardCopy, moverColor);
      for (const threat of moveThreats) {
        const victimVal = PIECE_VALUES[threat.targetType] || 0;
        if (threat.targetColor === opponentColor) {
          if (victimVal >= 500) {
            score += THREAT_CAPTURE_HIGH_VALUE;
          } else if (victimVal >= 300) {
            score += THREAT_CAPTURE_MID_VALUE;
          } else if (victimVal > 0) {
            score += THREAT_CAPTURE_LOW_VALUE;
          }
        }
      }

      // 8. Threat: Discovered attacks / X-ray threats
      // Check if moving this piece reveals an attack (discovered attack)
      const discoveredAttacks = getDiscoveredAttackPotential(board, moverColor);
      for (const da of discoveredAttacks) {
        if (da.blockerSquare === move.from) {
          // This move unblocks a discovered attack!
          const victimVal = PIECE_VALUES[da.xrayTargetType || 0] || 0;
          if (da.xrayTargetType === PIECE_KING) {
            score += THREAT_DISCOVERED_CHECK;
          } else if (victimVal >= 500) {
            score += THREAT_XRAY_HIGH;
          } else if (victimVal >= 300) {
            score += THREAT_XRAY_MID;
          }
        }
      }

      // 9. Threat: Breaking pins (moving a pinned piece)
      // Check if the from-square was blocking an attack on our king/queen
      const xrayThreats = getXRayThreats(board, moverColor);
      for (const xray of xrayThreats) {
        if (xray.blockerSquare === move.from && xray.xrayTargetType) {
          const victimVal = PIECE_VALUES[xray.xrayTargetType] || 0;
          if (xray.xrayTargetType === PIECE_KING) {
            // Moving a piece that was pinning to king - BAD (exposes king)
            // Actually this is already covered by isInCheck check above
          } else if (victimVal >= 500) {
            // We're breaking a pin on a valuable piece - good!
            score += THREAT_PIN_BREAK;
          }
        }
      }

      // 10. King Safety: Penalize moves that expose our own king to attack
      const ourKingSquare = findKing(boardCopy, moverColor);
      if (ourKingSquare >= 0 && isSquareAttacked(boardCopy, ourKingSquare, opponentColor)) {
        score += THREAT_KING_SAFETY_PENALTY;
      }
    }

    return { move, score };
  });

  // Sort desc
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves.map(sm => sm.move);
}

// Helper: check if a square is attacked by a given color
function isSquareAttacked(board: BoardStorage, square: number, byColor: number): boolean {
  // Quick pawn attacks
  const pawnForward = byColor === COLOR_WHITE ? -9 : 9;
  const pawnAttacks = [square - pawnForward - 1, square - pawnForward + 1];
  for (const from of pawnAttacks) {
    if (from >= 0 && from < SQUARE_COUNT && Math.abs(indexToCol(square) - indexToCol(from)) === 1) {
      const p = board[from];
      if (p !== PIECE_NONE && (p & COLOR_MASK) === byColor && (p & TYPE_MASK) === PIECE_PAWN) {
        return true;
      }
    }
  }

  // Knight attacks
  for (const offset of KNIGHT_OFFSETS) {
    const from = square + offset;
    if (!isValidSquare(from)) continue;
    if (Math.abs(indexToRow(square) - indexToRow(from)) > 2) continue;
    if (Math.abs(indexToCol(square) - indexToCol(from)) > 2) continue;
    const p = board[from];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === byColor) {
      const type = p & TYPE_MASK;
      if (
        type === PIECE_KNIGHT ||
        type === PIECE_ARCHBISHOP ||
        type === PIECE_CHANCELLOR ||
        type === PIECE_ANGEL
      ) {
        return true;
      }
    }
  }

  // King attacks
  for (const offset of KING_OFFSETS) {
    const from = square + offset;
    if (!isValidSquare(from)) continue;
    if (Math.abs(indexToRow(square) - indexToRow(from)) > 1) continue;
    const p = board[from];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === byColor && (p & TYPE_MASK) === PIECE_KING) {
      return true;
    }
  }

  // Sliding attacks
  const slidingOffsets = [...BISHOP_OFFSETS, ...ROOK_OFFSETS];
  for (const offset of slidingOffsets) {
    let curr = square;
    for (;;) {
      curr += offset;
      if (!isValidSquare(curr)) break;
      if (
        Math.abs(indexToRow(curr) - indexToRow(curr - offset)) > 1 ||
        Math.abs(indexToCol(curr) - indexToCol(curr - offset)) > 1
      )
        break;

      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(curr, shape)) break;

      const p = board[curr];
      if (p === PIECE_NONE) continue;
      if ((p & COLOR_MASK) === byColor) {
        const type = p & TYPE_MASK;
        // Bishop-like
        if (
          BISHOP_OFFSETS.includes(offset) &&
          (type === PIECE_BISHOP ||
            type === PIECE_QUEEN ||
            type === PIECE_ARCHBISHOP ||
            type === PIECE_ANGEL)
        ) {
          return true;
        }
        // Rook-like
        if (
          ROOK_OFFSETS.includes(offset) &&
          (type === PIECE_ROOK ||
            type === PIECE_QUEEN ||
            type === PIECE_CHANCELLOR ||
            type === PIECE_ANGEL)
        ) {
          return true;
        }
      }
      break; // Blocked by any piece
    }
  }

  // Nightrider attacks
  for (const offset of KNIGHT_OFFSETS) {
    let curr = square;
    for (;;) {
      curr += offset;
      if (!isValidSquare(curr)) break;
      const dr = Math.abs(indexToRow(curr) - indexToRow(curr - offset));
      const dc = Math.abs(indexToCol(curr) - indexToCol(curr - offset));
      if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) break;
      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(curr, shape)) break;

      const p = board[curr];
      if (p === PIECE_NONE) continue;
      if ((p & COLOR_MASK) === byColor && (p & TYPE_MASK) === PIECE_NIGHTRIDER) {
        return true;
      }
      break;
    }
  }

  return false;
}

// Helper: find king of given color
function findKing(board: BoardStorage, color: number): number {
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const p = board[i];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === color && (p & TYPE_MASK) === PIECE_KING) {
      return i;
    }
  }
  return -1;
}
