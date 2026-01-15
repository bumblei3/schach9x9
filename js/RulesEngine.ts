/**
 * RulesEngine.ts
 * Handles move validation, check detection, and game end conditions.
 */
import type { Player, Square, Piece } from './types/game.js';
import { isBlockedCell } from './config.js';

export interface GameWithBoard {
  board: (Piece | null)[][];
  lastMove?: LastMoveInfo | null;
  boardShape?: string;
}

export interface LastMoveInfo {
  isDoublePawnPush?: boolean;
  to: Square;
  piece: Piece;
}

export interface MoveInfo {
  from: Square;
  to: Square;
}

type Direction = [number, number];

const DIRECTIONS: Record<string, Direction[]> = {
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

export class RulesEngine {
  private game: GameWithBoard;

  constructor(game: GameWithBoard) {
    this.game = game;
  }

  get board(): (Piece | null)[][] {
    return this.game.board;
  }

  get lastMove(): LastMoveInfo | null | undefined {
    return this.game.lastMove;
  }

  /**
   * Returns all LEGAL moves (handling check)
   */
  getValidMoves(r: number, c: number, piece: Piece): Square[] {
    const pseudoMoves = this.getPseudoLegalMoves(r, c, piece);
    const legalMoves: Square[] = [];

    for (const move of pseudoMoves) {
      // Simulate move
      const targetPiece = this.board[move.r][move.c];

      // Handle En Passant simulation
      let enPassantCapture: Square | null = null;
      if (piece.type === 'p' && move.c !== c && !targetPiece && Math.abs(move.r - r) === 1) {
        enPassantCapture = { r: r, c: move.c };
      }

      this.board[move.r][move.c] = piece;
      this.board[r][c] = null;
      if (enPassantCapture) {
        this.board[enPassantCapture.r][enPassantCapture.c] = null;
      }

      // Handle Castling simulation
      let castlingRook: Piece | null = null;
      let castlingRookFrom: Square | null = null;
      let castlingRookTo: Square | null = null;
      if (piece.type === 'k' && Math.abs(move.c - c) === 2) {
        const size = this.board.length;
        const isKingside = move.c > c;
        const rookCol = isKingside ? size - 1 : 0;
        const rookTargetCol = isKingside ? move.c - 1 : move.c + 1;
        castlingRook = this.board[r][rookCol];
        castlingRookFrom = { r: r, c: rookCol };
        castlingRookTo = { r: r, c: rookTargetCol };

        if (castlingRook) {
          this.board[castlingRookTo.r][castlingRookTo.c] = castlingRook;
          this.board[castlingRookFrom.r][castlingRookFrom.c] = null;
        }
      }

      // Check if King is safe
      if (!this.isInCheck(piece.color)) {
        legalMoves.push(move);
      }

      // Undo move
      this.board[r][c] = piece;
      this.board[move.r][move.c] = targetPiece;
      if (enPassantCapture) {
        this.board[enPassantCapture.r][enPassantCapture.c] = {
          type: 'p',
          color: piece.color === 'white' ? 'black' : 'white',
        };
      }
      if (castlingRook && castlingRookFrom && castlingRookTo) {
        this.board[castlingRookFrom.r][castlingRookFrom.c] = castlingRook;
        this.board[castlingRookTo.r][castlingRookTo.c] = null;
      }
    }

    return legalMoves;
  }

  getPseudoLegalMoves(r: number, c: number, piece: Piece): Square[] {
    const moves: Square[] = [];

    const size = this.board.length;
    const isInside = (r: number, c: number): boolean =>
      r >= 0 && r < size && c >= 0 && c < size && !isBlockedCell(r, c, this.game.boardShape as any);
    const isFriend = (r: number, c: number): boolean =>
      this.board[r][c] !== null && this.board[r][c]!.color === piece.color;
    const isEnemy = (r: number, c: number): boolean =>
      this.board[r][c] !== null && this.board[r][c]!.color !== piece.color;

    if (piece.type === 'p') {
      const forward = piece.color === 'white' ? -1 : 1;
      const hasMoved = (piece as Piece & { hasMoved?: boolean }).hasMoved;

      // Move 1
      if (isInside(r + forward, c) && !this.board[r + forward][c]) {
        moves.push({ r: r + forward, c: c });

        // Move 2 (first move)
        if (!hasMoved && isInside(r + forward * 2, c) && !this.board[r + forward * 2][c]) {
          moves.push({ r: r + forward * 2, c: c });
        }
      }

      // Capture
      const captureDirections: Direction[] = [
        [forward, -1],
        [forward, 1],
      ];
      captureDirections.forEach(([dr, dc]) => {
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
      DIRECTIONS['n'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });
    } else if (['b', 'r', 'q'].includes(piece.type)) {
      const dirs = DIRECTIONS[piece.type];
      dirs.forEach(([dr, dc]) => {
        let nr = r + dr,
          nc = c + dc;
        while (isInside(nr, nc)) {
          if (this.board[nr][nc]) {
            if (isEnemy(nr, nc)) moves.push({ r: nr, c: nc });
            break;
          }
          moves.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }
      });
    } else if (piece.type === 'a') {
      // Archbishop: Bishop + Knight
      this.addSlidingMoves(moves, r, c, piece, DIRECTIONS['b'], isInside, isFriend, isEnemy);
      this.addJumpMoves(moves, r, c, DIRECTIONS['n'], isInside, isFriend);
    } else if (piece.type === 'c') {
      // Chancellor: Rook + Knight
      this.addSlidingMoves(moves, r, c, piece, DIRECTIONS['r'], isInside, isFriend, isEnemy);
      this.addJumpMoves(moves, r, c, DIRECTIONS['n'], isInside, isFriend);
    } else if (piece.type === 'e') {
      // Angel: Queen + Knight
      this.addSlidingMoves(moves, r, c, piece, DIRECTIONS['q'], isInside, isFriend, isEnemy);
      this.addJumpMoves(moves, r, c, DIRECTIONS['n'], isInside, isFriend);
    } else if (piece.type === 'j') {
      // Nightrider: Sliding Knight
      this.addSlidingMoves(moves, r, c, piece, DIRECTIONS['n'], isInside, isFriend, isEnemy);
    } else if (piece.type === 'k') {
      DIRECTIONS['k'].forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (isInside(nr, nc) && !isFriend(nr, nc)) {
          moves.push({ r: nr, c: nc });
        }
      });

      // Castling
      const hasMoved = (piece as Piece & { hasMoved?: boolean }).hasMoved;
      if (!hasMoved && !this.isInCheck(piece.color)) {
        this.addCastlingMoves(moves, r, c, piece);
      }
    }

    return moves;
  }

  private addSlidingMoves(
    moves: Square[],
    r: number,
    c: number,
    _piece: Piece,
    directions: Direction[],
    isInside: (r: number, c: number) => boolean,
    _isFriend: (r: number, c: number) => boolean,
    isEnemy: (r: number, c: number) => boolean
  ): void {
    directions.forEach(([dr, dc]) => {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        if (this.board[nr][nc]) {
          if (isEnemy(nr, nc)) moves.push({ r: nr, c: nc });
          break;
        }
        moves.push({ r: nr, c: nc });
        nr += dr;
        nc += dc;
      }
    });
  }

  private addJumpMoves(
    moves: Square[],
    r: number,
    c: number,
    directions: Direction[],
    isInside: (r: number, c: number) => boolean,
    isFriend: (r: number, c: number) => boolean
  ): void {
    directions.forEach(([dr, dc]) => {
      const nr = r + dr,
        nc = c + dc;
      if (isInside(nr, nc) && !isFriend(nr, nc)) {
        moves.push({ r: nr, c: nc });
      }
    });
  }

  private addCastlingMoves(moves: Square[], r: number, c: number, piece: Piece): void {
    const opponentColor: Player = piece.color === 'white' ? 'black' : 'white';

    const size = this.board.length;
    // Kingside
    const rookRight = this.board[r][size - 1];
    if (
      rookRight &&
      rookRight.type === 'r' &&
      !(rookRight as Piece & { hasMoved?: boolean }).hasMoved
    ) {
      let clear = true;
      for (let i = c + 1; i < size - 1; i++) {
        if (this.board[r][i]) {
          clear = false;
          break;
        }
      }
      if (
        clear &&
        !this.isSquareUnderAttack(r, c + 1, opponentColor) &&
        !this.isSquareUnderAttack(r, c + 2, opponentColor)
      ) {
        moves.push({ r: r, c: c + 2 });
      }
    }

    // Queenside
    const rookLeft = this.board[r][0];
    if (
      rookLeft &&
      rookLeft.type === 'r' &&
      !(rookLeft as Piece & { hasMoved?: boolean }).hasMoved
    ) {
      let clear = true;
      for (let i = 1; i < c; i++) {
        if (this.board[r][i]) {
          clear = false;
          break;
        }
      }
      if (
        clear &&
        !this.isSquareUnderAttack(r, c - 1, opponentColor) &&
        !this.isSquareUnderAttack(r, c - 2, opponentColor)
      ) {
        moves.push({ r: r, c: c - 2 });
      }
    }
  }

  isSquareUnderAttack(r: number, c: number, attackerColor: Player): boolean {
    const size = this.board.length;
    const isInside = (r: number, c: number): boolean =>
      r >= 0 && r < size && c >= 0 && c < size && !isBlockedCell(r, c, this.game.boardShape as any);

    // Pawn attacks
    const pawnDir = attackerColor === 'white' ? 1 : -1;
    if (isInside(r + pawnDir, c - 1)) {
      const piece = this.board[r + pawnDir][c - 1];
      if (piece && piece.color === attackerColor && piece.type === 'p') return true;
    }
    if (isInside(r + pawnDir, c + 1)) {
      const piece = this.board[r + pawnDir][c + 1];
      if (piece && piece.color === attackerColor && piece.type === 'p') return true;
    }

    // Knight attacks
    for (const [dr, dc] of DIRECTIONS['n']) {
      if (isInside(r + dr, c + dc)) {
        const piece = this.board[r + dr][c + dc];
        if (piece && piece.color === attackerColor && ['n', 'a', 'c', 'e'].includes(piece.type))
          return true;
      }
    }

    // Sliding attacks (diagonals)
    for (const [dr, dc] of DIRECTIONS['b']) {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        const piece = this.board[nr][nc];
        if (piece) {
          if (piece.color === attackerColor && ['b', 'q', 'a', 'e'].includes(piece.type))
            return true;
          if (
            piece.color === attackerColor &&
            piece.type === 'k' &&
            Math.abs(nr - r) === 1 &&
            Math.abs(nc - c) === 1
          )
            return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    // Sliding attacks (orthogonals)
    for (const [dr, dc] of DIRECTIONS['r']) {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        const piece = this.board[nr][nc];
        if (piece) {
          if (piece.color === attackerColor && ['r', 'q', 'c', 'e'].includes(piece.type))
            return true;
          if (
            piece.color === attackerColor &&
            piece.type === 'k' &&
            (Math.abs(nr - r) === 1 || Math.abs(nc - c) === 1)
          )
            return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    // Nightrider attacks (sliding knight)
    for (const [dr, dc] of DIRECTIONS['n']) {
      let nr = r + dr,
        nc = c + dc;
      while (isInside(nr, nc)) {
        const piece = this.board[nr][nc];
        if (piece) {
          if (piece.color === attackerColor && piece.type === 'j') return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    return false;
  }

  /**
   * Find the position of the king for a given color
   */
  findKing(color: Player): Square | null {
    const size = this.board.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color && piece.type === 'k') {
          return { r, c };
        }
      }
    }
    return null;
  }

  isInCheck(color: Player): boolean {
    const kingPos = this.findKing(color);
    if (!kingPos) return false;

    const opponentColor: Player = color === 'white' ? 'black' : 'white';
    return this.isSquareUnderAttack(kingPos.r, kingPos.c, opponentColor);
  }

  isCheckmate(color: Player): boolean {
    if (!this.isInCheck(color)) return false;
    return this.getAllLegalMoves(color).length === 0;
  }

  getAllLegalMoves(color: Player): MoveInfo[] {
    const moves: MoveInfo[] = [];
    const size = this.board.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
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

  isStalemate(color: Player): boolean {
    if (this.isInCheck(color)) return false;
    return this.getAllLegalMoves(color).length === 0;
  }
}
