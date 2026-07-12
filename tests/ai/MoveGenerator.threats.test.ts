import { describe, it, expect, beforeEach } from 'vitest';
import {
  getKingThreats,
  getXRayThreats,
  getDiscoveredAttackPotential,
  getAllThreats,
} from '../../js/ai/MoveGenerator.js';
import {
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_NIGHTRIDER,
  COLOR_WHITE,
  COLOR_BLACK,
  SQUARE_COUNT,
} from '../../js/ai/BoardDefinitions.js';

describe('MoveGenerator - New Threat Detection Functions', () => {
  let board: Int8Array;

  beforeEach(() => {
    board = new Int8Array(SQUARE_COUNT).fill(0);
  });

  // Helper to place a piece
  const place = (square: number, type: number, color: number) => {
    board[square] = type | color;
  };

  const rowCol = (r: number, c: number): number => r * 9 + c;

  describe('getAllThreats (base function)', () => {
    it('should detect direct pawn attacks', () => {
      // White pawn at e2 (row 6, col 4) attacks d3 (row 5, col 3) and f3 (row 5, col 5)
      place(rowCol(6, 4), PIECE_PAWN, COLOR_WHITE);
      place(rowCol(5, 3), PIECE_PAWN, COLOR_BLACK); // Target on d3
      place(rowCol(5, 5), PIECE_KNIGHT, COLOR_BLACK); // Target on f3

      const threats = getAllThreats(board, COLOR_WHITE);

      expect(threats.length).toBe(2);
      expect(threats.every(t => t.isDirect)).toBe(true);
      expect(
        threats.some(t => t.targetSquare === rowCol(5, 3) && t.targetType === PIECE_PAWN)
      ).toBe(true);
      expect(
        threats.some(t => t.targetSquare === rowCol(5, 5) && t.targetType === PIECE_KNIGHT)
      ).toBe(true);
    });

    it('should detect direct knight attacks', () => {
      // White knight at e4 (row 4, col 4)
      place(rowCol(4, 4), PIECE_KNIGHT, COLOR_WHITE);
      // Black pieces on various knight targets
      place(rowCol(2, 3), PIECE_PAWN, COLOR_BLACK);
      place(rowCol(2, 5), PIECE_BISHOP, COLOR_BLACK);
      place(rowCol(3, 2), PIECE_ROOK, COLOR_BLACK);
      place(rowCol(3, 6), PIECE_QUEEN, COLOR_BLACK);

      const threats = getAllThreats(board, COLOR_WHITE);

      expect(threats.length).toBe(4);
      expect(threats.every(t => t.isDirect)).toBe(true);
    });

    it('should detect direct sliding piece attacks (rook)', () => {
      // White rook at a1 (row 0, col 0), black piece at a4 (row 3, col 0)
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(3, 0), PIECE_BISHOP, COLOR_BLACK);

      const threats = getAllThreats(board, COLOR_WHITE);

      expect(threats.length).toBe(1);
      expect(threats[0].isDirect).toBe(true);
      expect(threats[0].attackerType).toBe(PIECE_ROOK);
      expect(threats[0].targetSquare).toBe(rowCol(3, 0));
    });

    it('should NOT include attacks on own pieces', () => {
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(3, 0), PIECE_BISHOP, COLOR_WHITE); // Own piece

      const threats = getAllThreats(board, COLOR_WHITE);

      expect(threats.length).toBe(0);
    });
  });

  describe('getKingThreats', () => {
    it('should find checks on enemy king', () => {
      // White rook at a1 checking black king at a8
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(7, 0), PIECE_KING, COLOR_BLACK);
      // Place white king somewhere to avoid illegal position
      place(rowCol(0, 8), PIECE_KING, COLOR_WHITE);

      const threats = getKingThreats(board, COLOR_WHITE);

      expect(threats.length).toBe(1);
      expect(threats[0].targetSquare).toBe(rowCol(7, 0));
      expect(threats[0].targetType).toBe(PIECE_KING);
      expect(threats[0].isDirect).toBe(true);
    });

    it('should find discovered checks (X-ray through own piece to enemy king)', () => {
      // White bishop at c1, white pawn at d2, black king at e3
      // Pawn blocks bishop but is a discovered check if it moves
      place(rowCol(7, 2), PIECE_BISHOP, COLOR_WHITE); // c1 = row 7, col 2
      place(rowCol(6, 3), PIECE_PAWN, COLOR_WHITE); // d2 = row 6, col 3
      place(rowCol(5, 4), PIECE_KING, COLOR_BLACK); // e3 = row 5, col 4
      place(rowCol(7, 5), PIECE_KING, COLOR_WHITE); // White king

      const threats = getKingThreats(board, COLOR_WHITE);

      // Should detect both direct and X-ray threats to king
      expect(threats.length).toBeGreaterThanOrEqual(1);
      const xrayToKing = threats.find(t => t.xrayTargetSquare === rowCol(5, 4));
      expect(xrayToKing).toBeDefined();
      expect(xrayToKing!.isDirect).toBe(false);
      expect(xrayToKing!.blockerSquare).toBe(rowCol(6, 3));
    });

    it('should return empty array if enemy king not found', () => {
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      // No black king

      const threats = getKingThreats(board, COLOR_WHITE);

      expect(threats).toEqual([]);
    });

    it('should work for black checking white king', () => {
      // Black rook at f8 checking white king at f1
      place(rowCol(7, 5), PIECE_ROOK, COLOR_BLACK); // f8
      place(rowCol(0, 5), PIECE_KING, COLOR_WHITE); // f1
      place(rowCol(7, 0), PIECE_KING, COLOR_BLACK); // Black king

      const threats = getKingThreats(board, COLOR_BLACK);

      expect(threats.length).toBe(1);
      expect(threats[0].targetSquare).toBe(rowCol(0, 5));
    });
  });

  describe('getXRayThreats', () => {
    it('should find X-ray attacks through own piece to enemy piece', () => {
      // White rook at a1, white pawn at a2, black bishop at a4
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(1, 0), PIECE_PAWN, COLOR_WHITE); // Blocker
      place(rowCol(3, 0), PIECE_BISHOP, COLOR_BLACK); // X-ray target
      place(rowCol(7, 7), PIECE_KING, COLOR_WHITE);
      place(rowCol(7, 4), PIECE_KING, COLOR_BLACK); // Black king on e8, not a8

      const threats = getXRayThreats(board, COLOR_WHITE);

      expect(threats.length).toBe(1);
      expect(threats[0].isDirect).toBe(false);
      expect(threats[0].attackerSquare).toBe(rowCol(0, 0));
      expect(threats[0].attackerType).toBe(PIECE_ROOK);
      expect(threats[0].blockerSquare).toBe(rowCol(1, 0));
      expect(threats[0].xrayTargetSquare).toBe(rowCol(3, 0));
      expect(threats[0].xrayTargetType).toBe(PIECE_BISHOP);
    });

    it('should find multiple X-ray threats', () => {
      // White queen at d1, white pieces blocking, black pieces behind
      place(rowCol(7, 3), PIECE_QUEEN, COLOR_WHITE); // d1
      place(rowCol(6, 3), PIECE_PAWN, COLOR_WHITE); // d2 - blocker
      place(rowCol(4, 3), PIECE_KNIGHT, COLOR_BLACK); // d4 - X-ray target
      place(rowCol(5, 4), PIECE_BISHOP, COLOR_BLACK); // e3 - another X-ray target (diagonal)
      place(rowCol(7, 4), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 4), PIECE_KING, COLOR_BLACK);

      const threats = getXRayThreats(board, COLOR_WHITE);

      expect(threats.length).toBeGreaterThanOrEqual(1);
      expect(threats.every(t => !t.isDirect)).toBe(true);
    });

    it('should return empty array when no X-ray threats exist', () => {
      // Only direct attacks
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(3, 0), PIECE_BISHOP, COLOR_BLACK);
      place(rowCol(7, 7), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 7), PIECE_KING, COLOR_BLACK);

      const threats = getXRayThreats(board, COLOR_WHITE);

      expect(threats).toEqual([]);
    });
  });

  describe('getDiscoveredAttackPotential', () => {
    it('should find discovered attack potential (blocker can move to reveal attack)', () => {
      // White bishop at c1, white pawn at d2, black queen at e3
      place(rowCol(7, 2), PIECE_BISHOP, COLOR_WHITE);
      place(rowCol(6, 3), PIECE_PAWN, COLOR_WHITE); // Blocker
      place(rowCol(5, 4), PIECE_QUEEN, COLOR_BLACK); // Valuable target behind blocker
      place(rowCol(7, 5), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 4), PIECE_KING, COLOR_BLACK);

      const threats = getDiscoveredAttackPotential(board, COLOR_WHITE);

      expect(threats.length).toBe(1);
      expect(threats[0].isDirect).toBe(false);
      expect(threats[0].blockerSquare).toBe(rowCol(6, 3));
      expect(threats[0].xrayTargetSquare).toBe(rowCol(5, 4));
      expect(threats[0].xrayTargetType).toBe(PIECE_QUEEN);
      expect(threats[0].attackerType).toBe(PIECE_BISHOP);
    });

    it('should find discovered check potential (attack on king behind blocker)', () => {
      place(rowCol(7, 2), PIECE_BISHOP, COLOR_WHITE);
      place(rowCol(6, 3), PIECE_PAWN, COLOR_WHITE); // Blocker
      place(rowCol(5, 4), PIECE_KING, COLOR_BLACK); // King behind blocker
      place(rowCol(7, 5), PIECE_KING, COLOR_WHITE);

      const threats = getDiscoveredAttackPotential(board, COLOR_WHITE);

      expect(threats.length).toBe(1);
      expect(threats[0].blockerSquare).toBe(rowCol(6, 3));
      expect(threats[0].xrayTargetSquare).toBe(rowCol(5, 4));
      expect(threats[0].xrayTargetType).toBe(PIECE_KING);
    });

    it('should work with rook-style discovered attacks', () => {
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(1, 0), PIECE_PAWN, COLOR_WHITE); // Blocker
      place(rowCol(3, 0), PIECE_QUEEN, COLOR_BLACK); // Target
      place(rowCol(7, 7), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 7), PIECE_KING, COLOR_BLACK);

      const threats = getDiscoveredAttackPotential(board, COLOR_WHITE);

      expect(threats.length).toBe(1);
      expect(threats[0].attackerType).toBe(PIECE_ROOK);
      expect(threats[0].blockerSquare).toBe(rowCol(1, 0));
    });

    it('should return empty array when no discovered potential', () => {
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE);
      place(rowCol(3, 0), PIECE_BISHOP, COLOR_BLACK); // Direct attack, no blocker
      place(rowCol(7, 7), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 7), PIECE_KING, COLOR_BLACK);

      const threats = getDiscoveredAttackPotential(board, COLOR_WHITE);

      expect(threats).toEqual([]);
    });
  });

  describe('Integration: all three functions together', () => {
    it('should correctly categorize threats in a complex position', () => {
      // Complex position with multiple threat types
      // White pieces
      place(rowCol(0, 0), PIECE_ROOK, COLOR_WHITE); // a1
      place(rowCol(1, 0), PIECE_PAWN, COLOR_WHITE); // a2 (blocker)
      place(rowCol(3, 0), PIECE_QUEEN, COLOR_BLACK); // a4 (X-ray target)
      place(rowCol(7, 2), PIECE_BISHOP, COLOR_WHITE); // c1
      place(rowCol(6, 3), PIECE_KNIGHT, COLOR_WHITE); // d2 (blocker)
      place(rowCol(5, 4), PIECE_KING, COLOR_BLACK); // e3 (king - discovered check!)
      place(rowCol(0, 8), PIECE_KING, COLOR_WHITE); // White king
      place(rowCol(7, 7), PIECE_KING, COLOR_BLACK); // Black king (h8)

      const allThreats = getAllThreats(board, COLOR_WHITE);
      const kingThreats = getKingThreats(board, COLOR_WHITE);
      const xrayThreats = getXRayThreats(board, COLOR_WHITE);
      const discoveredThreats = getDiscoveredAttackPotential(board, COLOR_WHITE);

      // King should be in check from discovered attack
      expect(kingThreats.length).toBeGreaterThanOrEqual(1);
      const discoveredCheck = kingThreats.find(t => t.xrayTargetSquare === rowCol(5, 4));
      expect(discoveredCheck).toBeDefined();

      // Should have X-ray threats (including the discovered check)
      expect(xrayThreats.length).toBeGreaterThanOrEqual(1);

      // Should have discovered attack potential
      expect(discoveredThreats.length).toBeGreaterThanOrEqual(1);
      const discCheck = discoveredThreats.find(t => t.xrayTargetType === PIECE_KING);
      expect(discCheck).toBeDefined();

      // All threats should be present in allThreats
      expect(allThreats.length).toBeGreaterThanOrEqual(kingThreats.length + xrayThreats.length);
    });

    it('should detect nightrider X-ray attacks', () => {
      // Nightrider moves like knight but continues in same direction
      place(rowCol(4, 4), PIECE_NIGHTRIDER, COLOR_WHITE); // e4
      place(rowCol(2, 3), PIECE_PAWN, COLOR_WHITE); // c5 - blocker on first nightrider step
      place(rowCol(0, 2), PIECE_ROOK, COLOR_BLACK); // c7 - X-ray target
      place(rowCol(7, 7), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 7), PIECE_KING, COLOR_BLACK);

      const threats = getXRayThreats(board, COLOR_WHITE);

      expect(threats.length).toBeGreaterThanOrEqual(1);
      expect(
        threats.some(
          t => t.attackerType === PIECE_NIGHTRIDER && t.xrayTargetSquare === rowCol(0, 2)
        )
      ).toBe(true);
    });

    it('should detect archbishop/chancellor/angel X-ray attacks', () => {
      // Archbishop (bishop + knight)
      place(rowCol(7, 2), PIECE_ARCHBISHOP, COLOR_WHITE); // c1
      place(rowCol(6, 3), PIECE_PAWN, COLOR_WHITE); // d2 blocker
      place(rowCol(4, 5), PIECE_QUEEN, COLOR_BLACK); // f4 X-ray target (diagonal)
      place(rowCol(7, 5), PIECE_KING, COLOR_WHITE);
      place(rowCol(0, 4), PIECE_KING, COLOR_BLACK);

      const threats = getXRayThreats(board, COLOR_WHITE);

      expect(threats.some(t => t.attackerType === PIECE_ARCHBISHOP)).toBe(true);
    });
  });
});
