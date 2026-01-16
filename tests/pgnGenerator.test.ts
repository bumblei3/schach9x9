/**
 * @jest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { moveToNotation, generatePGN } from '../js/utils/PGNGenerator.js';

describe('PGNGenerator', () => {
  describe('moveToNotation', () => {
    it('should convert pawn move to algebraic notation', () => {
      const move = {
        from: { r: 6, c: 4 },
        to: { r: 4, c: 4 },
        piece: { type: 'p', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toContain('e');
    });

    it('should include x for captures', () => {
      const move = {
        from: { r: 6, c: 4 },
        to: { r: 5, c: 5 },
        piece: { type: 'p', color: 'white' },
        captured: { type: 'p', color: 'black' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      board[5][5] = { type: 'p', color: 'black' } as any;

      const notation = moveToNotation(move, board as any);
      expect(notation).toContain('x');
    });

    it('should use piece letter for non-pawn moves', () => {
      const move = {
        from: { r: 7, c: 1 },
        to: { r: 5, c: 2 },
        piece: { type: 'n', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^N/); // Knight starts with N
    });

    it('should handle king moves', () => {
      const move = {
        from: { r: 7, c: 4 },
        to: { r: 6, c: 4 },
        piece: { type: 'k', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^K/); // King starts with K
    });

    it('should handle queen moves', () => {
      const move = {
        from: { r: 7, c: 3 },
        to: { r: 3, c: 3 },
        piece: { type: 'q', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^Q/); // Queen starts with Q
    });

    it('should handle rook moves', () => {
      const move = {
        from: { r: 7, c: 0 },
        to: { r: 5, c: 0 },
        piece: { type: 'r', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^R/); // Rook starts with R
    });

    it('should handle bishop moves', () => {
      const move = {
        from: { r: 7, c: 2 },
        to: { r: 5, c: 4 },
        piece: { type: 'b', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^B/); // Bishop starts with B
    });

    it('should handle archbishop moves (A)', () => {
      const move = {
        from: { r: 7, c: 2 },
        to: { r: 5, c: 4 },
        piece: { type: 'a', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^A/); // Archbishop starts with A
    });

    it('should handle chancellor moves (C)', () => {
      const move = {
        from: { r: 7, c: 6 },
        to: { r: 5, c: 6 },
        piece: { type: 'c', color: 'white' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toMatch(/^C/); // Chancellor starts with C
    });

    it('should handle king-side castling', () => {
      const move = {
        from: { r: 8, c: 4 },
        to: { r: 8, c: 6 },
        piece: { type: 'k', color: 'white' },
        specialMove: { type: 'castling', isKingside: true },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toBe('O-O');
    });

    it('should handle queen-side castling', () => {
      const move = {
        from: { r: 8, c: 4 },
        to: { r: 8, c: 2 },
        piece: { type: 'k', color: 'white' },
        specialMove: { type: 'castling', isKingside: false },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toBe('O-O-O');
    });

    it('should handle promotion to angel', () => {
      const move = {
        from: { r: 1, c: 4 },
        to: { r: 0, c: 4 },
        piece: { type: 'p', color: 'white' },
        specialMove: { type: 'promotion', promotedTo: 'e' },
      };
      const board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));

      const notation = moveToNotation(move, board as any);
      expect(notation).toContain('=E'); // Promotes to Angel (E)
    });

    it('should handle invalid moves', () => {
      expect(moveToNotation(null)).toBe('??');
      expect(moveToNotation({} as any)).toBe('??');
      expect(moveToNotation({ from: {} } as any)).toBe('??');
    });
  });

  describe('generatePGN', () => {
    it('should generate valid PGN header', () => {
      const mockGame = {
        moveHistory: [],
        turn: 'white',
        phase: 'play',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };

      const pgn = generatePGN(mockGame as any);

      expect(pgn).toContain('[Event "Schach 9x9 Game"]');
      expect(pgn).toContain('[Site "Local"]');
      expect(pgn).toContain('[White "Player"]');
      expect(pgn).toContain('[Black "AI"]');
      expect(pgn).toContain('[Variant "9x9"]');
    });

    it('should generate PGN with move numbers', () => {
      const mockGame = {
        moveHistory: [
          {
            from: { r: 6, c: 4 },
            to: { r: 4, c: 4 },
            piece: { type: 'p', color: 'white' },
          },
          {
            from: { r: 1, c: 4 },
            to: { r: 3, c: 4 },
            piece: { type: 'p', color: 'black' },
          },
        ],
        turn: 'white',
        phase: 'play',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };

      const pgn = generatePGN(mockGame as any);

      expect(pgn).toContain('1.');
    });

    it('should handle empty move history', () => {
      const mockGame = {
        moveHistory: [],
        turn: 'white',
        phase: 'play',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };

      const pgn = generatePGN(mockGame as any);

      // Should still have headers
      expect(pgn).toContain('[Event');
      // Should still work (may have empty result)
      expect(pgn).toContain('*');
    });

    it('should include date header', () => {
      const mockGame = {
        moveHistory: [],
        turn: 'white',
        phase: 'play',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };

      const pgn = generatePGN(mockGame as any);

      expect(pgn).toContain('[Date');
    });
  });

  describe('generatePGN with winners', () => {
    it('should handle white winner', () => {
      const game = { moveHistory: [], winner: 'white' };
      const pgn = generatePGN(game as any);
      expect(pgn).toContain('[Result "1-0"]');
      expect(pgn).toContain('1-0');
    });

    it('should handle black winner', () => {
      const game = { moveHistory: [], winner: 'black' };
      const pgn = generatePGN(game as any);
      expect(pgn).toContain('[Result "0-1"]');
      expect(pgn).toContain('0-1');
    });

    it('should handle draw', () => {
      const game = { moveHistory: [], winner: 'draw' };
      const pgn = generatePGN(game as any);
      expect(pgn).toContain('[Result "1/2-1/2"]');
      expect(pgn).toContain('1/2-1/2');
    });
  });

  describe('Clipboard and Download', () => {
    let originalURL: any;
    let originalCreateElement: any;
    let originalAppendChild: any;
    let originalRemoveChild: any;

    beforeEach(() => {
      originalURL = global.URL;
      originalCreateElement = document.createElement;
      originalAppendChild = document.body.appendChild;
      originalRemoveChild = document.body.removeChild;
    });

    afterEach(() => {
      global.URL = originalURL;
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
      document.body.removeChild = originalRemoveChild;
      vi.restoreAllMocks();
    });

    it('should call navigator.clipboard.writeText', async () => {
      const { copyPGNToClipboard } = await import('../js/utils/PGNGenerator.js');
      const mockWriteText = vi.fn().mockResolvedValue(true);

      // Safe navigator assignment for test env
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      const result = await copyPGNToClipboard('test pgn');
      expect(mockWriteText).toHaveBeenCalledWith('test pgn');
      expect(result).toBe(true);

      // Cleanup
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard });
      } else {
        // @ts-ignore
        delete navigator.clipboard;
      }
    });

    it('should return false on clipboard error', async () => {
      const { copyPGNToClipboard } = await import('../js/utils/PGNGenerator.js');

      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('fail')) },
        writable: true,
        configurable: true,
      });

      const result = await copyPGNToClipboard('test pgn');
      expect(result).toBe(false);
    });

    it('should trigger download', async () => {
      const { downloadPGN } = await import('../js/utils/PGNGenerator.js');

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = vi.fn().mockReturnValue('mock-url');
      const mockRevokeObjectURL = vi.fn();

      global.URL = {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      } as any;

      // Mock document.createElement
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'a') return mockAnchor as any;
        return originalCreateElement(tagName);
      });

      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();

      downloadPGN('test pgn', 'test.pgn');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('test.pgn');
      expect(mockAnchor.click).toHaveBeenCalled();
    });
  });
});
