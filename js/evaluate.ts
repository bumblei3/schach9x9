/**
 * Evaluation module for Schach 9x9 AI.
 * Handles static board evaluation including material, positional bonuses,
 * pawn structure, king safety, mobility, and tapered evaluation.
 * Supports personality-based weight adjustments.
 */

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
} from './ai/BoardDefinitions';

export type IntBoard = Int8Array;

// =====================================================================
// Personality configuration (ported from WASM eval.rs)
// =====================================================================

export type Personality = 'NORMAL' | 'AGGRESSIVE' | 'SOLID' | 'GENTLE';

export interface EvalConfig {
  personality: Personality;
  elo?: number;
}

function getPersonalityWeights(personality: Personality): {
  attackWeight: number;
  pawnStructureWeight: number;
  kingSafetyWeight: number;
  materialWeight: number;
  mobilityWeight: number;
} {
  switch (personality) {
    case 'AGGRESSIVE':
      return {
        attackWeight: 1.4,
        pawnStructureWeight: 0.7,
        kingSafetyWeight: 0.8,
        materialWeight: 1.0,
        mobilityWeight: 1.3,
      };
    case 'SOLID':
      return {
        attackWeight: 0.7,
        pawnStructureWeight: 1.3,
        kingSafetyWeight: 1.4,
        materialWeight: 1.0,
        mobilityWeight: 0.9,
      };
    case 'GENTLE':
      return {
        attackWeight: 0.8,
        pawnStructureWeight: 1.0,
        kingSafetyWeight: 1.1,
        materialWeight: 0.9,
        mobilityWeight: 0.8,
      };
    case 'NORMAL':
    default:
      return {
        attackWeight: 1.0,
        pawnStructureWeight: 1.0,
        kingSafetyWeight: 1.0,
        materialWeight: 1.0,
        mobilityWeight: 1.0,
      };
  }
}

// =====================================================================
// Material values (centipawns)
// =====================================================================

export const EVAL_VALUES: Record<number, number> = {
  [PIECE_PAWN]: 100,
  [PIECE_KNIGHT]: 320,
  [PIECE_BISHOP]: 330,
  [PIECE_ROOK]: 500,
  [PIECE_QUEEN]: 900,
  [PIECE_KING]: 20000,
  [PIECE_ARCHBISHOP]: 650,
  [PIECE_CHANCELLOR]: 850,
  [PIECE_ANGEL]: 1220,
};

// =====================================================================
// Piece-Square Tables (9x9 board, from white's perspective)
// Row 0 = top of board (white pawn promotion rank)
// Row 8 = bottom of board (black pawn promotion rank)
// Black pieces use mirrored lookup: (8 - row) * 9 + col
// =====================================================================

const PAWN_TABLE = [
  60, 60, 60, 60, 60, 60, 60, 60, 60,  // row 0 (promotion)
  45, 45, 45, 50, 50, 50, 45, 45, 45,  // row 1
  30, 30, 30, 35, 35, 35, 30, 30, 30,  // row 2
  20, 20, 20, 25, 25, 25, 20, 20, 20,  // row 3
  15, 15, 15, 18, 18, 18, 15, 15, 15,  // row 4
  10, 10, 10, 12, 12, 12, 10, 10, 10,  // row 5
   5,  5,  5,  5,  5,  5,  5,  5,  5,  // row 6
   5,  5,  5,  5,  5,  5,  5,  5,  5,  // row 7 (starting rank)
   0,  0,  0,  0,  0,  0,  0,  0,  0,  // row 8
];

const KNIGHT_TABLE = [
  -10, -5, -5, -5, -5, -5, -5, -5, -10,
   -5,  0,  5,  5,  5,  5,  5,  0,  -5,
    5,  5, 15, 15, 15, 15, 15,  5,   5,
    5, 10, 15, 20, 20, 20, 15, 10,   5,
    5, 10, 15, 20, 25, 20, 15, 10,   5,
    5, 10, 15, 20, 20, 20, 15, 10,   5,
    5,  5, 15, 15, 15, 15, 15,  5,   5,
   -5,  0,  5,  5,  5,  5,  5,  0,  -5,
  -10, -5, -5, -5, -5, -5, -5, -5, -10,
];

const BISHOP_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 20, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
];

const ROOK_TABLE = [
  10, 10, 10, 10, 10, 10, 10, 10, 10,
   5,  5,  5,  5,  5,  5,  5,  5,  5,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10, 10,  5,
   5,  5,  5,  5,  5,  5,  5,  5,  5,
];

const QUEEN_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
];

const ARCHBISHOP_TABLE = [
  -5,  0,  0,  0,  0,  0,  0,  0, -5,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  5, 10, 12, 12, 12, 10,  5,  0,
   0,  5, 12, 18, 18, 18, 12,  5,  0,
   0,  5, 12, 18, 22, 18, 12,  5,  0,
   0,  5, 12, 18, 18, 18, 12,  5,  0,
   0,  5, 10, 12, 12, 12, 10,  5,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
  -5,  0,  0,  0,  0,  0,  0,  0, -5,
];

const CHANCELLOR_TABLE = [
   0,  0,  5,  5,  5,  5,  5,  0,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   5,  5, 10, 10, 10, 10, 10,  5,  5,
   5,  5, 10, 15, 15, 15, 10,  5,  5,
   5,  5, 10, 15, 15, 15, 10,  5,  5,
   5,  5, 10, 15, 15, 15, 10,  5,  5,
   5,  5, 10, 10, 10, 10, 10,  5,  5,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  0,  5,  5,  5,  5,  5,  0,  0,
];

const ANGEL_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
];

const KING_MIDGAME_TABLE = [
  20, 30, 10,  0,  0,  0, 10, 30, 20,
  20, 20,  0,  0,  0,  0,  0, 20, 20,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
  20, 20,  0,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0,  0, 10, 30, 20,
];

const KING_ENDGAME_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 15, 15, 15, 10,  5,  0,
   0,  5, 10, 10, 10, 10, 10,  5,  0,
   0,  5,  5,  5,  5,  5,  5,  5,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,
];

// =====================================================================
// Pawn structure tables
// =====================================================================

const PASSED_PAWN_BONUS = [
  0, 150, 100, 60, 35, 20, 10, 5, 0,
];

const DOUBLED_PAWN_PENALTY = -15;
const ISOLATED_PAWN_PENALTY = -20;

// =====================================================================
// Direction vectors for mobility calculation (9x9 board)
// =====================================================================

const BISHOP_DIRS = [-10, -8, 8, 10];
const ROOK_DIRS = [-9, 9, -1, 1];

// =====================================================================
// Main evaluation function
// =====================================================================

export function evaluate(b: IntBoard, c: number, evalConfig: EvalConfig = { personality: 'NORMAL' }): number {
  let mgScore = 0;
  let egScore = 0;
  let phase = 0;

  let whiteKingSq = -1;
  let blackKingSq = -1;

  const whitePawnFiles = new Set<number>();
  const blackPawnFiles = new Set<number>();
  const whitePawnsPerFile: number[] = new Array(9).fill(0);
  const blackPawnsPerFile: number[] = new Array(9).fill(0);

  // Personality weights
  const weights = getPersonalityWeights(evalConfig.personality);

  // --- Pass 1: Material + Positional + Phase + Mobility ---
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const p = b[i];
    if (p === PIECE_NONE) continue;

    const type = p & TYPE_MASK;
    const pColor = p & COLOR_MASK;
    const val = EVAL_VALUES[type] || 0;
    const row = indexToRow(i);
    const col = indexToCol(i);
    const isUs = pColor === c;
    const isWhitePiece = pColor === COLOR_WHITE;
    const pstRow = isWhitePiece ? row : 8 - row;
    const sqIdx = pstRow * 9 + col;

    const phaseValue: Record<number, number> = {
      [PIECE_PAWN]: 0, [PIECE_KNIGHT]: 1, [PIECE_BISHOP]: 1,
      [PIECE_ROOK]: 2, [PIECE_QUEEN]: 4, [PIECE_KING]: 0,
      [PIECE_ARCHBISHOP]: 2, [PIECE_CHANCELLOR]: 3, [PIECE_ANGEL]: 4,
    };
    phase += phaseValue[type] || 0;

    if (isUs) mgScore += val; else mgScore -= val;
    if (isUs) egScore += val; else egScore -= val;

    let mgPos = 0;
    let egPos = 0;

    switch (type) {
      case PIECE_PAWN:
        mgPos = PAWN_TABLE[sqIdx];
        egPos = PAWN_TABLE[sqIdx] * 1.2;
        if (isWhitePiece) {
          whitePawnFiles.add(col);
          whitePawnsPerFile[col]++;
        } else {
          blackPawnFiles.add(col);
          blackPawnsPerFile[col]++;
        }
        break;
      case PIECE_KNIGHT:
        mgPos = KNIGHT_TABLE[sqIdx];
        egPos = KNIGHT_TABLE[sqIdx] * 0.8;
        break;
      case PIECE_BISHOP:
        mgPos = BISHOP_TABLE[sqIdx];
        egPos = BISHOP_TABLE[sqIdx] * 1.1;
        break;
      case PIECE_ROOK:
        mgPos = ROOK_TABLE[sqIdx];
        egPos = ROOK_TABLE[sqIdx] * 1.0;
        break;
      case PIECE_QUEEN:
        mgPos = QUEEN_TABLE[sqIdx];
        egPos = QUEEN_TABLE[sqIdx] * 0.9;
        break;
      case PIECE_KING:
        if (isWhitePiece) whiteKingSq = i;
        else blackKingSq = i;
        break;
      case PIECE_ARCHBISHOP:
        mgPos = ARCHBISHOP_TABLE[sqIdx];
        egPos = ARCHBISHOP_TABLE[sqIdx] * 0.9;
        break;
      case PIECE_CHANCELLOR:
        mgPos = CHANCELLOR_TABLE[sqIdx];
        egPos = CHANCELLOR_TABLE[sqIdx] * 0.95;
        break;
      case PIECE_ANGEL:
        mgPos = ANGEL_TABLE[sqIdx];
        egPos = ANGEL_TABLE[sqIdx] * 0.95;
        break;
      case PIECE_NIGHTRIDER:
        mgPos = KNIGHT_TABLE[sqIdx]; // Re-use knight table
        egPos = KNIGHT_TABLE[sqIdx] * 0.8;
        break;
    }

    if (isUs) { mgScore += mgPos; egScore += egPos; }
    else { mgScore -= mgPos; egScore -= egPos; }

    // --- Mobility (non-pawn, non-king pieces) ---
    if (type !== PIECE_PAWN && type !== PIECE_KING) {
      let mobility = 0;
      const directions = type === PIECE_BISHOP || type === PIECE_ARCHBISHOP
        ? BISHOP_DIRS
        : type === PIECE_ROOK || type === PIECE_CHANCELLOR
          ? ROOK_DIRS
          : type === PIECE_QUEEN || type === PIECE_ANGEL
            ? [...BISHOP_DIRS, ...ROOK_DIRS]
            : type === PIECE_KNIGHT || type === PIECE_NIGHTRIDER
              ? [] // Knight mobility handled separately if needed
              : [];

      if (directions.length > 0) {
        mobility = countMobility(b, i, directions, pColor);
      }
      // Knight mobility: count legal knight moves
      if (type === PIECE_KNIGHT || type === PIECE_NIGHTRIDER) {
        mobility = countKnightMobility(b, i, pColor);
      }

      if (type === PIECE_ARCHBISHOP) {
        // Archbiship = Bishop + Knight
        mobility += countKnightMobility(b, i, pColor);
      }
      if (type === PIECE_CHANCELLOR) {
        // Chancellor = Rook + Knight
        mobility += countKnightMobility(b, i, pColor);
      }
      if (type === PIECE_ANGEL) {
        // Angel = Queen + Knight
        mobility += countKnightMobility(b, i, pColor);
      }

      // Weight: ~3-5 cp per square in MG, ~5-8 in EG
      const mgMobWeight = 3 * weights.mobilityWeight;
      const egMobWeight = 5 * weights.mobilityWeight;

      if (isUs) {
        mgScore += mobility * mgMobWeight;
        egScore += mobility * egMobWeight;
      } else {
        mgScore -= mobility * mgMobWeight;
        egScore -= mobility * egMobWeight;
      }
    }
  }

  // --- King positional (tapered) ---
  if (whiteKingSq >= 0) {
    const wkr = indexToRow(whiteKingSq);
    const wkc = indexToCol(whiteKingSq);
    const wIdx = wkr * 9 + wkc;
    if (c === COLOR_WHITE) {
      mgScore += KING_MIDGAME_TABLE[wIdx];
      egScore += KING_ENDGAME_TABLE[wIdx];
    } else {
      mgScore -= KING_MIDGAME_TABLE[wIdx];
      egScore -= KING_ENDGAME_TABLE[wIdx];
    }
  }
  if (blackKingSq >= 0) {
    const bkr = indexToRow(blackKingSq);
    const bkc = indexToCol(blackKingSq);
    const bIdx = (8 - bkr) * 9 + bkc;
    if (c === COLOR_BLACK) {
      mgScore += KING_MIDGAME_TABLE[bIdx];
      egScore += KING_ENDGAME_TABLE[bIdx];
    } else {
      mgScore -= KING_MIDGAME_TABLE[bIdx];
      egScore -= KING_ENDGAME_TABLE[bIdx];
    }
  }

  // --- Pass 2: Pawn structure ---
  for (let f = 0; f < 9; f++) {
    if (whitePawnsPerFile[f] > 1) mgScore += DOUBLED_PAWN_PENALTY * (whitePawnsPerFile[f] - 1);
    if (blackPawnsPerFile[f] > 1) mgScore -= DOUBLED_PAWN_PENALTY * (blackPawnsPerFile[f] - 1);
  }
  for (const f of whitePawnFiles) {
    if (!(f > 0 && whitePawnFiles.has(f - 1)) && !(f < 8 && whitePawnFiles.has(f + 1)))
      mgScore += ISOLATED_PAWN_PENALTY;
  }
  for (const f of blackPawnFiles) {
    if (!(f > 0 && blackPawnFiles.has(f - 1)) && !(f < 8 && blackPawnFiles.has(f + 1)))
      mgScore -= ISOLATED_PAWN_PENALTY;
  }
  // Passed pawns
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const p = b[i];
    if (p === PIECE_NONE || (p & TYPE_MASK) !== PIECE_PAWN) continue;
    const pColor = p & COLOR_MASK;
    const row = indexToRow(i);
    const col = indexToCol(i);
    if (pColor === c) {
      let passed = true;
      for (let r2 = row - 1; r2 >= 0; r2--) {
        for (let dc2 = -1; dc2 <= 1; dc2++) {
          const cc = col + dc2;
          if (cc < 0 || cc > 8) continue;
          const t = b[r2 * 9 + cc];
          if (t !== PIECE_NONE && (t & TYPE_MASK) === PIECE_PAWN && (t & COLOR_MASK) !== c) {
            passed = false; break;
          }
        }
        if (!passed) break;
      }
      if (passed) {
        mgScore += PASSED_PAWN_BONUS[row] * 0.8 * weights.pawnStructureWeight;
        egScore += PASSED_PAWN_BONUS[row] * 1.5 * weights.pawnStructureWeight;
      }
    } else {
      let passed = true;
      for (let r2 = row + 1; r2 <= 8; r2++) {
        for (let dc2 = -1; dc2 <= 1; dc2++) {
          const cc = col + dc2;
          if (cc < 0 || cc > 8) continue;
          const t = b[r2 * 9 + cc];
          if (t !== PIECE_NONE && (t & TYPE_MASK) === PIECE_PAWN && (t & COLOR_MASK) === c) {
            passed = false; break;
          }
        }
        if (!passed) break;
      }
      if (passed) {
        mgScore -= PASSED_PAWN_BONUS[8 - row] * 0.8 * weights.pawnStructureWeight;
        egScore -= PASSED_PAWN_BONUS[8 - row] * 1.5 * weights.pawnStructureWeight;
      }
    }
  }

  // --- Pass 3: King safety (pawn shield) ---
  const shieldPenalty = 15 * weights.kingSafetyWeight;
  if (c === COLOR_WHITE && whiteKingSq >= 0) {
    const wkc = indexToCol(whiteKingSq);
    if (whitePawnsPerFile[wkc] === 0) {
      mgScore -= shieldPenalty;
      egScore -= shieldPenalty * 0.5;
    }
  }
  if (c === COLOR_BLACK && blackKingSq >= 0) {
    const bkc = indexToCol(blackKingSq);
    if (blackPawnsPerFile[bkc] === 0) {
      mgScore += shieldPenalty;
      egScore += shieldPenalty * 0.5;
    }
  }

  // --- Tapered evaluation ---
  const maxPhase = 24;
  phase = Math.min(phase, maxPhase);

  // Tempo bonus: small advantage for side to move
  const TEMPO_BONUS = 10;
  if (c === COLOR_WHITE) {
    mgScore += TEMPO_BONUS;
    egScore += TEMPO_BONUS;
  } else {
    mgScore -= TEMPO_BONUS;
    egScore -= TEMPO_BONUS;
  }

  return Math.round((mgScore * phase + egScore * (maxPhase - phase)) / maxPhase);
}

// =====================================================================
// Mobility helper functions
// =====================================================================

function countMobility(board: IntBoard, square: number, offsets: number[], color: number): number {
  let count = 0;
  const r = indexToRow(square) as number;
  const c = indexToCol(square) as number;

  for (const offset of offsets) {
    let curr = square;
    while (true) {
      curr += offset;
      if (!isValidSquare(curr, board)) break;

      const cr = indexToRow(curr);
      const cc = indexToCol(curr);

      // Diagonal wrap check
      if (offset === 1 || offset === -1) {
        if (cr !== r) break;
      } else if (offset === 9 || offset === -9) {
        if (cc !== c) break;
      } else {
        const prev = curr - offset;
        const pr = indexToRow(prev);
        const pc = indexToCol(prev);
        if (Math.abs(cr - pr) !== 1 || Math.abs(cc - pc) !== 1) break;
      }

      const p = board[curr];
      if (p === PIECE_NONE) {
        count += 1;
      } else {
        if ((p & COLOR_MASK) !== color) count += 1;
        break;
      }
    }
  }
  return count;
}

function countKnightMobility(board: IntBoard, square: number, color: number): number {
  let count = 0;
  const KNIGHT_OFFSETS = [-19, -17, -11, -7, 7, 11, 17, 19];
  const r = indexToRow(square);
  const c = indexToCol(square);

  for (const offset of KNIGHT_OFFSETS) {
    const target = square + offset;
    if (!isValidSquare(target, board)) continue;

    const tr = indexToRow(target);
    const tc = indexToCol(target);

    // Verify knight move is L-shaped
    const dr = Math.abs(tr - r);
    const dc = Math.abs(tc - c);
    if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) continue;

    const p = board[target];
    if (p === PIECE_NONE || (p & COLOR_MASK) !== color) {
      count += 1;
    }
  }
  return count;
}

function isValidSquare(square: number, board: IntBoard): boolean {
  return square >= 0 && square < board.length;
}
