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
import { isBlockedSquare, getCurrentBoardShape, type BoardShape } from '../config.js';

export type BoardStorage = number[] | Int8Array;

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export function getPseudoLegalMoves(
  _board: any,
  _r: any,
  _c: any,
  _piece: any,
  _isCheck: any,
  _lastMove: any
): any[] {
  // Legacy stub for 8x8 tests compatibility
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllLegalMoves(board: BoardStorage, turnColor: string): any[] {
  const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const enemyColor = turnColor === 'white' ? COLOR_BLACK : COLOR_WHITE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moves: any[] = [];

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legalMoves: any[] = [];
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllLegalMovesFiltered(
  board: BoardStorage,
  turnColor: string,
  boardShape?: BoardShape
): any[] {
  const moves = getAllLegalMoves(board, turnColor);

  // Filter out blocked squares for cross-shaped board
  if (boardShape && boardShape !== 'standard') {
    return moves.filter(move => !isBlockedSquare(move.to, boardShape));
  }

  return moves;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllCaptureMoves(board: BoardStorage, turnColor: string): any[] {
  // Simplified for QS
  const allAndQuiet = getAllLegalMoves(board, turnColor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allAndQuiet.filter((m: any) => board[m.to] !== PIECE_NONE); // Rough check, since makeMove assumes capture.
  // Actually getAllLegalMoves simulates, so board[m.to] is valid BEFORE simulation.
  // Wait, getAllLegalMoves returns move objects.
  // We can check if 'move.captured' property exists?
  // Or better, filter moves where target square is not empty.
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generatePawnMoves(board: BoardStorage, from: number, color: number, moves: any[]): void {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generatePieceMoves(
  board: BoardStorage,
  from: number,
  type: number,
  color: number,
  moves: any[]
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateSteppingMoves(
  board: BoardStorage,
  from: number,
  offsets: number[],
  color: number,
  moves: any[]
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateSlidingMoves(
  board: BoardStorage,
  from: number,
  offsets: number[],
  color: number,
  moves: any[]
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeMove(board: BoardStorage, move: any): any {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function undoMove(board: BoardStorage, undoInfo: any): void {
  const { move, captured, piece } = undoInfo;
  board[move.from] = piece;
  board[move.to] = captured;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function see(board: BoardStorage, move: any): number {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRayLVA(
  board: BoardStorage,
  square: number,
  offsets: number[],
  attackerColor: number,
  usedSquares: Set<number>,
  validTypes: number[]
): { square: number; piece: number } | null {
  let bestLVA = null;
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
