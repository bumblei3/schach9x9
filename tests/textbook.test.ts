import { describe, expect, test } from 'vitest';
import {
  TEXTBOOK_LINES,
  checkTextbookSolvability,
  createClassicStartBoard,
} from '../js/ai/textbook.js';

describe('Lehrbuch-Modus (M3.4)', () => {
  test('20+ curated lines exist', () => {
    expect(TEXTBOOK_LINES.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(TEXTBOOK_LINES.map(l => l.id));
    expect(ids.size).toBe(TEXTBOOK_LINES.length);
  });

  test('every line has a name, description and at least one legal move pair shape', () => {
    for (const line of TEXTBOOK_LINES) {
      expect(line.name.length).toBeGreaterThan(0);
      expect(line.description.length).toBeGreaterThan(0);
      expect(line.moves.length).toBeGreaterThan(0);
    }
  });

  test('check-book-solvability: every move in every line is legal on a real RulesEngine board', () => {
    // Uses the built-in default legality check (RulesEngine.getValidMoves)
    const illegal = checkTextbookSolvability(TEXTBOOK_LINES);
    expect(illegal).toEqual([]);
  });

  test('start board mirrors setupClassicBoard: R N B A K C B N R + pawns', () => {
    const board = createClassicStartBoard();
    expect(board[8].map(p => p?.type).join('')).toBe('rnbakcbnr');
    expect(board[0].map(p => p?.color).every(c => c === 'black')).toBe(true);
    expect(board[7].map(p => p?.type).join('')).toBe('ppppppppp');
    expect(board[7].map(p => p?.color).every(c => c === 'white')).toBe(true);
  });

  test('solvability checker flags an intentionally illegal line (sanity)', () => {
    const badLine = [
      {
        id: 'bad',
        name: 'x',
        description: 'x',
        moves: [{ from: { r: 8, c: 0 }, to: { r: 0, c: 0 } }], // Turm über das ganze Brett — blocked by own pieces
      },
    ];
    const illegal = checkTextbookSolvability(badLine);
    expect(illegal).toEqual([{ lineId: 'bad', index: 0 }]);
  });
});
