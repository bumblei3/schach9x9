import { AI_PIECE_VALUES } from '../config.js';
import { countMobility } from './MoveGenerator.js';

// Piece-Square Tables (PST) for 9x9 board.
// Values are from White's perspective. For Black, rows are mirrored.
export const PST = {
  // Pawn
  p: [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, // R0
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50, // R1
    10,
    10,
    20,
    30,
    30,
    30,
    20,
    10,
    10, // R2
    5,
    5,
    10,
    25,
    25,
    25,
    10,
    5,
    5, // R3
    0,
    0,
    0,
    20,
    25,
    20,
    0,
    0,
    0, // R4
    5,
    -5,
    -10,
    0,
    10,
    0,
    -10,
    -5,
    5, // R5
    5,
    10,
    10,
    -20,
    -20,
    -20,
    10,
    10,
    5, // R6
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, // R7
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, // R8
  ],
  // Knight
  n: [
    -50, -40, -30, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15,
    15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 20, 15, 5, -30, -30, 0, 15, 20, 25, 20, 15, 0, -30, -30,
    5, 15, 20, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 15, 10, 0, -30, -40, -20, 0, 5, 5, 5, 0, -20,
    -40, -50, -40, -30, -30, -30, -30, -30, -40, -50,
  ],
  // Bishop
  b: [
    -20, -10, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10,
    10, 5, 0, -10, -10, 5, 5, 10, 10, 10, 5, 5, -10, -10, 0, 10, 10, 15, 10, 10, 0, -10, -10, 10,
    10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 0, 5, -10, -10, 0, 0, 0, 0, 0, 0, 0, -10, -20,
    -10, -10, -10, -10, -10, -10, -10, -20,
  ],
  // Rook
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, 0, -5, -5, 0,
    0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, 0, -5, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  // Queen
  q: [
    -20, -10, -10, -5, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 5,
    0, -10, -5, 0, 5, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 5, 0, -5,
    -10, 0, 5, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -5, -10,
    -10, -20,
  ],
  // King
  k: [
    -30, -40, -40, -50, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -50, -40, -40, -30, -30,
    -40, -40, -50, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -50, -40, -40, -30, -30, -40,
    -40, -50, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -50, -40, -40, -30, -20, -30, -30,
    -40, -40, -40, -30, -30, -20, 20, 20, 0, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 0, 10, 30, 20,
  ],
  // Archbishop
  a: [
    -20, -15, -10, -10, -10, -10, -10, -15, -20, -15, -5, 0, 0, 0, 0, 0, -5, -15, -10, 0, 10, 15,
    15, 15, 10, 0, -10, -10, 5, 15, 20, 20, 20, 15, 5, -10, -10, 0, 15, 20, 25, 20, 15, 0, -10, -10,
    5, 15, 20, 20, 20, 15, 5, -10, -10, 0, 10, 15, 15, 15, 10, 0, -10, -15, -5, 0, 5, 5, 5, 0, -5,
    -15, -20, -15, -10, -10, -10, -10, -10, -15, -20,
  ],
  // Chancellor
  c: [
    -10, -5, 0, 5, 5, 5, 0, -5, -10, -5, 5, 10, 10, 10, 10, 10, 5, -5, 0, 10, 15, 20, 20, 20, 15,
    10, 0, 5, 10, 20, 25, 25, 25, 20, 10, 5, 5, 10, 20, 25, 30, 25, 20, 10, 5, 5, 10, 20, 25, 25,
    25, 20, 10, 5, 0, 10, 15, 20, 20, 20, 15, 10, 0, -5, 5, 10, 10, 10, 10, 10, 5, -5, -10, -5, 0,
    5, 5, 5, 0, -5, -10,
  ],
  // Angel
  e: [
    -20, -15, -10, -10, -10, -10, -10, -15, -20, -15, 0, 5, 10, 10, 10, 5, 0, -15, -10, 5, 15, 20,
    20, 20, 15, 5, -10, -10, 10, 20, 30, 30, 30, 20, 10, -10, -10, 10, 20, 30, 40, 30, 20, 10, -10,
    -10, 10, 20, 30, 30, 30, 20, 10, -10, -10, 5, 15, 20, 20, 20, 15, 5, -10, -15, 0, 5, 10, 10, 10,
    5, 0, -15, -20, -15, -10, -10, -10, -10, -10, -15, -20,
  ],
};

// Piece-Square Tables for 8x8 (Standard Chess)
export const PST_8 = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
    10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
    -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
    0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
    5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0,
    5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0,
    0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
    -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
    -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
    10, 30, 20,
  ],
};

// Endgame Piece-Square Tables (PST)
export const PST_EG = {
  k: [
    -50, -40, -30, -20, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, 0, -10, -20, -30, -30, -10,
    10, 20, 20, 20, 10, -10, -30, -30, 0, 20, 30, 30, 30, 20, 0, -30, -30, 0, 20, 30, 40, 30, 20, 0,
    -30, -30, 0, 20, 30, 30, 30, 20, 0, -30, -30, -10, 10, 20, 20, 20, 10, -10, -30, -30, -20, -10,
    0, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -20, -30, -40, -50,
  ],
};

// Endgame PST for 8x8 (Standard Chess)
export const PST_EG_8 = {
  k: [
    -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30,
    30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30,
    -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30,
    -30, -50,
  ],
};

// Reuse arrays to avoid allocation
// Reuse arrays to avoid allocation (assuming max size 9)
const pawnColumnsWhite = new Int8Array(9);
const pawnColumnsBlack = new Int8Array(9);

/**
 * Evaluate board position with advanced heuristics
 * @param {Array<Array<Object>>} board - The game board
 * @param {string} forColor - Perspective color ('white' or 'black')
 * @returns {number} Score in centipawns
 */
export function evaluatePosition(board, forColor, config) {
  /* Personality Config */
  const {
    mobilityWeight = 1.0,
    safetyWeight = 1.0,
    pawnStructureWeight = 1.0,
    centerControlWeight = 1.0,
  } = config || {};

  let mgScore = 0;
  let egScore = 0;

  // Reset static arrays for pawn structure
  pawnColumnsWhite.fill(0);
  pawnColumnsBlack.fill(0);

  // Total material for phase calculation (excluding pawns and kings)
  const PHASE_VALUES = { n: 1, b: 1, r: 2, q: 4, a: 3, c: 3, e: 4 };
  let totalPhase = 0;

  let whiteBishops = 0;
  let blackBishops = 0;

  // Track rook positions for connected rook bonus
  const whiteRooks = [];
  const blackRooks = [];

  // Track material and king positions for endgame mop-up
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whiteKingPos = null;
  let blackKingPos = null;

  // Tempo bonus: Small advantage for having the move
  const TEMPO_BONUS = 10;
  mgScore += TEMPO_BONUS; // Side to move (forColor) gets tempo
  egScore += TEMPO_BONUS / 2;

  // First pass: collect pieces and basic material/pst/mobility
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const pieceValue = AI_PIECE_VALUES[piece.type] || 0;
      const mgBonus = getPositionBonus(r, c, piece.type, piece.color, size, false);
      const egBonus = getPositionBonus(r, c, piece.type, piece.color, size, true);

      const isWhite = piece.color === 'white';
      const sideMult = isWhite ? 1 : -1;

      // Center Control Bonus (scaled for board size)
      const centerStart = Math.floor(size / 3);
      const centerEnd = size - centerStart - 1;
      if (r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd) {
        const centerBonus = 10 * centerControlWeight;
        mgScore += centerBonus * sideMult;
        egScore += centerBonus * sideMult;
      }

      mgScore += (pieceValue + mgBonus) * sideMult;
      egScore += (pieceValue + egBonus) * sideMult;

      // Mobility (only for non-pawn/king)
      if (piece.type !== 'p' && piece.type !== 'k') {
        const mobility = countMobility(board, r, c, piece);
        const mobBonus = mobility * 2 * mobilityWeight;
        mgScore += mobBonus * sideMult;
        egScore += mobBonus * sideMult;

        // Phase contribution
        totalPhase += PHASE_VALUES[piece.type] || 0;

        // Count bishops for pair bonus
        if (piece.type === 'b') {
          if (isWhite) whiteBishops++;
          else blackBishops++;
        }

        // Rook on open/semi-open file + track positions
        if (piece.type === 'r') {
          const fileBonus = evaluateRookFile(c, isWhite);
          mgScore += fileBonus * sideMult;
          egScore += (fileBonus / 2) * sideMult;
          // Track rook position for connected rook bonus
          if (isWhite) whiteRooks.push({ r, c });
          else blackRooks.push({ r, c });
        }

        // KNIGHT/BISHOP OUTPOST BONUS
        if (piece.type === 'n' || piece.type === 'b') {
          // Check if on central squares (forward half, middle columns)
          const centerStart = Math.floor(size / 3);
          const centerEnd = size - centerStart - 1;
          const forwardHalf = isWhite ? r <= Math.floor(size / 2) : r >= Math.floor(size / 2);

          if (forwardHalf && c >= centerStart && c <= centerEnd) {
            // Check if protected by own pawn
            const protectRow = isWhite ? r + 1 : r - 1;
            let isSupported = false;
            for (const dc of [-1, 1]) {
              const pc = c + dc;
              if (pc >= 0 && pc < size && protectRow >= 0 && protectRow < size) {
                const p = board[protectRow][pc];
                if (p && p.type === 'p' && p.color === piece.color) {
                  isSupported = true;
                  break;
                }
              }
            }

            if (isSupported) {
              // Check if attackable by enemy pawns
              const enemyPawnCols = isWhite ? pawnColumnsBlack : pawnColumnsWhite;
              const canBeAttacked = (c > 0 && enemyPawnCols[c - 1] > 0) || (c < size - 1 && enemyPawnCols[c + 1] > 0);

              if (!canBeAttacked) {
                // Strong outpost
                const outpostBonus = piece.type === 'n' ? 25 : 15;
                mgScore += outpostBonus * sideMult;
                egScore += (outpostBonus / 2) * sideMult;
              }
            }
          }
        }
      }

      // Record pawn for structure eval
      if (piece.type === 'p') {
        if (isWhite) {
          pawnColumnsWhite[c]++;
        } else {
          pawnColumnsBlack[c]++;
        }
      }

      // Tracking Material & King Position
      if (piece.type === 'k') {
        if (isWhite) whiteKingPos = { r, c };
        else blackKingPos = { r, c };

        // King Safety (Midgame only)
        const safety = evaluateKingSafety(board, r, c, piece.color);
        mgScore += safety * safetyWeight * sideMult;
      } else {
        // Track material (excluding King)
        if (isWhite) whiteMaterial += pieceValue;
        else blackMaterial += pieceValue;
      }
    }
  }

  // Bishop Pair Bonus
  if (whiteBishops >= 2) {
    mgScore += 25 * mobilityWeight;
    egScore += 40 * mobilityWeight;
  }
  if (blackBishops >= 2) {
    mgScore -= 25 * mobilityWeight;
    egScore -= 40 * mobilityWeight;
  }

  // CONNECTED ROOKS BONUS
  // Check if two rooks are on the same file or rank with no pieces between
  function areRooksConnected(rooks, board) {
    if (rooks.length < 2) return false;
    const r1 = rooks[0], r2 = rooks[1];
    // Same file
    if (r1.c === r2.c) {
      const minR = Math.min(r1.r, r2.r);
      const maxR = Math.max(r1.r, r2.r);
      for (let row = minR + 1; row < maxR; row++) {
        if (board[row][r1.c]) return false;
      }
      return true;
    }
    // Same rank
    if (r1.r === r2.r) {
      const minC = Math.min(r1.c, r2.c);
      const maxC = Math.max(r1.c, r2.c);
      for (let col = minC + 1; col < maxC; col++) {
        if (board[r1.r][col]) return false;
      }
      return true;
    }
    return false;
  }

  const CONNECTED_ROOK_BONUS = 20;
  if (areRooksConnected(whiteRooks, board)) {
    mgScore += CONNECTED_ROOK_BONUS;
    egScore += CONNECTED_ROOK_BONUS * 1.5;
  }
  if (areRooksConnected(blackRooks, board)) {
    mgScore -= CONNECTED_ROOK_BONUS;
    egScore -= CONNECTED_ROOK_BONUS * 1.5;
  }

  // Second pass: Pawn structure (Isolated, Passed, Doubled)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (!piece || piece.type !== 'p') continue;

      const isWhite = piece.color === 'white';
      const sideMult = isWhite ? 1 : -1;

      // Doubled pawn penalty
      const cols = isWhite ? pawnColumnsWhite : pawnColumnsBlack;
      if (cols[c] > 1) {
        mgScore -= 10 * pawnStructureWeight * sideMult;
        egScore -= 12 * pawnStructureWeight * sideMult;
      }

      // Isolated pawn penalty
      const leftCol = c > 0 ? cols[c - 1] : 0;
      const rightCol = c < size - 1 ? cols[c + 1] : 0;
      if (leftCol === 0 && rightCol === 0) {
        mgScore -= 15 * pawnStructureWeight * sideMult;
        egScore -= 20 * pawnStructureWeight * sideMult;
      }

      // Passed pawn bonus
      if (isPassedPawn(board, r, c, piece.color)) {
        const progress = isWhite ? size - 1 - r : r;
        let passedBonus = progress * progress * 5 * pawnStructureWeight;

        // Bonus for supported passed pawns
        if (isPawnSupported(board, r, c, piece.color)) {
          passedBonus *= 1.3;
        }

        // Penalty for blocked passed pawns
        if (isPawnBlocked(board, r, c, piece.color)) {
          passedBonus *= 0.5;
        }

        mgScore += passedBonus * sideMult;
        egScore += passedBonus * 1.5 * sideMult;
      }

      // Backward Pawn Penalty
      if (isBackwardPawn(board, r, c, piece.color, pawnColumnsWhite, pawnColumnsBlack)) {
        mgScore -= 10 * pawnStructureWeight * sideMult;
        egScore -= 10 * pawnStructureWeight * sideMult;
      }

      // Phalanx Bonus (Connected on same rank)
      // Check right neighbor to avoid double counting
      if (c < size - 1) {
        const rightPiece = board[r][c + 1];
        if (rightPiece && rightPiece.type === 'p' && rightPiece.color === piece.color) {
          // Bonus depends on rank (advanced phalanx is stronger)
          const rankBonus = isWhite ? r : size - 1 - r;
          const phalanxBonus = (5 + rankBonus) * pawnStructureWeight;
          mgScore += phalanxBonus * sideMult;
          egScore += phalanxBonus * sideMult;
        }
      }
    }
  }

  // Calculate phase (0 = pure endgame, 32+ = midgame)
  const maxPhase = 32;
  const phaseValue = Math.min(totalPhase, maxPhase);
  const mgWeight = phaseValue / maxPhase;
  const egWeight = 1 - mgWeight;

  // ENDGAME MOP-UP EVALUATION
  if (egWeight > 0.4 && whiteKingPos && blackKingPos) {
    // If White is winning
    if (whiteMaterial > blackMaterial + 200) {
      const mopUp = evaluateMopUp(whiteKingPos, blackKingPos);
      egScore += mopUp;
    }
    // If Black is winning
    else if (blackMaterial > whiteMaterial + 200) {
      const mopUp = evaluateMopUp(blackKingPos, whiteKingPos);
      egScore -= mopUp;
    }
  }

  const totalScore = mgScore * mgWeight + egScore * egWeight;
  const perspectiveScore = forColor === 'white' ? totalScore : -totalScore;

  return Math.round(perspectiveScore);
}


/**
 * Check if a pawn is backward
 * A backward pawn cannot safely advance and has fewer friendly pawns controlling its stop square.
 */
function isBackwardPawn(board, r, c, color, whitePawnCols, blackPawnCols) {
  const size = board.length;
  const isWhite = color === 'white';

  // 1. Check if blocked or controlled by enemy pawn
  // Enemy attacks on stop square
  const enemyCols = isWhite ? blackPawnCols : whitePawnCols;
  const enemyAttacks = (enemyCols[c - 1] > 0 ? 1 : 0) + (enemyCols[c + 1] > 0 ? 1 : 0);

  if (enemyAttacks === 0) return false; // Can advance freely (at least regarding pawns)

  // 2. Check for friendly support
  // A pawn is backward if no friendly pawn is behind it or on equal rank on adjacent files
  // (i.e., neighbors are all ahead)
  // This is simplified as we only have column counts here, not row positions.
  // Ideally we need exact board check.

  // Adjusted Logic:
  // Check adjacent files for friendly pawns that can support the stop square (r+1, c)
  // Support comes from (r, c-1) or (r, c+1) moving to (r+1, c)? No, pawns capture diagonally.
  // Support comes from (r, c-1) or (r, c+1) guarding (r+1, c).
  // This means friendly pawns at (r, c-1) or (r, c+1) directly.
  // Or friendly pawns at (r-1, c-1) etc.

  // Implementation using board check is more accurate than column counts
  let supported = false;

  // Check left support
  if (c > 0) {
    // Friendly pawn on adjacent file that is BEHIND or EQUAL to this pawn?
    // If neighbor is AHEAD (r+1), it cannot guard (r+1).
    // Wait, White pawns at r guard r+1.
    // So neighbor at r (c-1) guards r+1, c.
    // Neighbor at r-1 (c-1) can move to r and guard.
    // Generally: Is there a helper that prevents it from being backward?

    // Backward definition: "Has no friendly pawn on an adjacent file which is further back or on the same rank".
    // We check board for neighbors.
    for (let row = isWhite ? 0 : size - 1; isWhite ? row <= r : row >= r; isWhite ? row++ : row--) {
      const p = board[row][c - 1];
      if (p && p.type === 'p' && p.color === color) {
        supported = true;
        break;
      }
    }
  }
  if (!supported && c < size - 1) {
    for (let row = isWhite ? 0 : size - 1; isWhite ? row <= r : row >= r; isWhite ? row++ : row--) {
      const p = board[row][c + 1];
      if (p && p.type === 'p' && p.color === color) {
        supported = true;
        break;
      }
    }
  }

  return !supported;
}

/**
 * Evaluate Mop-Up Bonus
 * Encourage pushing enemy king to edge and bringing friendly king closer.
 * Based on rule: cmd(enemyKing) * 4 + (14 - dist(kings)) * 1.5
 */
function evaluateMopUp(friendlyKing, enemyKing) {
  // Center is 4,4. 
  // Center Manhattan Distance of Enemy King (push to edge)
  const enemyCmd = Math.abs(enemyKing.r - 4) + Math.abs(enemyKing.c - 4);

  // Distance between kings (close in)
  const dist = Math.abs(friendlyKing.r - enemyKing.r) + Math.abs(friendlyKing.c - enemyKing.c);

  // Weights (scaled for centipawns)
  // Max enemyCmd = 8. Max dist = 16.
  // 10 * 8 = 80cp (edge).
  // 4 * (14 - 1) = 52cp (close).
  // Total ~130cp bonus.

  return (enemyCmd * 10) + ((14 - dist) * 4);
}

/**
 * Get position bonus for piece placement using PSTs
 */
/**
 * Get position bonus for piece placement using PSTs
 */
function getPositionBonus(r, c, type, color, size, isEndgame = false) {
  // Select correct PST based on board size
  let PST_SET;
  if (size === 8) {
    PST_SET = isEndgame && PST_EG_8[type] ? PST_EG_8 : PST_8;
  } else {
    PST_SET = isEndgame && PST_EG[type] ? PST_EG : PST;
  }
  const table = PST_SET[type];

  if (!table) return 0; // Fallback if type not found

  // Mirror row for black pieces
  const perspectiveRow = color === 'white' ? r : size - 1 - r;

  return table[perspectiveRow * size + c];
}

/**
 * Evaluate king safety based on surrounding pawns and enemy threats
 */
function evaluateKingSafety(board, kingR, kingC, kingColor) {
  let safety = 0;
  const pawnRow = kingColor === 'white' ? -1 : 1;
  const opponentColor = kingColor === 'white' ? 'black' : 'white';

  const size = board.length;
  // 1. Pawn shield
  for (let dc = -1; dc <= 1; dc++) {
    const checkR = kingR + pawnRow;
    const checkC = kingC + dc;

    if (checkR >= 0 && checkR < size && checkC >= 0 && checkC < size) {
      const piece = board[checkR][checkC];
      if (piece && piece.type === 'p' && piece.color === kingColor) {
        safety += 15;
      }
    }
  }

  // 2. King Zone Attacks (Enemy pieces near king)
  let enemyAttacks = 0;
  // size already declared above
  for (let r = Math.max(0, kingR - 2); r <= Math.min(size - 1, kingR + 2); r++) {
    for (let c = Math.max(0, kingC - 2); c <= Math.min(size - 1, kingC + 2); c++) {
      const piece = board[r][c];
      if (piece && piece.color === opponentColor) {
        // Count pieces that can reach the king's vicinity
        enemyAttacks++;
      }
    }
  }
  safety -= enemyAttacks * 5;

  // 3. Open files near king
  for (let dc = -1; dc <= 1; dc++) {
    const checkC = kingC + dc;
    if (checkC >= 0 && checkC < size) {
      const friendlyPawn =
        kingColor === 'white' ? pawnColumnsWhite[checkC] : pawnColumnsBlack[checkC];
      if (friendlyPawn === 0) {
        safety -= 15; // Penalty for open file near king
      }
    }
  }

  return safety;
}

/**
 * Evaluate rook bonus for open/semi-open files
 */
function evaluateRookFile(col, isWhite) {
  const friendlyPawns = isWhite ? pawnColumnsWhite[col] : pawnColumnsBlack[col];
  const enemyPawns = isWhite ? pawnColumnsBlack[col] : pawnColumnsWhite[col];

  if (friendlyPawns === 0) {
    if (enemyPawns === 0) return 20; // Open file
    return 10; // Semi-open file
  }
  return 0;
}

/**
 * Check if a pawn is supported by another pawn
 */
function isPawnSupported(board, r, c, color) {
  const supportRow = color === 'white' ? r + 1 : r - 1;
  const size = board.length;
  if (supportRow < 0 || supportRow >= size) return false;

  for (let dc = -1; dc <= 1; dc += 2) {
    const checkC = c + dc;
    if (checkC >= 0 && checkC < size) {
      const piece = board[supportRow][checkC];
      if (piece && piece.type === 'p' && piece.color === color) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a pawn is a passed pawn
 */
function isPassedPawn(board, r, c, color) {
  const opponentColor = color === 'white' ? 'black' : 'white';
  const startR = color === 'white' ? r - 1 : r + 1;
  const size = board.length;
  const endR = color === 'white' ? 0 : size - 1;
  const step = color === 'white' ? -1 : 1;

  for (let row = startR; row !== endR + step; row += step) {
    for (let col = Math.max(0, c - 1); col <= Math.min(size - 1, c + 1); col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'p' && piece.color === opponentColor) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if a pawn is blocked by any piece
 */
function isPawnBlocked(board, r, c, color) {
  const nextR = color === 'white' ? r - 1 : r + 1;
  if (nextR < 0 || nextR >= board.length) return false;
  return board[nextR][c] !== null;
}
