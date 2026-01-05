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
  COLOR_WHITE,
  COLOR_BLACK,
  TYPE_MASK,
  COLOR_MASK,
  indexToRow,
  indexToCol,
} from './BoardDefinitions.js';

// Piece Values (Centipawns)
const PIECE_VALUES = new Int16Array(16);
PIECE_VALUES[PIECE_PAWN] = 100;
PIECE_VALUES[PIECE_KNIGHT] = 320;
PIECE_VALUES[PIECE_BISHOP] = 330;
PIECE_VALUES[PIECE_ROOK] = 500;
PIECE_VALUES[PIECE_QUEEN] = 900;
PIECE_VALUES[PIECE_KING] = 20000;
PIECE_VALUES[PIECE_ARCHBISHOP] = 600; // B+N
PIECE_VALUES[PIECE_CHANCELLOR] = 700; // R+N
PIECE_VALUES[PIECE_ANGEL] = 1000; // Q+N

// Phase Values
const PHASE_VALUES = new Int8Array(16);
PHASE_VALUES[PIECE_KNIGHT] = 1;
PHASE_VALUES[PIECE_BISHOP] = 1;
PHASE_VALUES[PIECE_ROOK] = 2;
PHASE_VALUES[PIECE_QUEEN] = 4;
PHASE_VALUES[PIECE_ARCHBISHOP] = 3;
PHASE_VALUES[PIECE_CHANCELLOR] = 3;
PHASE_VALUES[PIECE_ANGEL] = 4;

// PSTs (Flattened 81)
// White Perspective. Black mirrors ROW.
// R0 = Top (Black side), R8 = Bottom (White side)
// Indices 0..80.
// R0: 0-8. R8: 72-80.

export const PST_PAWN = new Int8Array([
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
]);

export const PST_KNIGHT = new Int8Array([
  -50, -40, -30, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15,
  15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 20, 15, 5, -30, -30, 0, 15, 20, 25, 20, 15, 0, -30, -30,
  5, 15, 20, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 15, 10, 0, -30, -40, -20, 0, 5, 5, 5, 0, -20,
  -40, -50, -40, -30, -30, -30, -30, -30, -40, -50,
]);

export const PST_BISHOP = new Int8Array([
  -20, -10, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 10,
  5, 0, -10, -10, 5, 5, 10, 10, 10, 5, 5, -10, -10, 0, 10, 10, 15, 10, 10, 0, -10, -10, 10, 10, 10,
  10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 0, 5, -10, -10, 0, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10,
  -10, -10, -10, -10, -10, -20,
]);

export const PST_ROOK = new Int8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, 0, -5, -5, 0,
  0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
  0, 0, -5, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

export const PST_QUEEN = new Int8Array([
  -20, -10, -10, -5, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 5, 0,
  -10, -5, 0, 5, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 5, 0, 0, -5, -5, 0, 5, 5, 5, 5, 5, 0, -5, -10,
  0, 5, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -5, -10, -10, -20,
]);

export const PST_KING_MG = new Int8Array([
  -30,
  -40,
  -40,
  -50,
  -50,
  -50,
  -40,
  -40,
  -30, // R0
  -30,
  -40,
  -40,
  -50,
  -50,
  -50,
  -40,
  -40,
  -30,
  -30,
  -40,
  -40,
  -50,
  -50,
  -50,
  -40,
  -40,
  -30, // Stay back
  -30,
  -40,
  -40,
  -50,
  -50,
  -50,
  -40,
  -40,
  -30,
  -30,
  -40,
  -50,
  -50,
  -50,
  -40,
  -40,
  -30,
  -30,
  -20,
  -30,
  -30,
  -40,
  -40,
  -40,
  -30,
  -30,
  -20,
  20,
  20,
  0,
  0,
  0,
  0,
  0,
  20,
  20, // Pawn shelter
  20,
  30,
  10,
  0,
  0,
  0,
  10,
  30,
  20,
  20,
  30,
  10,
  0,
  0,
  0,
  10,
  30,
  20, // Home
]);

export const PST_KING_EG = new Int8Array([
  -50,
  -40,
  -30,
  -20,
  -20,
  -20,
  -30,
  -40,
  -50, // Avoid corners
  -30,
  -20,
  -10,
  0,
  0,
  0,
  -10,
  -20,
  -30,
  -30,
  -10,
  10,
  20,
  20,
  20,
  10,
  -10,
  -30, // Centralize
  -30,
  0,
  20,
  30,
  30,
  30,
  20,
  0,
  -30,
  -30,
  0,
  20,
  30,
  40,
  30,
  20,
  0,
  -30,
  -30,
  0,
  20,
  30,
  30,
  30,
  20,
  0,
  -30,
  -30,
  -10,
  10,
  20,
  20,
  20,
  10,
  -10,
  -30,
  -20,
  -10,
  0,
  0,
  0,
  0,
  0,
  -10,
  -20, // Less penalty
  -50,
  -40,
  -30,
  -20,
  -20,
  -20,
  -30,
  -40,
  -50,
]);

// Helper to access PST
function getPST(type, r, c, color, isEndgame) {
  // Array access: [r * 9 + c]
  // If Black, mirror Row: r = 8 - r
  const rank = color === COLOR_WHITE ? r : 8 - r;
  const idx = rank * 9 + c;

  // Choose table
  let table = null;
  switch (type) {
    case PIECE_PAWN:
      table = PST_PAWN;
      break;
    case PIECE_KNIGHT:
      table = PST_KNIGHT;
      break;
    case PIECE_BISHOP:
      table = PST_BISHOP;
      break;
    case PIECE_ROOK:
      table = PST_ROOK;
      break;
    case PIECE_QUEEN:
      table = PST_QUEEN;
      break;
    case PIECE_KING:
      table = isEndgame ? PST_KING_EG : PST_KING_MG;
      break;
    case PIECE_ARCHBISHOP:
      table = PST_KNIGHT;
      break; // Approximation
    case PIECE_CHANCELLOR:
      table = PST_QUEEN;
      break; // Approximation
    case PIECE_ANGEL:
      table = PST_QUEEN;
      break; // Approximation
    default:
      return 0;
  }
  return table[idx];
}

// Scratch arrays (assuming single thread or fresh allocation)
// For worker safety, better to allocate inside eval or pass as workspace.
// Since JS is single-threaded (per worker), globals are safe assuming no recursion re-entry with shared state.
// Evaluation is not recursive. Safe.
const pawnColsWhite = new Int8Array(9);
const pawnColsBlack = new Int8Array(9);

export function evaluatePosition(board, turnColorStr, _config) {
  const turnColor = turnColorStr === 'white' ? COLOR_WHITE : COLOR_BLACK;

  // Config defaults
  // const mobilityWeight = config?.mobilityWeight ?? 1.0;

  let mgScore = 0;
  let egScore = 0;

  pawnColsWhite.fill(0);
  pawnColsBlack.fill(0);

  let whiteMaterial = 0;
  let blackMaterial = 0;
  let totalPhase = 0;

  let whiteKingIdx = -1;
  let blackKingIdx = -1;

  // Arrays for rooks (indices)
  // To avoid alloc, maybe use fixed size stack array?
  // Just use simple array, GC is cheap for small arrays.
  const whiteRooks = [];
  const blackRooks = [];

  let whiteBishops = 0;
  let blackBishops = 0;

  // Tempo (Add to side to move)
  // Score is White - Black.
  // If White to move, add. If Black to move, subtract.
  const tempoSide = turnColor === COLOR_WHITE ? 1 : -1;
  mgScore += 10 * tempoSide;
  egScore += 5 * tempoSide;

  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = board[i];
    if (piece === PIECE_NONE) continue;

    const type = piece & TYPE_MASK;
    const color = piece & COLOR_MASK;
    const isWhite = color === COLOR_WHITE;
    const sideMult = isWhite ? 1 : -1;

    const val = PIECE_VALUES[type];

    // Material
    if (isWhite) whiteMaterial += val;
    else blackMaterial += val;
    totalPhase += PHASE_VALUES[type];

    const r = indexToRow(i);
    const c = indexToCol(i);

    // PST
    const mgPst = getPST(type, r, c, color, false);
    const egPst = getPST(type, r, c, color, true);

    mgScore += (val + mgPst) * sideMult;
    egScore += (val + egPst) * sideMult;

    // Pawn Columns
    if (type === PIECE_PAWN) {
      if (isWhite) pawnColsWhite[c]++;
      else pawnColsBlack[c]++;
    }

    // King location
    if (type === PIECE_KING) {
      if (isWhite) whiteKingIdx = i;
      else blackKingIdx = i;
    }

    // Rooks
    if (type === PIECE_ROOK) {
      if (isWhite) whiteRooks.push(i);
      else blackRooks.push(i);
    }

    // Bishops
    if (type === PIECE_BISHOP) {
      if (isWhite) whiteBishops++;
      else blackBishops++;
    }

    // Mobility approximation (simple degree heuristic usually better than full movegen)
    // For Grand Refactor, let's skip expensive mobility counting for now,
    // OR implement simple "safe squares" count.
    // Let's rely on PST + Structure for speed first.
  }

  // Phase
  const MAX_PHASE = 32;
  const phase = Math.min(totalPhase, MAX_PHASE);
  const mgWeight = phase / MAX_PHASE;
  const egWeight = 1.0 - mgWeight;

  // Mop-Up
  if (egWeight > 0.4 && whiteKingIdx !== -1 && blackKingIdx !== -1) {
    if (whiteMaterial > blackMaterial + 200) {
      egScore += evaluateMopUp(whiteKingIdx, blackKingIdx);
    } else if (blackMaterial > whiteMaterial + 200) {
      egScore -= evaluateMopUp(blackKingIdx, whiteKingIdx);
    }
  }

  // Bishop Pair Bonus (e.g., 50 centipawns)
  const BISHOP_PAIR_BONUS = 50;
  if (whiteBishops >= 2) {
    mgScore += BISHOP_PAIR_BONUS;
    egScore += BISHOP_PAIR_BONUS;
  }
  if (blackBishops >= 2) {
    mgScore -= BISHOP_PAIR_BONUS;
    egScore -= BISHOP_PAIR_BONUS;
  }

  // Pawn Structure: Doubled and Isolated Pawns
  const DOUBLED_PAWN_PENALTY = 15;
  const ISOLATED_PAWN_PENALTY = 20;

  for (let c = 0; c < 9; c++) {
    // White doubled
    if (pawnColsWhite[c] > 1) {
      mgScore -= (pawnColsWhite[c] - 1) * DOUBLED_PAWN_PENALTY;
      egScore -= (pawnColsWhite[c] - 1) * DOUBLED_PAWN_PENALTY;
    }
    // Black doubled
    if (pawnColsBlack[c] > 1) {
      mgScore += (pawnColsBlack[c] - 1) * DOUBLED_PAWN_PENALTY;
      egScore += (pawnColsBlack[c] - 1) * DOUBLED_PAWN_PENALTY;
    }

    // White isolated
    if (pawnColsWhite[c] > 0) {
      const leftC = c > 0 ? pawnColsWhite[c - 1] : 0;
      const rightC = c < 8 ? pawnColsWhite[c + 1] : 0;
      if (leftC === 0 && rightC === 0) {
        mgScore -= ISOLATED_PAWN_PENALTY;
        egScore -= ISOLATED_PAWN_PENALTY;
      }
    }
    // Black isolated
    if (pawnColsBlack[c] > 0) {
      const leftC = c > 0 ? pawnColsBlack[c - 1] : 0;
      const rightC = c < 8 ? pawnColsBlack[c + 1] : 0;
      if (leftC === 0 && rightC === 0) {
        mgScore += ISOLATED_PAWN_PENALTY;
        egScore += ISOLATED_PAWN_PENALTY;
      }
    }
  }

  // Connected Rooks
  // ... (Implement if needed, expensive?)

  // Structure: Passed Pawns
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = board[i];
    if ((piece & TYPE_MASK) !== PIECE_PAWN) continue;

    const color = piece & COLOR_MASK;
    const isWhite = color === COLOR_WHITE;
    const r = indexToRow(i);
    const c = indexToCol(i);

    let isPassed = true;
    const enemyCols = isWhite ? pawnColsBlack : pawnColsWhite;

    // Check same and adjacent columns
    for (let dc = -1; dc <= 1; dc++) {
      const targetC = c + dc;
      if (targetC < 0 || targetC >= 9) continue;

      // Are there any enemy pawns in front?
      // For simplicity, we'll check if ANY enemy pawns exist in these columns
      // A more precise check would be rank-based.
      if (enemyCols[targetC] > 0) {
        // Precise check: iterate squares in front?
        // Or just use the column count as a heuristic.
        // Let's do a more precise check since it's only for pawns.
        for (let tr = isWhite ? r - 1 : r + 1; isWhite ? tr >= 0 : tr < 9; isWhite ? tr-- : tr++) {
          const tp = board[tr * 9 + targetC];
          if ((tp & TYPE_MASK) === PIECE_PAWN && (tp & COLOR_MASK) !== color) {
            isPassed = false;
            break;
          }
        }
      }
      if (!isPassed) break;
    }

    if (isPassed) {
      const progress = isWhite ? 8 - r : r;
      const bonus = progress * progress * 5;
      // Supported check
      let isSupported = false;
      const supportRow = isWhite ? r + 1 : r - 1;
      if (supportRow >= 0 && supportRow < 9) {
        for (let dc = -1; dc <= 1; dc += 2) {
          const sc = c + dc;
          if (sc >= 0 && sc < 9) {
            const sp = board[supportRow * 9 + sc];
            if ((sp & TYPE_MASK) === PIECE_PAWN && (sp & COLOR_MASK) === color) {
              isSupported = true;
              break;
            }
          }
        }
      }

      const totalBonus = isSupported ? Math.round(bonus * 1.3) : bonus;
      if (isWhite) {
        mgScore += totalBonus;
        egScore += totalBonus * 2.0; // Increased EG bonus for passed pawns
      } else {
        mgScore -= totalBonus;
        egScore -= totalBonus * 2.0;
      }
    } else {
      // Linked pawn bonus for non-passed pawns
      let isSupported = false;
      const supportRow = isWhite ? r + 1 : r - 1;
      if (supportRow >= 0 && supportRow < 9) {
        for (let dc = -1; dc <= 1; dc += 2) {
          const sc = c + dc;
          if (sc >= 0 && sc < 9) {
            const sp = board[supportRow * 9 + sc];
            if ((sp & TYPE_MASK) === PIECE_PAWN && (sp & COLOR_MASK) === color) {
              isSupported = true;
              break;
            }
          }
        }
      }
      if (isSupported) {
        const LINKED_BONUS = 10;
        if (isWhite) {
          mgScore += LINKED_BONUS;
          egScore += LINKED_BONUS;
        } else {
          mgScore -= LINKED_BONUS;
          egScore -= LINKED_BONUS;
        }
      }
    }
  }

  // Final Score (Combined Phase)
  const total = mgScore * mgWeight + egScore * egWeight;

  // Return from perspective of side to move (NegaMax)
  const perspective = turnColor === COLOR_WHITE ? 1 : -1;
  return Math.round(total * perspective);
}

function evaluateMopUp(friendlyKingIdx, enemyKingIdx) {
  const er = indexToRow(enemyKingIdx);
  const ec = indexToCol(enemyKingIdx);
  const fr = indexToRow(friendlyKingIdx);
  const fc = indexToCol(friendlyKingIdx);

  const enemyCmd = Math.abs(er - 4) + Math.abs(ec - 4);
  const dist = Math.abs(fr - er) + Math.abs(fc - ec);

  return enemyCmd * 10 + (14 - dist) * 4;
}
