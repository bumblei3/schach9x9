import { describe, expect, test } from 'vitest';

/**
 * Tests for Enhanced Debug Console Logic
 * Pure unit tests without external dependencies
 */

interface LogEntry {
  id: number;
  timestamp: Date | string;
  level: string;
  message: string;
  context: string;
}

describe('DebugConsole Logic', () => {
  describe('Log Management', () => {
    test('should create log entries with correct structure', () => {
      const log: Partial<LogEntry> = {
        id: Date.now(),
        timestamp: new Date(),
        level: 'info',
        message: 'Test message',
        context: '',
      };

      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('level');
      expect(log).toHaveProperty('message');
      expect(log.level).toBe('info');
    });

    test('should limit logs array to maxLogs', () => {
      const maxLogs = 5;
      const logs: any[] = [];

      for (let i = 0; i < 10; i++) {
        logs.push({ id: i, message: `Message ${i}` });
        if (logs.length > maxLogs) {
          logs.shift();
        }
      }

      expect(logs.length).toBe(maxLogs);
      expect(logs[0].id).toBe(5);
    });
  });

  describe('Context Extraction', () => {
    test('should extract context from bracketed messages', () => {
      const message = '[AI] Processing move...';
      const match = message.match(/\[(\w+)\]/);
      const context = match ? match[1] : '';
      expect(context).toBe('AI');
    });

    test('should return empty for messages without context', () => {
      const message = 'Simple message';
      const match = message.match(/\[(\w+)\]/);
      const context = match ? match[1] : '';
      expect(context).toBe('');
    });

    test('should handle multiple bracket patterns', () => {
      const message = '[UI] [DEBUG] Something happened';
      const match = message.match(/\[(\w+)\]/);
      const context = match ? match[1] : '';
      expect(context).toBe('UI');
    });
  });

  describe('Time Formatting', () => {
    test('should format seconds correctly', () => {
      const formatTime = (date: Date) => {
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return date.toLocaleTimeString();
      };

      const now = new Date();
      const thirtySecsAgo = new Date(now.getTime() - 30000);
      expect(formatTime(thirtySecsAgo)).toMatch(/\d+s/);
    });

    test('should format minutes correctly', () => {
      const formatTime = (date: Date) => {
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return date.toLocaleTimeString();
      };

      const now = new Date();
      const fiveMinsAgo = new Date(now.getTime() - 300000);
      expect(formatTime(fiveMinsAgo)).toMatch(/\d+m/);
    });

    test('should return time string for old dates', () => {
      const formatTime = (date: Date) => {
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return date.toLocaleTimeString();
      };

      const twoHoursAgo = new Date(Date.now() - 7200000);
      const result = formatTime(twoHoursAgo);
      expect(result).toMatch(/:/); // Contains colon (time format)
    });
  });

  describe('Filter Logic', () => {
    test('should filter logs by level', () => {
      const logs = [
        { level: 'info', message: 'Info 1' },
        { level: 'error', message: 'Error 1' },
        { level: 'info', message: 'Info 2' },
        { level: 'warn', message: 'Warn 1' },
      ];

      const filtered = logs.filter(log => log.level === 'error');
      expect(filtered.length).toBe(1);
      expect(filtered[0].message).toBe('Error 1');
    });

    test('should filter logs by context', () => {
      const logs = [
        { context: 'AI', message: 'AI message' },
        { context: 'UI', message: 'UI message' },
        { context: 'AI', message: 'Another AI' },
      ];

      const filtered = logs.filter(log => log.context === 'AI');
      expect(filtered.length).toBe(2);
    });

    test('should filter logs by search query case-insensitive', () => {
      const logs = [
        { message: 'Find this one' },
        { message: 'Not this' },
        { message: 'Find this too' },
      ];

      const query = 'find';
      const filtered = logs.filter(log => log.message.toLowerCase().includes(query.toLowerCase()));
      expect(filtered.length).toBe(2);
    });

    test('should combine multiple filters', () => {
      const logs = [
        { level: 'info', context: 'AI', message: 'AI info' },
        { level: 'error', context: 'AI', message: 'AI error' },
        { level: 'info', context: 'UI', message: 'UI info' },
      ];

      const filtered = logs.filter(log => log.level === 'info' && log.context === 'AI');
      expect(filtered.length).toBe(1);
    });
  });

  describe('Level Icons', () => {
    test('should map levels to icons', () => {
      const icons: Record<string, string> = { error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🔧' };

      expect(icons['error']).toBe('❌');
      expect(icons['warn']).toBe('⚠️');
      expect(icons['info']).toBe('ℹ️');
      expect(icons['debug']).toBe('🔧');
    });

    test('should return undefined for unknown levels', () => {
      const icons: Record<string, string> = { error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🔧' };
      expect(icons['unknown']).toBeUndefined();
    });
  });

  describe('Material Calculation', () => {
    test('should calculate material correctly', () => {
      const board: (any | null)[][] = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      board[8][4] = { type: 'k', color: 'white' };
      board[0][4] = { type: 'k', color: 'black' };
      board[7][0] = { type: 'r', color: 'white' };
      board[7][8] = { type: 'q', color: 'white' };
      board[1][0] = { type: 'n', color: 'black' };

      const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

      let matWhite = 0,
        matBlack = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const piece = board[r][c];
          if (piece) {
            const val = values[piece.type] || 0;
            if (piece.color === 'white') matWhite += val;
            else matBlack += val;
          }
        }
      }

      expect(matWhite).toBe(14); // Rook (5) + Queen (9)
      expect(matBlack).toBe(3); // Knight
    });
  });

  describe('Export Format', () => {
    test('should create valid JSON for export', () => {
      const logs = [{ id: 1, timestamp: new Date().toISOString(), level: 'info', message: 'Test' }];

      const json = JSON.stringify(logs, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed).toBeInstanceOf(Array);
      expect(parsed.length).toBe(1);
      expect(parsed[0].message).toBe('Test');
    });

    test('should handle empty logs array', () => {
      const logs: any[] = [];
      const json = JSON.stringify(logs, null, 2);
      expect(json).toBe('[]');
    });
  });

  describe('HTML Escaping', () => {
    test('should escape HTML special characters', () => {
      const escapeHtml = (text: string) => {
        const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return text.replace(/[&<>"']/g, m => map[m]);
      };

      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
    });
  });
});
