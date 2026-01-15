import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isBlockedSquare,
  isBlockedCell,
  setCurrentBoardShape,
  BOARD_SHAPES,
} from '../js/config.js';
import * as MoveGenerator from '../js/ai/MoveGenerator.js';
import {
  PIECE_ROOK,
  PIECE_KNIGHT,
  PIECE_ARCHBISHOP,
  WHITE_NIGHTRIDER,
  PIECE_NONE,
  COLOR_WHITE,
  COLOR_BLACK,
  BLACK_KING,
  WHITE_KING,
  WHITE_PAWN,
  BLACK_PAWN,
} from '../js/ai/BoardDefinitions.js';
import { Game } from '../js/gameEngine.js';
import * as aiEngine from '../js/aiEngine.js';

describe('Cross-Shaped Board Mode (Comprehensive)', () => {
  describe('Config Helper Functions', () => {
    it('isBlockedSquare should correctly identify corners in CROSS mode', () => {
      // Top-left corner
      expect(isBlockedSquare(0, BOARD_SHAPES.CROSS)).toBe(true);
      expect(isBlockedSquare(1, BOARD_SHAPES.CROSS)).toBe(true);
      expect(isBlockedSquare(2, BOARD_SHAPES.CROSS)).toBe(true);
      expect(isBlockedSquare(9, BOARD_SHAPES.CROSS)).toBe(true);
      expect(isBlockedSquare(20, BOARD_SHAPES.CROSS)).toBe(true);

      // Center (should NOT be blocked)
      expect(isBlockedSquare(40, BOARD_SHAPES.CROSS)).toBe(false); // Row 4, Col 4
      expect(isBlockedSquare(31, BOARD_SHAPES.CROSS)).toBe(false); // Row 3, Col 4

      // Top-edge of center cross corridor
      expect(isBlockedSquare(3, BOARD_SHAPES.CROSS)).toBe(false); // Row 0, Col 3
    });

    it('isBlockedCell should correctly identify corners in CROSS mode', () => {
      expect(isBlockedCell(0, 0, BOARD_SHAPES.CROSS)).toBe(true);
      expect(isBlockedCell(0, 3, BOARD_SHAPES.CROSS)).toBe(false);
      expect(isBlockedCell(3, 0, BOARD_SHAPES.CROSS)).toBe(false);
      expect(isBlockedCell(6, 6, BOARD_SHAPES.CROSS)).toBe(true);
    });
  });

  describe('MoveGenerator (Integer Engine)', () => {
    let board: Int8Array;

    beforeEach(() => {
      board = new Int8Array(81).fill(PIECE_NONE);
      setCurrentBoardShape(BOARD_SHAPES.CROSS);
    });

    it('should NOT allow stepping pieces (Knight) to land on blocked squares', () => {
      const from = 30; // Row 3, Col 3
      board[from] = PIECE_KNIGHT | COLOR_WHITE;

      const moves = MoveGenerator.getAllLegalMoves(board, 'white');

      const to11 = moves.find(m => m.from === from && m.to === 11); // Row 1, Col 2 (Blocked)
      const to13 = moves.find(m => m.from === from && m.to === 13); // Row 1, Col 4 (Valid)

      expect(to11).toBeUndefined();
      expect(to13).toBeDefined();
    });

    it('should stop sliding pieces (Rook) at the edge of blocked squares', () => {
      const from = 22; // Row 2, Col 4
      board[from] = PIECE_ROOK | COLOR_WHITE;
      board[40] = WHITE_KING; // Needed for legality check
      board[80] = BLACK_KING;

      const moves = MoveGenerator.getAllLegalMoves(board, 'white');

      const to21 = moves.find(m => m.from === from && m.to === 21); // Row 2, Col 3 (Adjacent valid)
      const to20 = moves.find(m => m.from === from && m.to === 20); // Row 2, Col 2 (Blocked)

      expect(to21).toBeDefined();
      expect(to20).toBeUndefined();
    });
  });

  describe('Game Engine Integration', () => {
    it('getAllLegalMoves should filter blocked squares for random blunders', () => {
      const game = new Game(15, 'cross');
      game.board[4][4] = { type: 'k', color: 'black', hasMoved: false };
      game.board[0][4] = { type: 'r', color: 'black', hasMoved: false };

      const blackMoves = game.getAllLegalMoves('black');
      const invalidMove = blackMoves.find(m => isBlockedCell(m.to.r, m.to.c, 'cross'));
      expect(invalidMove).toBeUndefined();
    });
  });

  describe('AI Engine WASM Bypass', () => {
    it('should bypass WASM/Worker when board shape is CROSS', async () => {
      setCurrentBoardShape(BOARD_SHAPES.CROSS);
      const game = new Game(15, 'cross');
      game.board[0][4] = { type: 'k', color: 'white', hasMoved: false };
      game.board[8][4] = { type: 'k', color: 'black', hasMoved: false };

      const debugSpy = vi.spyOn(aiEngine.logger, 'debug');
      await aiEngine.getBestMoveDetailed(game.board, 'white', 1, { elo: 1000 });
      expect(debugSpy).toHaveBeenCalledWith('[AiEngine] Using JS Fallback Search');
    });
  });

  describe('Attack Detection & Pawn Edge Cases', () => {
    let board: Int8Array;

    beforeEach(() => {
      board = new Int8Array(81).fill(PIECE_NONE);
      setCurrentBoardShape(BOARD_SHAPES.CROSS);
    });

    it('should NOT detect attacks originating from blocked squares', () => {
      // Target square in the corridor (Row 1, Col 3) -> Index 12
      const target = 12;

      // Place an "impossible" attacker Knight in a blocked corner (Row 0, Col 1) -> Index 1
      const blockedSquare = 1;
      board[blockedSquare] = PIECE_KNIGHT | COLOR_BLACK;

      const isAttacked = MoveGenerator.isSquareAttacked(board, target, COLOR_BLACK);
      expect(isAttacked).toBe(false);
    });

    it('should NOT allow pawns to capture into blocked squares', () => {
      // White Pawn at Row 1, Col 3 (Index 12)
      // Capture LEFT -> Row 0, Col 2 (Index 2) -- BLOCKED
      // Capture RIGHT -> Row 0, Col 4 (Index 4) -- VALID
      const pawnFrom = 12;
      board[pawnFrom] = WHITE_PAWN;

      // Place enemy pieces to enable captures
      board[2] = BLACK_PAWN; // In a blocked corner
      board[4] = BLACK_PAWN; // In the corridor

      const moves = MoveGenerator.getAllLegalMoves(board, 'white');

      const captureLeft = moves.find(m => m.from === pawnFrom && m.to === 2);
      const captureRight = moves.find(m => m.from === pawnFrom && m.to === 4);

      expect(captureLeft).toBeUndefined();
      expect(captureRight).toBeDefined();
    });

    it('should handle En Passant correctly in the central corridor', () => {
      const game = new Game(15, 'cross');
      // Clear board
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      // White pawn at Row 3, Col 4
      // Black pawn at Row 3, Col 3
      game.board[3][4] = { type: 'p', color: 'white', hasMoved: true };
      game.board[1][3] = { type: 'p', color: 'black', hasMoved: false };

      // Black pawn moves 2 squares to (3,3)
      game.executeMove({ r: 1, c: 3 }, { r: 3, c: 3 });

      expect(game.lastMove?.isDoublePawnPush).toBe(true);

      const moves = game.getAllLegalMoves('white');
      const enPassant = moves.find(m => m.to.r === 2 && m.to.c === 3);
      expect(enPassant).toBeDefined();
    });
  });

  describe('Advanced Piece Movements in Cross Mode', () => {
    let board: Int8Array;

    beforeEach(() => {
      board = new Int8Array(81).fill(PIECE_NONE);
      setCurrentBoardShape(BOARD_SHAPES.CROSS);
    });

    it('Nightrider (sliding knight) should not jump into blocked corners', () => {
      // Index 40 is the center (Row 4, Col 4)
      // A Nightrider at 40 moving in direction (-2, -1) = -19
      // 40 - 19 = 21 (Row 2, Col 3) -> VALID
      // 21 - 19 = 2 (Row 0, Col 2) -> BLOCKED CORNER
      const from = 40;
      board[from] = WHITE_NIGHTRIDER;
      board[1] = BLACK_KING; // To make moves legal if needed

      const moves = MoveGenerator.getAllLegalMoves(board, 'white');

      const to21 = moves.find(m => m.from === from && m.to === 21);
      const to2 = moves.find(m => m.from === from && m.to === 2);

      expect(to21).toBeDefined();
      expect(to2).toBeUndefined();
    });

    it('Archbishop (Bishop + Knight) should respect blocked squares for both move types', () => {
      // Index 31 (Row 3, Col 4).
      // Knight jump to (Index 13: Row 1, Col 4) -> VALID
      // Knight jump to (Index 11: Row 1, Col 2) -> BLOCKED
      // Bishop slide to (Index 22: Row 2, Col 4 - wait, that's orthogonal)
      // Bishop slide diag to (Index 20: Row 2, Col 2) -> BLOCKED
      const from = 31;
      board[from] = PIECE_ARCHBISHOP | COLOR_WHITE;
      board[40] = WHITE_KING; // Keep king safe

      const moves = MoveGenerator.getAllLegalMoves(board, 'white');

      const to20 = moves.find(m => m.from === from && m.to === 20); // Diag block
      const to11 = moves.find(m => m.from === from && m.to === 11); // Knight jump block

      expect(to20).toBeUndefined();
      expect(to11).toBeUndefined();
    });
  });

  describe('Game Ending & Special States', () => {
    it('Stalemate should be correctly detected in corner pockets', () => {
      const game = new Game(15, 'cross');
      // Clear board
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

      // BK in corner (3,0). Neighbors: (3,1), (4,1), (4,0).
      game.board[3][0] = { type: 'k', color: 'black', hasMoved: true };

      // Fill neighbors and THEIR neighbors extensively to ensure zero mobility
      const pieces = [
        [3, 1],
        [4, 1],
        [4, 0],
        [3, 2],
        [4, 2],
        [5, 2],
        [5, 1],
        [5, 0],
        [6, 3],
        [7, 3],
        [8, 3],
        [7, 4],
        [8, 4],
        [8, 5],
      ];
      for (const [r, c] of pieces) {
        game.board[r][c] = { type: 'p', color: 'black', hasMoved: true };
      }

      // Check if it's stalemate
      const moves = game.getAllLegalMoves('black');
      if (moves.length > 0) {
        console.log('[DEBUG] Remaining black moves:', JSON.stringify(moves));
      }
      if (game.isInCheck('black')) {
        console.log('[DEBUG] Black is in CHECK');
      }
      expect(moves.length).toBe(0);
      expect(game.isStalemate('black')).toBe(true);
    });
  });

  describe('Advanced Piece Dynamics & Tutor Filtering', () => {
    it('Angel (Queen + Knight) should respect blocked squares for both move types', () => {
      const game = new Game(15, 'cross');
      // Angel at (3,3)
      // Knight jump to (1,2) is BLOCKED. (1,4) is PLAYABLE.
      // Sliding (diagonal) to (1,1) is BLOCKED. (1,5) is PLAYABLE.
      game.board[3][3] = { type: 'e', color: 'white', hasMoved: true };

      const moves = game.rulesEngine.getValidMoves(3, 3, game.board[3][3]!);

      // Check Knight jumps
      const knightTo1_2 = moves.find(m => m.r === 1 && m.c === 2);
      const knightTo1_4 = moves.find(m => m.r === 1 && m.c === 4);
      expect(knightTo1_2).toBeUndefined();
      expect(knightTo1_4).toBeDefined();

      // Check Sliding (Diagonal)
      const bishopTo1_1 = moves.find(m => m.r === 1 && m.c === 1);
      const bishopTo1_5 = moves.find(m => m.r === 1 && m.c === 5);
      expect(bishopTo1_1).toBeUndefined();
      expect(bishopTo1_5).toBeDefined();
    });

    it('Nightrider sliding knight jumps should be blocked by blocked squares', () => {
      const game = new Game(15, 'cross');
      // Nightrider at (3,6)
      // (1,7) is the first step in a ray. (1,7) is BLOCKED in row 1, col 7.
      // The entire ray (3,6) -> (1,7) -> (-1,8) should be cut off.
      game.board[3][6] = { type: 'j', color: 'white', hasMoved: true };

      const moves = game.rulesEngine.getValidMoves(3, 6, game.board[3][6]!);
      const to1_7 = moves.find(m => m.r === 1 && m.c === 7);
      expect(to1_7).toBeUndefined();
    });

    it('Tutor should NOT recommend moves landing on blocked squares', async () => {
      const game = new Game(15, 'cross');
      const moves = game.getAllLegalMoves('white');
      moves.forEach(m => {
        const isBlocked = isBlockedCell(m.to.r, m.to.c, 'cross');
        if (isBlocked) {
          throw new Error(`Tutor-accessible move targets blocked square: ${m.to.r},${m.to.c}`);
        }
      });
    });
  });
});
