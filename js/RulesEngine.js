/**
 * RulesEngine.js
 * Handles move validation, check detection, and game end conditions.
 */
import { BOARD_SIZE } from './config.js';

export class RulesEngine {
  constructor(game) {
    this.game = game;
  }

  get board() {
    return this.game.board;
  }

  get lastMove() {
    return this.game.lastMove;
  }

  /**
   * Returns all LEGAL moves (handling check)
   * @param {number} r
   * @param {number} c
   * @param {object} piece
   * @returns {Array}
   */
  getValidMoves(r, c, piece) {
    const pseudoMoves = this.getPseudoLegalMoves(r, c, piece);
    const legalMoves = [];

    for (const move of pseudoMoves) {
      // Simulate move
      const targetPiece = this.board[move.r][move.c];

      // Handle En Passant simulation
      let enPassantCapture = null;
      if (piece.type === 'p' && move.c !== c && !targetPiece && Math.abs(move.r - r) === 1) {
        // Diagonal move to empty square
        enPassantCapture = { r: r, c: move.c }; // The pawn being captured
      }

      this.board[move.r][move.c] = piece;
      this.board[r][c] = null;
      if (enPassantCapture) {
        this.board[enPassantCapture.r][enPassantCapture.c] = null;
      }

      // Handle Castling simulation (move rook)
      let castlingRook = null;
      let castlingRookFrom = null;
      let castlingRookTo = null;
      if (piece.type === 'k' && Math.abs(move.c - c) === 2) {
        const isKingside = move.c > c;
        const rookCol = isKingside ? BOARD_SIZE - 1 : 0;
        const rookTargetCol = isKingside ? move.c - 1 : move.c + 1;
        castlingRook = this.board[r][rookCol];
        castlingRookFrom = { r: r, c: rookCol };
        castlingRookTo = { r: r, c: rookTargetCol };

        this.board[castlingRookTo.r][castlingRookTo.c] = castlingRook;
        this.board[castlingRookFrom.r][castlingRookFrom.c] = null;
      }

      // Check if King is safe
      if (!this.isInCheck(piece.color)) {
        legalMoves.push(move);
      }

      // Undo move
      this.board[r][c] = piece;
      this.board[move.r][move.c] = targetPiece;
      if (enPassantCapture) {
        // Restore captured pawn
        this.board[enPassantCapture.r][enPassantCapture.c] = {
          type: 'p',
          color: piece.color === 'white' ? 'black' : 'white',
          hasMoved: true,
        };
      }
      if (castlingRook) {
        // Restore rook
        this.board[castlingRookFrom.r][castlingRookFrom.c] = castlingRook;
        this.board[castlingRookTo.r][castlingRookTo.c] = null;
      }
    }

    return legalMoves;
  }

  getPseudoLegalMoves(r, c, piece) {
    const moves = [];
    const directions = {
      n: [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ],
      b: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ],
      r: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
      q: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
      k: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
    };

    const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    const isFriend = (r, c) => this.board[r][c] && this.board[r][c].color === piece.color;
    const isEnemy = (r, c) => this.board[r][c] && this.board[r][c].color !== piece.color;

    if (piece.type === 'p') {
      const forward = piece.color === 'white' ? -1 : 1; // White moves UP (-1), Black moves DOWN (+1)

      // Move 1
      if (isInside(r + forward, c) && !this.board[r + forward][c]) {
        moves.push({ r: r + forward, c: c });

        // Move 2 (first move)
        if (!piece.hasMoved && isInside(r + forward * 2, c) && !this.board[r + forward * 2][c]) {
          moves.push({ r: r + forward * 2, c: c });
        }
      }

      // Capture
      [
        [forward, -1],
        [forward, 1],
      ].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc)) {
          if (isEnemy(nr, nc)) {
            moves.push({ r: nr, c: nc });
          } else if (
            this.lastMove &&
            this.lastMove.isDoublePawnPush &&
            this.lastMove.to.r === r &&
            this.lastMove.to.c === nc &&
            this.lastMove.piece.color !== piece.color
          ) {
            // En Passant
            moves.push({ r: nr, c: nc });
          }
        }
      });
    } else if (piece.type === 'n') {
      directions['n'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });
    } else if (['b', 'r', 'q'].includes(piece.type)) {
      const dirs = directions[piece.type];
      dirs.forEach(([dr, dc]) => {
        let nr = r + dr,
          nc = c + dc;
        while (isInside(nr, nc)) {
          if (this.board[nr][nc]) {
            if (isEnemy(nr, nc)) moves.push({ r: nr, c: nc });
            break; // Blocked
          }
          moves.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }
      });
    } else if (piece.type === 'a') {
      // Archbishop: Bishop + Knight
      // Bishop moves
      directions['b'].forEach(([dr, dc]) => {
        let nr = r + dr,
          nc = c + dc;
        while (isInside(nr, nc)) {
          if (this.board[nr][nc]) {
            if (isEnemy(nr, nc)) moves.push({ r: nr, c: nc });
            break; // Blocked
          }
          moves.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }
      });
      // Knight moves
      directions['n'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });
    } else if (piece.type === 'c') {
      // Chancellor: Rook + Knight
      // Rook moves
      directions['r'].forEach(([dr, dc]) => {
        let nr = r + dr,
          nc = c + dc;
        while (isInside(nr, nc)) {
          if (this.board[nr][nc]) {
            if (isEnemy(nr, nc)) moves.push({ r: nr, c: nc });
            break; // Blocked
          }
          moves.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }
      });
      // Knight moves
      directions['n'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });
    } else if (piece.type === 'e') {
      // Angel: Queen + Knight
      // Queen moves
      directions['q'].forEach(([dr, dc]) => {
        let nr = r + dr,
          nc = c + dc;
        while (isInside(nr, nc)) {
          if (this.board[nr][nc]) {
            if (isEnemy(nr, nc)) moves.push({ r: nr, c: nc });
            break; // Blocked
          }
          moves.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }
      });
      // Knight moves
      directions['n'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });
    } else if (piece.type === 'k') {
      directions['k'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });

      // Castling
      if (!piece.hasMoved && !this.isInCheck(piece.color)) {
        // Kingside (right)
        const rookRight = this.board[r][BOARD_SIZE - 1];
        if (rookRight && rookRight.type === 'r' && !rookRight.hasMoved) {
          let clear = true;
          for (let i = c + 1; i < BOARD_SIZE - 1; i++) {
            if (this.board[r][i]) {
              clear = false;
              break;
            }
          }
          if (clear) {
            // Check if passing through check
            if (
              !this.isSquareUnderAttack(r, c + 1, piece.color === 'white' ? 'black' : 'white') &&
              !this.isSquareUnderAttack(r, c + 2, piece.color === 'white' ? 'black' : 'white')
            ) {
              moves.push({ r: r, c: c + 2 });
            }
          }
        }

        // Queenside (left)
        const rookLeft = this.board[r][0];
        if (rookLeft && rookLeft.type === 'r' && !rookLeft.hasMoved) {
          let clear = true;
          for (let i = 1; i < c; i++) {
            if (this.board[r][i]) {
              clear = false;
              break;
            }
          }
          if (clear) {
            // Check if passing through check
            if (
              !this.isSquareUnderAttack(r, c - 1, piece.color === 'white' ? 'black' : 'white') &&
              !this.isSquareUnderAttack(r, c - 2, piece.color === 'white' ? 'black' : 'white')
            ) {
              moves.push({ r: r, c: c - 2 });
            }
          }
        }
      }
    }

    return moves;
  }

  isSquareUnderAttack(r, c, attackerColor) {
    // Check for attacks FROM attackerColor TO (r, c)
    // We can reverse check: pretend a piece is at (r, c) and see if it hits an enemy piece of corresponding type

    const isInside = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

    // 1. Pawn attacks (diagonal)
    // If attacker is white, they attack from bottom-left/right. So we look down-left/right.
    // If attacker is black, they attack from top-left/right. So we look up-left/right.
    const pawnDir = attackerColor === 'white' ? 1 : -1; // Look in opposite direction of pawn movement
    if (isInside(r + pawnDir, c - 1)) {
      const piece = this.board[r + pawnDir][c - 1];
      if (piece && piece.color === attackerColor && piece.type === 'p') return true;
    }
    if (isInside(r + pawnDir, c + 1)) {
      const piece = this.board[r + pawnDir][c + 1];
      if (piece && piece.color === attackerColor && piece.type === 'p') return true;
    }

    // 2. Knight attacks
    const knightMoves = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dr, dc] of knightMoves) {
      if (isInside(r + dr, c + dc)) {
        const piece = this.board[r + dr][c + dc];
        if (
          piece &&
          piece.color === attackerColor &&
          (piece.type === 'n' || piece.type === 'a' || piece.type === 'c' || piece.type === 'e')
        )
          return true;
      }
    }

    // 3. Sliding pieces (Bishop/Rook/Queen) + King
    const directions = {
      b: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ],
      r: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
    };

    // Diagonals (Bishop/Queen)
    for (const [dr, dc] of directions['b']) {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        const piece = this.board[nr][nc];
        if (piece) {
          if (
            piece.color === attackerColor &&
            (piece.type === 'b' || piece.type === 'q' || piece.type === 'a' || piece.type === 'e')
          )
            return true;
          if (
            piece.color === attackerColor &&
            piece.type === 'k' &&
            Math.abs(nr - r) === 1 &&
            Math.abs(nc - c) === 1
          )
            return true; // King attack
          break; // Blocked
        }
        nr += dr;
        nc += dc;
      }
    }

    // Orthogonals (Rook/Queen)
    for (const [dr, dc] of directions['r']) {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        const piece = this.board[nr][nc];
        if (piece) {
          if (
            piece.color === attackerColor &&
            (piece.type === 'r' || piece.type === 'q' || piece.type === 'c' || piece.type === 'e')
          )
            return true;
          if (
            piece.color === attackerColor &&
            piece.type === 'k' &&
            (Math.abs(nr - r) === 1 || Math.abs(nc - c) === 1)
          )
            return true; // King attack
          break; // Blocked
        }
        nr += dr;
        nc += dc;
      }
    }

    // Archbishop Check (Bishop + Knight)
    // We already checked Knight moves (step 2) and Bishop diagonals (step 3).
    // But we need to ensure that if we find an Archbishop in those checks, it counts as an attack.

    // Re-check diagonals for Archbishop
    for (const [dr, dc] of directions['b']) {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        const piece = this.board[nr][nc];
        if (piece) {
          if (piece.color === attackerColor && (piece.type === 'a' || piece.type === 'e'))
            return true;
          break; // Blocked (already handled by previous loop, but we need to catch 'a' specifically if not caught by 'b'/'q')
        }
        nr += dr;
        nc += dc;
      }
    }

    // Re-check Knight jumps for Archbishop
    for (const [dr, dc] of knightMoves) {
      if (isInside(r + dr, c + dc)) {
        const piece = this.board[r + dr][c + dc];
        if (piece && piece.color === attackerColor && (piece.type === 'a' || piece.type === 'e'))
          return true;
      }
    }

    return false;
  }

  /**
   * Find the position of the king for a given color
   * @param {string} color - 'white' or 'black'
   * @returns {object|null} Position {r, c} or null if not found
   */
  findKing(color) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color && piece.type === 'k') {
          return { r, c };
        }
      }
    }
    return null;
  }

  isInCheck(color) {
    const kingPos = this.findKing(color);
    if (!kingPos) return false; // Should not happen

    const opponentColor = color === 'white' ? 'black' : 'white';
    return this.isSquareUnderAttack(kingPos.r, kingPos.c, opponentColor);
  }

  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;
    return this.getAllLegalMoves(color).length === 0;
  }

  getAllLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color) {
          const valid = this.getValidMoves(r, c, piece);
          valid.forEach(to => {
            moves.push({ from: { r, c }, to: to });
          });
        }
      }
    }
    return moves;
  }

  isStalemate(color) {
    if (this.isInCheck(color)) return false;
    return this.getAllLegalMoves(color).length === 0;
  }
}
