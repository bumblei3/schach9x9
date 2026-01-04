// MoveGenerator.js

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
/**
 * Apply a move to the board and return undo information
 */
export function makeMove(board, move) {
  if (move === null) return null;

  const fromPiece = board[move.from.r][move.from.c];
  const capturedPiece = board[move.to.r][move.to.c];
  const size = board.length;

  const undoInfo = {
    capturedPiece,
    oldHasMoved: fromPiece ? fromPiece.hasMoved : false,
    move,
  };

  // En Passant Capture
  if (fromPiece.type === 'p' && !capturedPiece && move.from.c !== move.to.c) {
    // It's En Passant (diagonal move to empty square)
    const direction = fromPiece.color === 'white' ? -1 : 1;
    const captureRow = move.to.r - direction;
    undoInfo.enPassantCaptured = board[captureRow][move.to.c];
    undoInfo.enPassantRow = captureRow;
    undoInfo.enPassantCol = move.to.c;
    board[captureRow][move.to.c] = null;
  }

  // Castling
  if (fromPiece.type === 'k' && Math.abs(move.from.c - move.to.c) > 1) {
    const isKingside = move.to.c > move.from.c;
    const rookCol = isKingside ? size - 1 : 0;
    const rookDestCol = isKingside ? move.to.c - 1 : move.to.c + 1;
    const rook = board[move.from.r][rookCol];

    // Move rook
    board[move.from.r][rookDestCol] = rook;
    board[move.from.r][rookCol] = null;
    rook.hasMoved = true;

    undoInfo.castling = {
      rook,
      rookFrom: { r: move.from.r, c: rookCol },
      rookTo: { r: move.from.r, c: rookDestCol },
      rookOldHasMoved: rook.hasMoved,
    };
  }

  // Handle Promotion
  if (move.promotion) {
    undoInfo.oldType = fromPiece.type;
    fromPiece.type = move.promotion;
    undoInfo.promoted = true;
  }

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

  const { move, capturedPiece, oldHasMoved, enPassantCaptured, castling } = undoInfo;
  const piece = board[move.to.r][move.to.c];

  if (piece) {
    piece.hasMoved = oldHasMoved;
  }

  board[move.from.r][move.from.c] = piece;
  board[move.to.r][move.to.c] = capturedPiece;

  // Undo Promotion
  if (undoInfo.promoted) {
    piece.type = undoInfo.oldType;
  }

  // Restore En Passant pawn
  if (enPassantCaptured) {
    board[undoInfo.enPassantRow][undoInfo.enPassantCol] = enPassantCaptured;
  }

  // Undo Castling
  if (castling) {
    const { rook, rookFrom, rookTo, rookOldHasMoved } = castling;
    board[rookFrom.r][rookFrom.c] = rook;
    board[rookTo.r][rookTo.c] = null;
    rook.hasMoved = rookOldHasMoved;
  }
}

/**
 * Get all legal moves for a color (validating checks)
 */
export function getAllLegalMoves(board, color, lastMove = null) {
  const moves = [];
  const kingPos = findKing(board, color);
  const size = board.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        // Pass lastMove to getPseudoLegalMoves for En Passant
        const pieceMoves = getPseudoLegalMoves(board, r, c, piece, false, lastMove);

        // Filter out moves that leave king in check
        for (let i = 0; i < pieceMoves.length; i++) {
          const move = pieceMoves[i];

          // Special validation for Castling: Path safety
          if (piece.type === 'k' && Math.abs(move.from.c - move.to.c) > 1) {
            if (isInCheck(board, color)) continue; // Cannot castle out of check
            // Check path squares
            const dir = Math.sign(move.to.c - move.from.c);
            const midC = move.from.c + dir;
            // Check if passing through attack
            if (isSquareAttacked(board, r, midC, color === 'white' ? 'black' : 'white')) continue;
          }

          const undoInfo = makeMove(board, move);

          // If king moves, pass the new position
          const currentKingPos = piece.type === 'k' ? { r: move.to.r, c: move.to.c } : kingPos;

          if (!isInCheck(board, color, currentKingPos)) {
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
 * Get pseudo-legal moves for a piece (ignoring check)
 */
export function getPseudoLegalMoves(board, r, c, piece, onlyCaptures = false, lastMove = null) {
  const moves = [];
  const size = board.length;
  const isInside = (r, c) => r >= 0 && r < size && c >= 0 && c < size;
  const isEnemy = (r, c) => board[r][c] && board[r][c].color !== piece.color;
  const isEmpty = (r, c) => !board[r][c];

  if (piece.type === 'p') {
    const forward = piece.color === 'white' ? -1 : 1;
    const promotionRow = piece.color === 'white' ? 0 : size - 1;

    // Move 1
    if (!onlyCaptures && isInside(r + forward, c) && isEmpty(r + forward, c)) {
      const move = { from: { r, c }, to: { r: r + forward, c } };
      if (r + forward === promotionRow) move.promotion = 'e';
      moves.push(move);
      // Move 2 (if not moved)
      if (piece.hasMoved === false && isInside(r + forward * 2, c) && isEmpty(r + forward * 2, c)) {
        moves.push({ from: { r, c }, to: { r: r + forward * 2, c } });
      }
    }
    // Capture
    for (const dc of [-1, 1]) {
      if (isInside(r + forward, c + dc)) {
        if (isEnemy(r + forward, c + dc)) {
          const move = { from: { r, c }, to: { r: r + forward, c: c + dc } };
          if (r + forward === promotionRow) move.promotion = 'e';
          moves.push(move);
        } else if (
          lastMove &&
          lastMove.piece.type === 'p' &&
          Math.abs(lastMove.from.r - lastMove.to.r) === 2 &&
          lastMove.to.r === r &&
          lastMove.to.c === c + dc
        ) {
          // En Passant logic: Opponent pawn moved 2 squares, landed next to us
          moves.push({ from: { r, c }, to: { r: r + forward, c: c + dc } });
        }
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

    // Castling (King only)
    if (!onlyCaptures && piece.type === 'k' && !piece.hasMoved) {
      // Kingside
      const kingsideRookPos = { r, c: size - 1 };
      const kr = board[kingsideRookPos.r][kingsideRookPos.c];
      if (kr && kr.type === 'r' && !kr.hasMoved) {
        let pathClear = true;
        for (let k = c + 1; k < size - 1; k++) {
          if (board[r][k]) {
            pathClear = false;
            break;
          }
        }
        if (pathClear) {
          moves.push({ from: { r, c }, to: { r, c: c + 2 } });
        }
      }

      // Queenside
      const queensideRookPos = { r, c: 0 };
      const qr = board[queensideRookPos.r][queensideRookPos.c];
      if (qr && qr.type === 'r' && !qr.hasMoved) {
        let pathClear = true;
        for (let k = 1; k < c; k++) {
          if (board[r][k]) {
            pathClear = false;
            break;
          }
        }
        if (pathClear) {
          moves.push({ from: { r, c }, to: { r, c: c - 2 } });
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
  const size = board.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
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
  const size = board.length;
  for (let r = 0; r < size; r++) {
    if (!board[r]) continue;
    for (let c = 0; c < size; c++) {
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
  const size = board.length;

  // 1. Pawn attacks
  const pawnRow = attackerColor === 'white' ? 1 : -1;
  const pr = r + pawnRow;
  if (pr >= 0 && pr < size) {
    if (c > 0) {
      const piece = board[pr][c - 1];
      if (piece && piece.type === 'p' && piece.color === attackerColor) return true;
    }
    if (c < size - 1) {
      const piece = board[pr][c + 1];
      if (piece && piece.type === 'p' && piece.color === attackerColor) return true;
    }
  }

  // 2. Knight attacks
  for (let i = 0; i < 8; i++) {
    const move = KNIGHT_MOVES[i];
    const nr = r + move[0];
    const nc = c + move[1];
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
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
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor) {
          if (piece.type === 'k' || PIECE_ATTACKS_DIAGONALLY[piece.type]) return true;
        }
      } else {
        // Sliding
        nr += dir[0];
        nc += dir[1];
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
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

    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === attackerColor) {
          if (piece.type === 'k' || PIECE_ATTACKS_ORTHOGONALLY[piece.type]) return true;
        }
      } else {
        // Sliding
        nr += dir[0];
        nc += dir[1];
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
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
  const size = board.length;
  const isInside = (r, c) => r >= 0 && r < size && c >= 0 && c < size;
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

// Piece values for SEE (same scale as AI_PIECE_VALUES)
const SEE_PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
  a: 650,
  c: 850,
  e: 1220,
};

/**
 * Static Exchange Evaluation (SEE)
 * Evaluates whether a capture sequence on a square wins or loses material.
 * @param {Array} board - The board
 * @param {Object} from - Attacker position {r, c}
 * @param {Object} to - Target position {r, c}
 * @returns {number} Material gain (positive = good capture, negative = bad)
 */
export function see(board, from, to) {
  const size = board.length;
  const attacker = board[from.r][from.c];
  const target = board[to.r][to.c];

  if (!attacker || !target) return 0;

  // Simple case: Just return MVV-LVA approximation for performance
  // Full SEE is expensive; this is a good approximation
  const victimValue = SEE_PIECE_VALUES[target.type] || 0;
  const attackerValue = SEE_PIECE_VALUES[attacker.type] || 0;

  // If victim is worth more than attacker, likely good capture
  if (victimValue >= attackerValue) return victimValue - attackerValue;

  // Check if the square is defended
  const defenderColor = target.color;

  // Find the least valuable defender
  let minDefenderValue = Infinity;

  // Check pawn defenders
  const pawnDir = defenderColor === 'white' ? -1 : 1;
  for (const dc of [-1, 1]) {
    const dr = to.r + pawnDir;
    const dc2 = to.c + dc;
    if (dr >= 0 && dr < size && dc2 >= 0 && dc2 < size) {
      const p = board[dr][dc2];
      if (p && p.type === 'p' && p.color === defenderColor) {
        minDefenderValue = Math.min(minDefenderValue, SEE_PIECE_VALUES.p);
      }
    }
  }

  // Check knight defenders
  for (const [dr, dc] of KNIGHT_MOVES) {
    const nr = to.r + dr;
    const nc = to.c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      const p = board[nr][nc];
      if (p && p.color === defenderColor && (nr !== from.r || nc !== from.c)) {
        if (p.type === 'n' || p.type === 'a' || p.type === 'c' || p.type === 'e') {
          const val = SEE_PIECE_VALUES[p.type];
          minDefenderValue = Math.min(minDefenderValue, val);
        }
      }
    }
  }

  // Check sliding defenders (simplified - just look for presence)
  for (const [dr, dc] of [...DIAGONAL_DIRS, ...ORTHOGONAL_DIRS]) {
    let nr = to.r + dr;
    let nc = to.c + dc;
    while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === defenderColor && (nr !== from.r || nc !== from.c)) {
          const isDiag = Math.abs(dr) === Math.abs(dc);
          const canAttack = isDiag
            ? PIECE_ATTACKS_DIAGONALLY[p.type]
            : PIECE_ATTACKS_ORTHOGONALLY[p.type];
          if (canAttack) {
            minDefenderValue = Math.min(minDefenderValue, SEE_PIECE_VALUES[p.type]);
          }
        }
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  // If no defenders, capture is good
  if (minDefenderValue === Infinity) return victimValue;

  // If we would lose the attacker and gain victim, calculate net
  // Simplified: if defender < attacker, we probably lose the exchange
  if (minDefenderValue <= attackerValue) {
    return victimValue - attackerValue;
  }

  return victimValue;
}

