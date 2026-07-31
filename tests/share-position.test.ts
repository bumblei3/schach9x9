import { describe, expect, test } from 'vitest';
import {
  parseFEN,
  toFEN,
  parseShareQuery,
  buildShareUrl,
} from '../js/utils.js';

/** Classic 9x9 start-ish empty-ish tactical FEN used elsewhere in the project. */
const SAMPLE =
  '9/9/9/9/9/9/9/2N6/2q2k1K1 w - - 0 1';

describe('toFEN / parseFEN roundtrip', () => {
  test('roundtrips a tactical 9x9 FEN (piece placement + turn)', () => {
    const { board, turn } = parseFEN(SAMPLE);
    const out = toFEN(board, turn, 0, 1);
    // Placement + turn must match; castling/ep fields are always "- -" in our serializer.
    expect(out.split(' ')[0]).toBe(SAMPLE.split(' ')[0]);
    expect(out.split(' ')[1]).toBe('w');
    const again = parseFEN(out);
    expect(again.turn).toBe('white');
    expect(again.board[7][2]?.type).toBe('n');
    expect(again.board[7][2]?.color).toBe('white');
    expect(again.board[8][2]?.type).toBe('q');
    expect(again.board[8][2]?.color).toBe('black');
  });

  test('uses digit 9 for a fully empty rank (not 8)', () => {
    const empty = Array.from({ length: 9 }, () => Array(9).fill(null));
    empty[8][4] = { type: 'k', color: 'white' };
    empty[0][4] = { type: 'k', color: 'black' };
    const fen = toFEN(empty as never, 'black');
    const ranks = fen.split(' ')[0].split('/');
    expect(ranks).toHaveLength(9);
    // ranks with only empty squares
    expect(ranks[1]).toBe('9');
    expect(fen.split(' ')[1]).toBe('b');
  });

  test('encodes fairy pieces with correct case', () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = { type: 'a', color: 'white' }; // Archbishop
    board[4][5] = { type: 'c', color: 'black' }; // Chancellor
    board[4][6] = { type: 'e', color: 'white' }; // Engel
    const fen = toFEN(board as never, 'white');
    expect(fen).toContain('A');
    expect(fen).toContain('c');
    expect(fen).toContain('E');
  });
});

describe('parseShareQuery', () => {
  test('reads fen from search string', () => {
    const q = `?fen=${encodeURIComponent(SAMPLE)}`;
    const got = parseShareQuery(q, '');
    expect(got).not.toBeNull();
    expect(got!.fen).toContain('2N6');
  });

  test('reads fen from hash fallback', () => {
    const h = `#fen=${encodeURIComponent(SAMPLE)}&turn=b`;
    const got = parseShareQuery('', h);
    expect(got).not.toBeNull();
    expect(got!.turn).toBe('black');
  });

  test('returns null without fen', () => {
    expect(parseShareQuery('?foo=1', '#bar=2')).toBeNull();
    expect(parseShareQuery('', '')).toBeNull();
  });

  test('rejects values that are not FEN-like', () => {
    expect(parseShareQuery('?fen=notafen', '')).toBeNull();
  });
});

describe('buildShareUrl', () => {
  test('embeds fen as query param on base URL', () => {
    const url = buildShareUrl(SAMPLE, 'https://example.com/schach9x9/');
    expect(url.startsWith('https://example.com/schach9x9/')).toBe(true);
    const u = new URL(url);
    expect(u.searchParams.get('fen')).toBe(SAMPLE);
  });
});
