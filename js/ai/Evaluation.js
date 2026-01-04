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
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20
  ]
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
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
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
      }

      // Record pawn for structure eval
      if (piece.type === 'p') {
        if (isWhite) {
          pawnColumnsWhite[c]++;
        } else {
          pawnColumnsBlack[c]++;
        }
      }

      // King Safety (Midgame only)
      if (piece.type === 'k') {
        const safety = evaluateKingSafety(board, r, c, piece.color);
        mgScore += safety * safetyWeight * sideMult;
      }
    }
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

        mgScore += passedBonus * sideMult;
        egScore += passedBonus * 1.5 * sideMult;
      }
    }
  }

  // Calculate phase (0 = pure endgame, 32+ = midgame)
  const maxPhase = 32;
  const phaseValue = Math.min(totalPhase, maxPhase);
  const mgWeight = phaseValue / maxPhase;
  const egWeight = 1 - mgWeight;

  const totalScore = mgScore * mgWeight + egScore * egWeight;
  const perspectiveScore = forColor === 'white' ? totalScore : -totalScore;

  return Math.round(perspectiveScore);
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
  const pawnRow = kingColor === 'white' ? 1 : -1;
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

  return safety;
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
