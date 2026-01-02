import { BOARD_SIZE } from '../config.js';

// Constants for move generation
const KNIGHT_MOVES = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const DIAGONAL_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const ORTHOGONAL_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const KING_DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const PIECE_SLIDING_DIRS = {
  b: DIAGONAL_DIRS,
  r: ORTHOGONAL_DIRS,
  q: [...DIAGONAL_DIRS, ...ORTHOGONAL_DIRS],
  a: DIAGONAL_DIRS,
  c: ORTHOGONAL_DIRS,
  e: [...DIAGONAL_DIRS, ...ORTHOGONAL_DIRS],
};

const PIECE_STEPPING_DIRS = {
  n: KNIGHT_MOVES,
  k: KING_DIRS,
  a: KNIGHT_MOVES, // Archbishop (N+B)
  c: KNIGHT_MOVES, // Chancellor (N+R)
  e: KNIGHT_MOVES, // Angel (Q+N)
};

const PIECE_ATTACKS_DIAGONALLY = { b: true, q: true, a: true, e: true };
const PIECE_ATTACKS_ORTHOGONALLY = { r: true, q: true, c: true, e: true };

/**
 * Apply a move to the board and return undo information
 */
export function makeMove(board, move) {
  if (move === null) return null;

  const fromPiece = board[move.from.r][move.from.c];
  const capturedPiece = board[move.to.r][move.to.c];

  const undoInfo = {
    capturedPiece,
    oldHasMoved: fromPiece ? fromPiece.hasMoved : false,
    move,
  };

  board[move.to.r][move.to.c] = fromPiece;
  board[move.from.r][move.from.c] = null;

  if (fromPiece) {
    fromPiece.hasMoved = true;
  }

  return undoInfo;
}

/**
 * Undo a move
 */
export function undoMove(board, undoInfo) {
  if (undoInfo === null) return;

  const { move, capturedPiece, oldHasMoved } = undoInfo;
  const piece = board[move.to.r][move.to.c];

  if (piece) {
    piece.hasMoved = oldHasMoved;
  }

  board[move.from.r][move.from.c] = piece;
  board[move.to.r][move.to.c] = capturedPiece;
}

/**
 * Get all legal moves for a color (validating checks)
 */
export function getAllLegalMoves(board, color) {
  const moves = [];
  const kingPos = findKing(board, color);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const pieceMoves = getPseudoLegalMoves(board, r, c, piece);

        // Filter out moves that leave king in check
        for (let i = 0; i < pieceMoves.length; i++) {
          const move = pieceMoves[i];
          // Apply move temporarily
          const fromPiece = board[move.from.r][move.from.c];
          const targetPiece = board[move.to.r][move.to.c];

          board[move.to.r][move.to.c] = fromPiece;
          board[move.from.r][move.from.c] = null;

          // If king moves, pass the new position
          const currentKingPos = fromPiece.type === 'k' ? { r: move.to.r, c: move.to.c } : kingPos;

          if (!isInCheck(board, color, currentKingPos)) {
            moves.push(move);
          }

          // Undo move
          board[move.from.r][move.from.c] = fromPiece;
          board[move.to.r][move.to.c] = targetPiece;
        }
      }
    }
  }

  return moves;
}

/**
 * Get pseudo-legal moves for a piece (ignoring check)
 */
export function getPseudoLegalMoves(board, r, c, piece, onlyCaptures = false) {
  const moves = [];
  const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  const isEnemy = (r, c) => board[r][c] && board[r][c].color !== piece.color;
  const isEmpty = (r, c) => !board[r][c];

  if (piece.type === 'p') {
    const forward = piece.color === 'white' ? -1 : 1;
    // Move 1
    if (!onlyCaptures && isInside(r + forward, c) && isEmpty(r + forward, c)) {
      moves.push({ from: { r, c }, to: { r: r + forward, c } });
      // Move 2 (if not moved)
      if (piece.hasMoved === false && isInside(r + forward * 2, c) && isEmpty(r + forward * 2, c)) {
        moves.push({ from: { r, c }, to: { r: r + forward * 2, c } });
      }
    }
    // Capture
    for (const dc of [-1, 1]) {
      if (isInside(r + forward, c + dc) && isEnemy(r + forward, c + dc)) {
        moves.push({ from: { r, c }, to: { r: r + forward, c: c + dc } });
      }
    }
  } else {
    // Stepping moves
    const steppingDirs = PIECE_STEPPING_DIRS[piece.type];
    if (steppingDirs) {
      for (let i = 0; i < steppingDirs.length; i++) {
        const [dr, dc] = steppingDirs[i];
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc)) {
          if (isEnemy(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          } else if (!onlyCaptures && isEmpty(nr, nc)) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          }
        }
      }
    }

    // Sliding moves
    const slidingDirs = PIECE_SLIDING_DIRS[piece.type];
    if (slidingDirs) {
      for (let i = 0; i < slidingDirs.length; i++) {
        const [dr, dc] = slidingDirs[i];
        let nr = r + dr;
        let nc = c + dc;
        while (isInside(nr, nc)) {
          if (isEmpty(nr, nc)) {
            if (!onlyCaptures) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            }
          } else {
            if (isEnemy(nr, nc)) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }
  }

  return moves;
}

/**
 * Get all capture moves for a color (validating checks)
 */
export function getAllCaptureMoves(board, color) {
  const moves = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const pieceMoves = getPseudoLegalMoves(board, r, c, piece, true); // onlyCaptures = true

        for (const move of pieceMoves) {
          const undoInfo = makeMove(board, move);

          if (!isInCheck(board, color)) {
            moves.push(move);
          }

          undoMove(board, undoInfo);
        }
      }
    }
  }

  return moves;
}

/**
 * Check if a color is in check
 */
export function isInCheck(board, color, knownKingPos) {
  const kingPos = knownKingPos || findKing(board, color);
  if (!kingPos) return false;

  const opponentColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, kingPos.r, kingPos.c, opponentColor);
}

/**
 * Find the king for a specific color
 */
export function findKing(board, color) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (!board[r]) continue;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        return { r, c };
      }
    }
  }
  return null;
}

/**
 * Check if a square is attacked by a specific color
 */
export function isSquareAttacked(board, r, c, attackerColor) {
  // 1. Pawn attacks
  const pawnRow = attackerColor === 'white' ? 1 : -1;
  const pr = r + pawnRow;
  if (pr >= 0 && pr < BOARD_SIZE) {
    if (c > 0) {
      const piece = board[pr][c - 1];
      if (piece && piece.type === 'p' && piece.color === attackerColor) return true;
    }
    if (c < BOARD_SIZE - 1) {
      const piece = board[pr][c + 1];
      if (piece && piece.type === 'p' && piece.color === attackerColor) return true;
    }
  }

  // 2. Knight attacks
  for (let i = 0; i < 8; i++) {
    const move = KNIGHT_MOVES[i];
    const nr = r + move[0];
    const nc = c + move[1];
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      const piece = board[nr][nc];
      if (piece && piece.color === attackerColor) {
        const t = piece.type;
        if (t === 'n' || t === 'a' || t === 'c' || t === 'e') return true;
      }
    }
  }

  // 3. Sliding pieces and King
  // Diagonal
  for (let i = 0; i < 4; i++) {
    const dir = DIAGONAL_DIRS[i];
    let nr = r + dir[0];
    let nc = c + dir[1];

    // King check (dist 1)
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor) {
          if (piece.type === 'k' || PIECE_ATTACKS_DIAGONALLY[piece.type]) return true;
        }
      } else {
        // Sliding
        nr += dir[0];
        nc += dir[1];
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const nextPiece = board[nr][nc];
          if (nextPiece) {
            if (nextPiece.color === attackerColor && PIECE_ATTACKS_DIAGONALLY[nextPiece.type])
              return true;
            break;
          }
          nr += dir[0];
          nc += dir[1];
        }
      }
    }
  }

  // Orthogonal
  for (let i = 0; i < 4; i++) {
    const dir = ORTHOGONAL_DIRS[i];
    let nr = r + dir[0];
    let nc = c + dir[1];

    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor) {
          if (piece.type === 'k' || PIECE_ATTACKS_ORTHOGONALLY[piece.type]) return true;
        }
      } else {
        // Sliding
        nr += dir[0];
        nc += dir[1];
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const nextPiece = board[nr][nc];
          if (nextPiece) {
            if (nextPiece.color === attackerColor && PIECE_ATTACKS_ORTHOGONALLY[nextPiece.type])
              return true;
            break;
          }
          nr += dir[0];
          nc += dir[1];
        }
      }
    }
  }

  return false;
}

/**
 * Count pseudo-legal moves for mobility bonus (optimized)
 */
export function countMobility(board, r, c, piece) {
  let count = 0;
  const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  const isEnemy = (r, c) => board[r][c] && board[r][c].color !== piece.color;
  const isEmpty = (r, c) => !board[r][c];

  // Stepping moves
  const steppingDirs = PIECE_STEPPING_DIRS[piece.type];
  if (steppingDirs) {
    for (let i = 0; i < steppingDirs.length; i++) {
      const [dr, dc] = steppingDirs[i];
      const nr = r + dr,
        nc = c + dc;
      if (isInside(nr, nc) && (isEmpty(nr, nc) || isEnemy(nr, nc))) {
        count++;
      }
    }
  }

  // Sliding moves
  const slidingDirs = PIECE_SLIDING_DIRS[piece.type];
  if (slidingDirs) {
    for (let i = 0; i < slidingDirs.length; i++) {
      const [dr, dc] = slidingDirs[i];
      let nr = r + dr;
      let nc = c + dc;
      while (isInside(nr, nc)) {
        if (isEmpty(nr, nc)) {
          count++;
        } else {
          if (isEnemy(nr, nc)) {
            count++;
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  return count;
}
