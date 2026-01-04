import { jest } from '@jest/globals';
import * as TacticsDetector from '../js/tutor/TacticsDetector.js';
import * as MoveAnalyzer from '../js/tutor/MoveAnalyzer.js';

// Mock dependencies
const mockGame = {
  board: Array(9)
    .fill(null)
    .map(() => Array(9).fill(null)),
  getValidMoves: jest.fn(),
  isSquareUnderAttack: jest.fn(),
};

const mockAnalyzer = {
  getPieceName: t => t,
};

describe('Tutor Improvements', () => {
  beforeEach(() => {
    // Reset board
    mockGame.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    jest.clearAllMocks();
  });

  describe('TacticsDetector: Skewers', () => {
    test('should detect a basic skewer (Bishop skewering King and Rook)', () => {
      // Setup: White Bishop at c3, Black King at e5, Black Rook at g7
      // Bishop moves/attacks along diagonal c3-g7
      // Actually, let's just test the detectSkewers logic with a static setup
      // where we simulate the "after move" state or just call the helper directly if exported?
      // detectSkewers takes (game, analyzer, pos, attackerColor)
      // It assumes 'pos' is where the attacker IS.

      // Place White Bishop at e5
      mockGame.board[4][4] = { type: 'b', color: 'white' };

      // Place Black King at f6 (diagonal)
      mockGame.board[3][5] = { type: 'k', color: 'black' };

      // Place Black Rook at g7 (behind King)
      mockGame.board[2][6] = { type: 'r', color: 'black' };

      // Mock getValidMoves for Bishop to include f6 (attacking King)
      // Implementation iterates valid moves of the piece at pos.
      mockGame.getValidMoves.mockReturnValue([
        { r: 3, c: 5 }, // Attacks King
        { r: 2, c: 6 }, // Attacks Rook (blocked by King normally, but getValidMoves logic handles it)
        // Wait, getValidMoves usually stops at first piece.
        // If it stops at King, we see King.
        // Then detectSkewers looks BEHIND the King.
      ]);

      const skewers = TacticsDetector.detectSkewers(
        mockGame,
        mockAnalyzer,
        { r: 4, c: 4 },
        'white'
      );

      expect(skewers.length).toBeGreaterThan(0);
      expect(skewers[0].frontPiece.type).toBe('k');
      expect(skewers[0].behindPiece.type).toBe('r');
    });
  });

  describe('MoveAnalyzer: Strategic Concepts', () => {
    test('should detect open file for Rook', () => {
      // Setup: Rook moves FROM a1 (8,0) TO d1 (8,3). File d has no pawns.

      // Place the Rook at START position
      mockGame.board[8][0] = { type: 'r', color: 'white' };

      // Ensure file d (index 3) is empty of pawns
      for (let r = 0; r < 9; r++) mockGame.board[r][3] = null;

      const move = { from: { r: 8, c: 0 }, to: { r: 8, c: 3 } }; // Moving to d1

      const patterns = MoveAnalyzer.analyzeStrategicValue(mockGame, move);
      const openFile = patterns.find(p => p.type === 'open_file');

      expect(openFile).toBeDefined();
      expect(openFile.explanation).toContain('offene Linie');
    });

    test('should detect knight outpost', () => {
      // Setup: Knight moves FROM b1 (8,1) TO e5 (4,4). Protected by Pawn at d4.
      mockGame.board[8][1] = { type: 'n', color: 'white' }; // Start pos
      mockGame.board[5][3] = { type: 'p', color: 'white' };

      const move = { from: { r: 8, c: 1 }, to: { r: 4, c: 4 } };

      const patterns = MoveAnalyzer.analyzeStrategicValue(mockGame, move);
      const outpost = patterns.find(p => p.type === 'outpost');

      expect(outpost).toBeDefined();
      expect(outpost.explanation).toContain('Vorposten');
    });
  });

  describe('TacticsDetector: Advanced Patterns', () => {
    test('should detect Removing the Guard', () => {
      // Setup:
      // 1. White Rook at e1 (8,4)
      // 2. Black Rook at e8 (0,4) - DEFENDED by Knight at d6 (2,3)
      // 3. Knight at d6 (2,3)

      // White captures Knight d6 with some piece, leaving Rook e8 undefended.
      // Let's say White Bishop at f4 (4,5) captures d6.

      mockGame.board[4][5] = { type: 'b', color: 'white' }; // Attacker
      mockGame.board[2][3] = { type: 'n', color: 'black' }; // Pinned/Defender (target of capture)
      mockGame.board[0][4] = { type: 'r', color: 'black' }; // Victim of removing guard
      mockGame.board[8][4] = { type: 'r', color: 'white' }; // piece attacking Victim

      // isSquareUnderAttack(e8, white) should be true
      mockGame.isSquareUnderAttack.mockImplementation((r, c, color) => {
        if (r === 0 && c === 4 && color === 'white') return true;
        return false;
      });

      // Mock getValidMoves to show Rook e1 attacks e8
      mockGame.getValidMoves.mockImplementation((r, c) => {
        if (r === 8 && c === 4) return [{ r: 0, c: 4 }]; // Rook at e1 attacks e8
        return [];
      });

      const vulnerabilities = TacticsDetector.detectRemovingGuard(
        mockGame,
        mockAnalyzer,
        { r: 2, c: 3 },
        { type: 'n', color: 'black' }
      );

      expect(vulnerabilities.length).toBeGreaterThan(0);
      expect(vulnerabilities[0].undefendedPiece.type).toBe('r');
    });

    test('should detect Discovered Attack', () => {
      // Setup:
      // 1. White Rook at a1 (8,0)
      // 2. White Knight at a4 (4,0) - BLOCKS Rook's attack on a8
      // 3. Black Queen at a8 (0,0) - TARGET

      mockGame.board[8][0] = { type: 'r', color: 'white' };
      mockGame.board[4][0] = { type: 'n', color: 'white' };
      mockGame.board[0][0] = { type: 'q', color: 'black' };

      // White Knight moves a4 -> b6, revealing Rook's attack on Queen a8
      const discovered = TacticsDetector.detectDiscoveredAttacks(
        mockGame,
        mockAnalyzer,
        { r: 4, c: 0 }, // FROM
        { r: 2, c: 1 }, // TO
        'white'
      );

      expect(discovered.length).toBeGreaterThan(0);
      expect(discovered[0].target.type).toBe('q');
    });
  });
});
