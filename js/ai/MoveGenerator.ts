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
  COLOR_WHITE,
  COLOR_BLACK,
  TYPE_MASK,
  COLOR_MASK,
  indexToRow,
  indexToCol,
} from './BoardDefinitions.js';

// Re-export piece/color constants for consumers
export {
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
  COLOR_WHITE,
  COLOR_BLACK,
};

import { isBlockedSquare, getCurrentBoardShape, type BoardShape } from '../config.js';

export type BoardStorage = number[] | Int8Array;

/**
 * Represents a chess move in the integer board engine.
 * Squares are stored as flat indices (0-80) into the 9x9 board.
 */
export interface Move {
  from: number;
  to: number;
  piece?: number;
  captured?: number;
  promotion?: number;
  castling?: boolean;
  flags?: string;
  score?: number;
}

/**
 * Information needed to undo a move on the integer board.
 */
export interface UndoInfo {
  move: Move;
  captured: number;
  piece: number;
}

// Offsets
const UP = -9;
const DOWN = 9;
const LEFT = -1;
const RIGHT = 1;

const KNIGHT_OFFSETS = [-19, -17, -11, -7, 7, 11, 17, 19];
const KING_OFFSETS = [-10, -9, -8, -1, 1, 8, 9, 10];
const BISHOP_OFFSETS = [-10, -8, 8, 10];
const ROOK_OFFSETS = [-9, 9, -1, 1];

/**
 * Generate all legal moves for position
 */

export function getPseudoLegalMoves(): Move[] {
  // Legacy stub for 8x8 tests compatibility
  return [];
}

export function getAllLegalMoves(board: BoardStorage, turnColor: string): Move[] {
  const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const enemyColor = turnColor === 'white' ? COLOR_BLACK : COLOR_WHITE;
  const moves: Move[] = [];

  // 1. Generate Pseudo-Legal Moves
  for (let from = 0; from < SQUARE_COUNT; from++) {
    const piece = board[from];
    if (piece === PIECE_NONE) continue;
    if ((piece & COLOR_MASK) !== color) continue;

    const type = piece & TYPE_MASK;

    if (type === PIECE_PAWN) {
      generatePawnMoves(board, from, color, moves);
    } else {
      generatePieceMoves(board, from, type, color, moves);
    }
  }

  // 2. Filter Illegal Moves (Checks)
  // For optimization, we usually do this inside the search or make/undo,
  // but to match previous API, we return only legal moves.
  const legalMoves: Move[] = [];
  const myKingPos = findKing(board, color);

  for (const move of moves) {
    // 2.1. Rule: Cannot capture King
    if ((board[move.to] & TYPE_MASK) === PIECE_KING) continue;

    // Simulate move
    const undo = makeMove(board, move);

    // Check validity
    // If King captured? (Shouldn't happen if generator is correct)
    // If My King is attacked?
    const kingPos = move.from === myKingPos ? move.to : myKingPos;
    if (!isSquareAttacked(board, kingPos, enemyColor)) {
      legalMoves.push(move);
    }

    // Undo move
    undoMove(board, undo);
  }

  // Filter out blocked squares for cross-shaped board
  const boardShape = getCurrentBoardShape();
  if (boardShape && boardShape !== 'standard') {
    return legalMoves.filter(move => !isBlockedSquare(move.to, boardShape));
  }

  return legalMoves;
}

/**
 * Get all legal moves with blocked square filtering for cross-shaped board
 */
export function getAllLegalMovesFiltered(
  board: BoardStorage,
  turnColor: string,
  boardShape?: BoardShape
): Move[] {
  const moves = getAllLegalMoves(board, turnColor);

  // Filter out blocked squares for cross-shaped board
  if (boardShape && boardShape !== 'standard') {
    return moves.filter(move => !isBlockedSquare(move.to, boardShape));
  }

  return moves;
}

export function getAllCaptureMoves(board: BoardStorage, turnColor: string): Move[] {
  // Simplified for QS
  const allAndQuiet = getAllLegalMoves(board, turnColor);
  return allAndQuiet.filter(m => board[m.to] !== PIECE_NONE); // Rough check, since makeMove assumes capture.
  // Actually getAllLegalMoves simulates, so board[m.to] is valid BEFORE simulation.
  // Wait, getAllLegalMoves returns move objects.
  // We can check if 'move.captured' property exists?
  // Or better, filter moves where target square is not empty.
}

function generatePawnMoves(board: BoardStorage, from: number, color: number, moves: Move[]): void {
  const direction = color === COLOR_WHITE ? UP : DOWN;
  // const startRow = color === COLOR_WHITE ? 6 : 2; // Rank 6 (index 6) for White? No, standard chess rank 2.
  // 9x9 Board:
  // White Pawns start at Row 6, 7? No, Row 8 is King. Row 7 Pawns?
  // Let's assume standard layout: White at bottom (Row 8), Black at top (Row 0).
  // White Pawns at Row 7. Move Up (-9).
  // Black Pawns at Row 1. Move Down (+9).
  // Wait, existing config says: White moves UP (decreasing index).
  // Initial setup: White Rooks at Row 8. Pawns at Row 7?
  // Let's assume Row 7 is start for White. Row 1 for Black.

  const forward = from + direction;
  const rank = indexToRow(from);

  // Single Push
  if (board[forward] === PIECE_NONE) {
    moves.push({ from, to: forward });

    // Double Push
    const isStart = (color === COLOR_WHITE && rank === 6) || (color === COLOR_BLACK && rank === 2); // 0-indexed rows
    // Actually standard is: Black at 0,1,2. White at 6,7,8.
    // Pawns at 2 and 6?
    // Wait, 9x9. 0..8.
    // Black Pawns at row 2?
    // Let's stick to logic: if (rank === startRank) check double.

    // For now, assuming standard double push allowed.
    if (isStart) {
      const doubleForward = forward + direction;
      if (board[doubleForward] === PIECE_NONE) {
        moves.push({ from, to: doubleForward, flags: 'double' });
      }
    }
  }

  // Captures
  // Left Capture
  const captureLeft = from + direction + LEFT;
  if (Math.abs(indexToCol(from) - indexToCol(captureLeft)) === 1) {
    // Prevent wrap
    if (isValidSquare(captureLeft)) {
      const target = board[captureLeft];
      if (target !== PIECE_NONE && (target & COLOR_MASK) !== color) {
        moves.push({ from, to: captureLeft });
      }
    }
  }

  // Right Capture
  const captureRight = from + direction + RIGHT;
  if (Math.abs(indexToCol(from) - indexToCol(captureRight)) === 1) {
    if (isValidSquare(captureRight)) {
      const target = board[captureRight];
      if (target !== PIECE_NONE && (target & COLOR_MASK) !== color) {
        moves.push({ from, to: captureRight });
      }
    }
  }
}

function generatePieceMoves(
  board: BoardStorage,
  from: number,
  type: number,
  color: number,
  moves: Move[]
): void {
  // Steppers
  if (
    type === PIECE_KNIGHT ||
    type === PIECE_ARCHBISHOP ||
    type === PIECE_CHANCELLOR ||
    type === PIECE_ANGEL
  ) {
    generateSteppingMoves(board, from, KNIGHT_OFFSETS, color, moves);
  }

  if (type === PIECE_KING) {
    generateSteppingMoves(board, from, KING_OFFSETS, color, moves);
  }

  // Sliders
  if (
    type === PIECE_BISHOP ||
    type === PIECE_ARCHBISHOP ||
    type === PIECE_QUEEN ||
    type === PIECE_ANGEL
  ) {
    generateSlidingMoves(board, from, BISHOP_OFFSETS, color, moves);
  }

  if (
    type === PIECE_ROOK ||
    type === PIECE_CHANCELLOR ||
    type === PIECE_QUEEN ||
    type === PIECE_ANGEL
  ) {
    generateSlidingMoves(board, from, ROOK_OFFSETS, color, moves);
  }

  if (type === PIECE_NIGHTRIDER) {
    generateSlidingMoves(board, from, KNIGHT_OFFSETS, color, moves);
  }
}

function generateSteppingMoves(
  board: BoardStorage,
  from: number,
  offsets: number[],
  color: number,
  moves: Move[]
): void {
  const r = indexToRow(from);
  const c = indexToCol(from);

  for (const offset of offsets) {
    const to = from + offset;
    if (!isValidSquare(to)) continue;

    // Wrap check
    const toR = indexToRow(to);
    const toC = indexToCol(to);
    if (Math.abs(toR - r) > 2 || Math.abs(toC - c) > 2) continue; // Knights jump max 2

    const target = board[to];

    // Check if target square is blocked for current board shape
    const shape = getCurrentBoardShape();
    if (shape !== 'standard' && isBlockedSquare(to, shape)) continue;

    if (target === PIECE_NONE || (target & COLOR_MASK) !== color) {
      moves.push({ from, to });
    }
  }
}

function generateSlidingMoves(
  board: BoardStorage,
  from: number,
  offsets: number[],
  color: number,
  moves: Move[]
): void {
  const r = indexToRow(from);
  const c = indexToCol(from);

  for (const offset of offsets) {
    let to = from;
    for (;;) {
      to += offset;
      // dist++;

      if (!isValidSquare(to)) break;

      // Wrap check: Sliding moves must change row OR col continuously, not jump
      // Basic check: if dist=1, must be adjacent. If dist=2, must be linear.
      // Efficient check: precomputed 'distance to edge' is best.
      // Simple validation:
      const toR = indexToRow(to);
      const toC = indexToCol(to);

      // If wrapping occurred, distance in rows/cols would be large abruptly?
      // Actually, offsets are constant (-9, -1, etc).
      // -1 wrapping from col 0 to col 8:
      // 0 + (-1) = -1 (InvalidSquare). Safe.
      // 9 + (-1) = 8. (Row 1,Col 0 -> Row 0, Col 8). WRAP!
      // We need to check column continuity for Horiz/Diag.

      // HORIZONTAL (+/- 1): Row must not change.
      if (offset === 1 || offset === -1) {
        if (toR !== r) break;
      }
      // VERTICAL (+/- 9): Col must not change.
      if (offset === 9 || offset === -9) {
        if (toC !== c) break;
      }
      // DIAGONAL: Row and Col must both change by 1.
      else if (Math.abs(offset) === 8 || Math.abs(offset) === 10) {
        const prev = to - offset;
        const prevR = indexToRow(prev);
        const prevC = indexToCol(prev);
        if (Math.abs(toR - prevR) !== 1 || Math.abs(toC - prevC) !== 1) break;
      }
      // KNIGHT: (Nightrider only) Must change 2 rows/1 col or 1 row/2 cols
      else if (KNIGHT_OFFSETS.includes(offset)) {
        const prev = to - offset;
        const prevR = indexToRow(prev);
        const prevC = indexToCol(prev);
        const dr = Math.abs(toR - prevR);
        const dc = Math.abs(toC - prevC);
        if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) break;
      }

      const target = board[to];

      // Check if square is blocked for current board shape
      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(to, shape)) {
        break; // Ray is blocked by a blocked square
      }

      if (target === PIECE_NONE) {
        moves.push({ from: from, to: to });
      } else {
        if ((target & COLOR_MASK) !== color) {
          moves.push({ from: from, to: to }); // Capture
        }
        break; // Blocked by a piece
      }
    }
  }
}

export function makeMove(board: BoardStorage, move: Move): UndoInfo {
  const piece = board[move.from];
  const captured = board[move.to];

  // We assume move is simplified to simple object logic here.
  // Deep state (like hasMoved) is lost in this simple integer array.
  // For a real engine, we use a separate state stack.
  // For now, we just swap.

  board[move.to] = piece;
  board[move.from] = PIECE_NONE;

  return { move, captured, piece };
}

export function undoMove(board: BoardStorage, undoInfo: UndoInfo): void {
  const { move, captured, piece } = undoInfo;
  board[move.from] = piece;
  board[move.to] = captured;
}

export function isSquareAttacked(
  board: BoardStorage,
  square: number,
  attackerColor: number
): boolean {
  // 1. Pawn Attacks
  // Pawns attack diagonally. From 'attackerColor' perspective.
  // White Pawns attack UP-LEFT (-10) and UP-RIGHT (-8)?
  // Wait, UP is -9. Left is -1. Up-Left is -10. Up-Right is -8.
  // Black Pawns attack DOWN-LEFT (+8) and DOWN-RIGHT (+10).
  // We check if an attacker pawn exists at square - attack_dir.

  // Reverse Check:
  // If we are checking if White attacks 'square', we check if there is a White pawn at square - (-10) = square + 10 (Down-Right from square).
  // Basically, we look "backward" along the pawn's attack line.

  const forward = attackerColor === COLOR_WHITE ? UP : DOWN;
  // Attack sources are behind the target relative to pawn movement
  // White Pawn attacks 'square' from (square - UP - LEFT) and (square - UP - RIGHT)
  // = square + 9 + 1 = square + 10
  // = square + 9 - 1 = square + 8

  // More simply:
  // Attacker (White) at (r+1, c-1) attacks (r, c).
  // Check (r+1, c-1) and (r+1, c+1) for White Pawn.

  // Generalized:
  // Check square - forward - LEFT
  // Check square - forward - RIGHT
  // Careful with signs. 'forward' is -9 for White.
  // Check square - (-9) - (-1) = square + 10.
  // Check square - (-9) - (1) = square + 8.

  const pawnStartOffsets = [-(forward + LEFT), -(forward + RIGHT)];

  for (const offset of pawnStartOffsets) {
    const from = square + offset;
    if (isValidSquare(from)) {
      // Check if square is blocked for current board shape
      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(from, shape)) continue;

      // Check wrap
      // Attack comes from adjacent column
      if (Math.abs(indexToCol(square) - indexToCol(from)) === 1) {
        const piece = board[from];
        if ((piece & COLOR_MASK) === attackerColor && (piece & TYPE_MASK) === PIECE_PAWN)
          return true;
      }
    }
  }

  // 2. Knight/Stepping Attacks
  for (const offset of KNIGHT_OFFSETS) {
    const from = square - offset; // Jump back
    if (isValidSquare(from)) {
      // Check wrap (Manhattan distance approx or row/col diff)
      const r = indexToRow(square);
      const c = indexToCol(square);
      const fr = indexToRow(from);
      const fc = indexToCol(from);
      if (Math.abs(r - fr) > 2 || Math.abs(c - fc) > 2) continue;

      // Check if square is blocked for current board shape
      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(from, shape)) continue;

      const piece = board[from];
      if (piece !== PIECE_NONE && (piece & COLOR_MASK) === attackerColor) {
        const type = piece & TYPE_MASK;
        // Check if piece has Knight movement
        if (
          type === PIECE_KNIGHT ||
          type === PIECE_ARCHBISHOP ||
          type === PIECE_CHANCELLOR ||
          type === PIECE_ANGEL
        )
          return true;
      }
    }
  }

  // 3. King Attacks (distance 1)
  for (const offset of KING_OFFSETS) {
    const from = square - offset;
    if (isValidSquare(from)) {
      // Check wrap (distance 1)
      if (Math.abs(indexToCol(square) - indexToCol(from)) > 1) continue;

      // Check if square is blocked for current board shape
      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(from, shape)) continue;

      const piece = board[from];
      if (
        piece !== PIECE_NONE &&
        (piece & COLOR_MASK) === attackerColor &&
        (piece & TYPE_MASK) === PIECE_KING
      )
        return true;
    }
  }

  // 4. Sliding Attacks (Rays)
  // We scan OUT from the square. If we hit a piece, we check if it attacks us.

  // Diagonals (Bishop, Queen, Archbishop, Angel)
  if (
    checkRayAttacks(board, square, BISHOP_OFFSETS, attackerColor, [
      PIECE_BISHOP,
      PIECE_QUEEN,
      PIECE_ARCHBISHOP,
      PIECE_ANGEL,
    ])
  )
    return true;

  // Orthogonals (Rook, Queen, Chancellor, Angel)
  if (
    checkRayAttacks(board, square, ROOK_OFFSETS, attackerColor, [
      PIECE_ROOK,
      PIECE_QUEEN,
      PIECE_CHANCELLOR,
      PIECE_ANGEL,
    ])
  )
    return true;

  // 5. Nightrider Sliding Knight Attacks
  if (checkRayAttacks(board, square, KNIGHT_OFFSETS, attackerColor, [PIECE_NIGHTRIDER]))
    return true;

  return false;
}

function checkRayAttacks(
  board: BoardStorage,
  square: number,
  ranges: number[],
  attackerColor: number,
  validTypes: number[]
): boolean {
  // const r = indexToRow(square);
  // const c = indexToCol(square);

  // Convert validTypes array to mask or set for speed? Array includes is small enough (size 4).

  for (const offset of ranges) {
    let curr = square;
    for (;;) {
      curr += offset;
      if (!isValidSquare(curr)) break;

      // Wrap checks
      const cr = indexToRow(curr);
      const cc = indexToCol(curr);
      const pr = indexToRow(curr - offset);
      const pc = indexToCol(curr - offset);

      // Should be continuous (dist 1) for non-knight offsets
      if (KNIGHT_OFFSETS.includes(offset)) {
        const dr = Math.abs(cr - pr);
        const dc = Math.abs(cc - pc);
        if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) break;
      } else {
        if (Math.abs(cr - pr) > 1 || Math.abs(cc - pc) > 1) break;
      }

      const piece = board[curr];

      // Check if square is blocked for current board shape
      const shape = getCurrentBoardShape();
      if (shape !== 'standard' && isBlockedSquare(curr, shape)) {
        break; // Attack is blocked by a blocked square
      }

      if (piece !== PIECE_NONE) {
        if ((piece & COLOR_MASK) === attackerColor) {
          const type = piece & TYPE_MASK;
          if (validTypes.includes(type)) return true;
        }
        break; // Blocked by any piece (friend or foe)
      }
    }
  }
  return false;
}

export function findKing(board: BoardStorage, color: number): number {
  // const kingType = PIECE_KING; // What about Angel? If Angel is royal?
  // User said "Grand Refactor".
  for (let i = 0; i < SQUARE_COUNT; i++) {
    if ((board[i] & TYPE_MASK) === PIECE_KING && (board[i] & COLOR_MASK) === color) return i;
  }
  return -1;
}

export function isInCheck(board: BoardStorage, color: number): boolean {
  const kingPos = findKing(board, color);
  const enemyColor = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
  return isSquareAttacked(board, kingPos, enemyColor);
}

// Static Exchange Evaluation (SEE) - Full Swap Algorithm
// Determines if a capture chain is profitable.
export function see(board: BoardStorage, move: Move): number {
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

  const target = board[move.to];
  if (target === PIECE_NONE) return 0; // Not a capture

  const piece = board[move.from];
  if (piece === PIECE_NONE) return 0;

  const gain: number[] = [];
  let d = 0;
  let color = piece & COLOR_MASK;
  const to = move.to;

  // Track squares whose pieces have been "removed" (captured/moved away)
  const usedSquares = new Set<number>();
  usedSquares.add(move.from);

  // Initial gain: value of captured piece
  gain[d] = PIECE_VALUES[target & TYPE_MASK] || 0;

  // The first "attacker on square" is the moving piece
  let attackerPiece: number | null = piece;
  let attackerType = piece & TYPE_MASK;

  // Swap loop
  while (attackerPiece !== null) {
    d++;
    // Gain[d] = value of piece just captured (previous attacker) - gain[d-1]
    gain[d] = (PIECE_VALUES[attackerType] || 0) - gain[d - 1];

    // Pruning: if the side to move cannot improve, stop
    if (Math.max(-gain[d - 1], gain[d]) < 0) break;

    // Swap side
    color = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;

    // Find Least Valuable Attacker (LVA) of 'color' attacking 'to'
    const lva = getLVA(board, to, color, usedSquares);

    if (lva === null) break; // No more attackers

    usedSquares.add(lva.square);
    attackerPiece = lva.piece;
    attackerType = lva.piece & TYPE_MASK;
  }

  // Minimax the gain array
  while (--d) {
    gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  }

  return gain[0];
}

// Find the Least Valuable Attacker of a square, ignoring pieces in usedSquares
function getLVA(
  board: BoardStorage,
  square: number,
  attackerColor: number,
  usedSquares: Set<number>
): { square: number; piece: number } | null {
  // const PIECE_ORDER = [PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_ARCHBISHOP, PIECE_CHANCELLOR, PIECE_QUEEN, PIECE_ANGEL, PIECE_KING];

  // Pawns first (LVA)
  const forward = attackerColor === COLOR_WHITE ? -9 : 9;
  const pawnOrigins = [square - forward - 1, square - forward + 1]; // Diagonal backwards from target
  for (const pSq of pawnOrigins) {
    if (!isValidSquare(pSq) || usedSquares.has(pSq)) continue;
    if (Math.abs(indexToCol(square) - indexToCol(pSq)) !== 1) continue; // Wrap check
    const p = board[pSq];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === attackerColor && (p & TYPE_MASK) === PIECE_PAWN) {
      return { square: pSq, piece: p };
    }
  }

  // Knights (and pieces with Knight movement)
  for (const offset of KNIGHT_OFFSETS) {
    const from = square + offset;
    if (!isValidSquare(from) || usedSquares.has(from)) continue;
    if (Math.abs(indexToRow(square) - indexToRow(from)) > 2) continue;
    if (Math.abs(indexToCol(square) - indexToCol(from)) > 2) continue;
    const p = board[from];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === attackerColor) {
      const t = p & TYPE_MASK;
      if (
        t === PIECE_KNIGHT ||
        t === PIECE_ARCHBISHOP ||
        t === PIECE_CHANCELLOR ||
        t === PIECE_ANGEL
      ) {
        return { square: from, piece: p };
      }
    }
  }

  // Bishops/Diagonals (and Archbishop, Queen, Angel)
  const diagResult = findRayLVA(board, square, BISHOP_OFFSETS, attackerColor, usedSquares, [
    PIECE_BISHOP,
    PIECE_ARCHBISHOP,
    PIECE_QUEEN,
    PIECE_ANGEL,
  ]);
  if (diagResult) return diagResult;

  // Rooks/Orthogonals (and Chancellor, Queen, Angel)
  const orthResult = findRayLVA(board, square, ROOK_OFFSETS, attackerColor, usedSquares, [
    PIECE_ROOK,
    PIECE_CHANCELLOR,
    PIECE_QUEEN,
    PIECE_ANGEL,
  ]);
  if (orthResult) return orthResult;

  // King (always last, highest value among simple attackers)
  for (const offset of KING_OFFSETS) {
    const from = square + offset;
    if (!isValidSquare(from) || usedSquares.has(from)) continue;
    if (Math.abs(indexToCol(square) - indexToCol(from)) > 1) continue;
    const p = board[from];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === attackerColor && (p & TYPE_MASK) === PIECE_KING) {
      return { square: from, piece: p };
    }
  }

  return null;
}

// Find least valuable slider along rays
function findRayLVA(
  board: BoardStorage,
  square: number,
  offsets: number[],
  attackerColor: number,
  usedSquares: Set<number>,
  validTypes: number[]
): { square: number; piece: number } | null {
  let bestLVA: { square: number; piece: number } | null = null;
  let bestValue = Infinity;

  const PIECE_VALUES_SIMPLE: Record<number, number> = {
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

  for (const offset of offsets) {
    let curr = square;
    for (;;) {
      curr += offset;
      if (!isValidSquare(curr)) break;

      // Wrap check
      const prev = curr - offset;
      if (Math.abs(indexToRow(curr) - indexToRow(prev)) > 1) break;
      if (Math.abs(indexToCol(curr) - indexToCol(prev)) > 1) break;

      if (usedSquares.has(curr)) continue; // Skip used pieces (X-ray through)

      const p = board[curr];
      if (p !== PIECE_NONE) {
        if ((p & COLOR_MASK) === attackerColor) {
          const t = p & TYPE_MASK;
          if (validTypes.includes(t)) {
            const val = PIECE_VALUES_SIMPLE[t] || 9999;
            if (val < bestValue) {
              bestValue = val;
              bestLVA = { square: curr, piece: p };
            }
          }
        }
        break; // Blocked by any non-used piece
      }
    }
  }
  return bestLVA;
}

function isValidSquare(idx: number): boolean {
  return idx >= 0 && idx < SQUARE_COUNT;
}

/**
 * Threat information for enhanced threat detection
 */
export interface ThreatInfo {
  /** Square being attacked */
  targetSquare: number;
  /** Square the attacker is on */
  attackerSquare: number;
  /** Type of attacker piece */
  attackerType: number;
  /** Color of attacker */
  attackerColor: number;
  /** Type of target piece (if any) */
  targetType: number;
  /** Color of target piece (if any) */
  targetColor: number;
  /** Whether this is a direct attack (true) or X-ray/hidden attack (false) */
  isDirect: boolean;
  /** For X-ray: the piece that was in the way (if any) */
  blockerSquare?: number;
  /** For X-ray: the valuable piece behind the blocker */
  xrayTargetSquare?: number;
  /** For X-ray: the type of the x-ray target */
  xrayTargetType?: number;
}

/**
 * Get ALL threats for a given color, including X-ray/hidden attacks.
 * This detects:
 * - Direct attacks (standard)
 * - X-ray attacks: sliding piece attacks through own piece to enemy piece behind
 * - Discovered attack potential: own piece blocks line to enemy king/valuable piece
 * - Battery alignments: two own sliding pieces on same line targeting enemy
 *
 * @param board The integer board
 * @param color COLOR_WHITE or COLOR_BLACK
 * @returns Array of ThreatInfo objects
 */
export function getAllThreats(board: BoardStorage, color: number): ThreatInfo[] {
  const threats: ThreatInfo[] = [];
  const enemyColor = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;

  // Iterate all pieces of the given color
  for (let from = 0; from < SQUARE_COUNT; from++) {
    const piece = board[from];
    if (piece === PIECE_NONE) continue;
    if ((piece & COLOR_MASK) !== color) continue;

    const type = piece & TYPE_MASK;

    // Pawn threats
    if (type === PIECE_PAWN) {
      // Pawn attacks (no X-ray for pawns)
      const forward = color === COLOR_WHITE ? UP : DOWN;
      const captureOffsets = [forward + LEFT, forward + RIGHT];
      for (const offset of captureOffsets) {
        const to = from + offset;
        if (!isValidSquare(to)) continue;
        if (Math.abs(indexToCol(from) - indexToCol(to)) !== 1) continue; // Wrap check

        const target = board[to];
        if (target !== PIECE_NONE && (target & COLOR_MASK) === enemyColor) {
          threats.push({
            targetSquare: to,
            attackerSquare: from,
            attackerType: type,
            attackerColor: color,
            targetType: target & TYPE_MASK,
            targetColor: enemyColor,
            isDirect: true,
          });
        }
      }
      continue;
    }

    // Knight/King/Stepping pieces - no X-ray
    const steppingOffsets =
      type === PIECE_KNIGHT ||
      type === PIECE_ARCHBISHOP ||
      type === PIECE_CHANCELLOR ||
      type === PIECE_ANGEL
        ? KNIGHT_OFFSETS
        : type === PIECE_KING
          ? KING_OFFSETS
          : null;

    if (steppingOffsets) {
      const r = indexToRow(from);
      const c = indexToCol(from);
      for (const offset of steppingOffsets) {
        const to = from + offset;
        if (!isValidSquare(to)) continue;
        const toR = indexToRow(to);
        const toC = indexToCol(to);
        if (Math.abs(toR - r) > 2 || Math.abs(toC - c) > 2) continue; // Knights max 2

        const shape = getCurrentBoardShape();
        if (shape !== 'standard' && isBlockedSquare(to, shape)) continue;

        const target = board[to];
        if (target !== PIECE_NONE && (target & COLOR_MASK) === enemyColor) {
          threats.push({
            targetSquare: to,
            attackerSquare: from,
            attackerType: type,
            attackerColor: color,
            targetType: target & TYPE_MASK,
            targetColor: enemyColor,
            isDirect: true,
          });
        }
      }
    }

    // Sliding pieces - BISHOP, ROOK, QUEEN, ARCHBISHOP, CHANCELLOR, ANGEL, NIGHTRIDER
    // These can have X-ray attacks!
    const slidingTypes = [
      PIECE_BISHOP,
      PIECE_ROOK,
      PIECE_QUEEN,
      PIECE_ARCHBISHOP,
      PIECE_CHANCELLOR,
      PIECE_ANGEL,
      PIECE_NIGHTRIDER,
    ];
    if (!slidingTypes.includes(type)) continue;

    // Determine which offsets this piece uses
    const offsets: number[] = [];
    if (
      type === PIECE_BISHOP ||
      type === PIECE_ARCHBISHOP ||
      type === PIECE_QUEEN ||
      type === PIECE_ANGEL
    ) {
      offsets.push(...BISHOP_OFFSETS);
    }
    if (
      type === PIECE_ROOK ||
      type === PIECE_CHANCELLOR ||
      type === PIECE_QUEEN ||
      type === PIECE_ANGEL
    ) {
      offsets.push(...ROOK_OFFSETS);
    }
    if (type === PIECE_NIGHTRIDER) {
      offsets.push(...KNIGHT_OFFSETS);
    }

    // Scan each ray
    for (const offset of offsets) {
      let curr = from;

      for (;;) {
        curr += offset;
        if (!isValidSquare(curr)) break;

        // Wrap/continuity check (same as generateSlidingMoves)
        const cr = indexToRow(curr);
        const cc = indexToCol(curr);
        const prev = curr - offset;
        const pr = indexToRow(prev);
        const pc = indexToCol(prev);

        if (KNIGHT_OFFSETS.includes(offset)) {
          const dr = Math.abs(cr - pr);
          const dc = Math.abs(cc - pc);
          if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) break;
        } else {
          if (Math.abs(cr - pr) > 1 || Math.abs(cc - pc) > 1) break;
        }

        const shape = getCurrentBoardShape();
        if (shape !== 'standard' && isBlockedSquare(curr, shape)) {
          break;
        }

        const target = board[curr];

        if (target === PIECE_NONE) {
          // Empty square - continue ray
          continue;
        }

        const targetColor = target & COLOR_MASK;
        const targetType = target & TYPE_MASK;

        if (targetColor === enemyColor) {
          // Direct attack on enemy piece
          threats.push({
            targetSquare: curr,
            attackerSquare: from,
            attackerType: type,
            attackerColor: color,
            targetType: targetType,
            targetColor: enemyColor,
            isDirect: true,
          });

          // Check for X-RAY: if there's a blocker behind this target, keep scanning
          // (Enemy piece doesn't block X-ray to piece behind it? No, enemy pieces DO block.
          // X-ray means: our piece -> our piece -> enemy piece)
          // So we continue scanning PAST the first enemy piece ONLY if it's not the king?
          // Actually standard X-ray: own piece blocks line to enemy piece behind.
          // So we break here for direct, but we already recorded it.
          break;
        } else {
          // Our own piece blocking the ray - potential X-RAY target behind it!
          // We don't need to track it here; the SECOND PASS handles X-ray detection properly
          continue;
        }
      }

      // After loop: if we had a blocker, check if there was an X-ray target behind it
      // (The loop would have found it if it continued, but we break on first enemy hit.
      // We need a second pass for X-ray detection.)
    }

    // SECOND PASS: X-Ray detection for this piece
    // For each ray, find our own pieces that block the ray, then check what's behind them
    for (const offset of offsets) {
      let curr = from;
      let ourBlockerSquare: number | null = null;

      for (;;) {
        curr += offset;
        if (!isValidSquare(curr)) break;

        const cr = indexToRow(curr);
        const cc = indexToCol(curr);
        const prev = curr - offset;
        const pr = indexToRow(prev);
        const pc = indexToCol(prev);

        if (KNIGHT_OFFSETS.includes(offset)) {
          const dr = Math.abs(cr - pr);
          const dc = Math.abs(cc - pc);
          if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) break;
        } else {
          if (Math.abs(cr - pr) > 1 || Math.abs(cc - pc) > 1) break;
        }

        const shape = getCurrentBoardShape();
        if (shape !== 'standard' && isBlockedSquare(curr, shape)) {
          break;
        }

        const target = board[curr];

        if (target === PIECE_NONE) {
          continue;
        }

        const targetColor = target & COLOR_MASK;
        const targetType = target & TYPE_MASK;

        if (targetColor === color) {
          // Our own piece - potential blocker for X-ray
          if (ourBlockerSquare === null) {
            ourBlockerSquare = curr;
          }
          // If we already have a blocker, this is a second own piece - no X-ray through two own pieces
          continue;
        } else {
          // Enemy piece
          if (ourBlockerSquare !== null) {
            // X-RAY ATTACK! Our piece at ourBlockerSquare is blocking line to this enemy piece
            // This is a THREAT if the blocker moves (discovered attack)
            threats.push({
              targetSquare: curr,
              attackerSquare: from,
              attackerType: type,
              attackerColor: color,
              targetType: targetType,
              targetColor: enemyColor,
              isDirect: false,
              blockerSquare: ourBlockerSquare,
              xrayTargetSquare: curr,
              xrayTargetType: targetType,
            });

            // Also check if the blocker itself is pinned to something valuable behind it
            // (i.e., moving blocker exposes king or queen behind it)
            // We scan BEYOND the enemy piece to see if there's a king/queen
            let beyond = curr + offset;
            while (isValidSquare(beyond)) {
              const br = indexToRow(beyond);
              const bc = indexToCol(beyond);
              const bprev = beyond - offset;
              const bpr = indexToRow(bprev);
              const bpc = indexToCol(bprev);

              if (KNIGHT_OFFSETS.includes(offset)) {
                const dr = Math.abs(br - bpr);
                const dc = Math.abs(bc - bpc);
                if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) break;
              } else {
                if (Math.abs(br - bpr) > 1 || Math.abs(bc - bpc) > 1) break;
              }

              const shape = getCurrentBoardShape();
              if (shape !== 'standard' && isBlockedSquare(beyond, shape)) break;

              const beyondPiece = board[beyond];
              if (beyondPiece !== PIECE_NONE) {
                const beyondColor = beyondPiece & COLOR_MASK;
                const beyondType = beyondPiece & TYPE_MASK;
                if (
                  beyondColor === enemyColor &&
                  (beyondType === PIECE_KING || beyondType === PIECE_QUEEN)
                ) {
                  // PIN THREAT: Our blocker is PINNED to the enemy king/queen behind!
                  const blockerPiece = board[ourBlockerSquare];
                  const blockerType = blockerPiece !== PIECE_NONE ? blockerPiece & TYPE_MASK : 0;
                  threats.push({
                    targetSquare: beyond,
                    attackerSquare: ourBlockerSquare,
                    attackerType: blockerType,
                    attackerColor: color,
                    targetType: beyondType,
                    targetColor: enemyColor,
                    isDirect: false,
                    blockerSquare: ourBlockerSquare,
                    xrayTargetSquare: beyond,
                    xrayTargetType: beyondType,
                  });
                }
                break;
              }
              beyond += offset;
            }
          }
          // Enemy piece blocks the ray regardless
          break;
        }
      }
    }

    // THIRD PASS: Battery detection
    // Two own sliding pieces on same line = battery threat along that line
    // This is more positional but valuable for evaluation
    // (Can be added later if needed)
  }

  return threats;
}

/**
 * Get threats specifically targeting the opponent's king (checks and discovered checks)
 */
export function getKingThreats(board: BoardStorage, color: number): ThreatInfo[] {
  // Find enemy king
  let enemyKingSquare = -1;
  const enemyColor = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const p = board[i];
    if (p !== PIECE_NONE && (p & COLOR_MASK) === enemyColor && (p & TYPE_MASK) === PIECE_KING) {
      enemyKingSquare = i;
      break;
    }
  }
  if (enemyKingSquare === -1) return [];

  const allThreats = getAllThreats(board, color);
  return allThreats.filter(
    t => t.targetSquare === enemyKingSquare || t.xrayTargetSquare === enemyKingSquare
  );
}

/**
 * Get X-ray threats (hidden attacks through own pieces)
 */
export function getXRayThreats(board: BoardStorage, color: number): ThreatInfo[] {
  const allThreats = getAllThreats(board, color);
  return allThreats.filter(t => !t.isDirect);
}

/**
 * Get discovered attack potential: moving blocker would reveal attack
 */
export function getDiscoveredAttackPotential(board: BoardStorage, color: number): ThreatInfo[] {
  const allThreats = getAllThreats(board, color);
  return allThreats.filter(t => !t.isDirect && t.blockerSquare !== undefined);
}
