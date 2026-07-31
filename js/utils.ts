/**
 * Utility functions for Schach9x9.
 * Add helper functions here (e.g., deep copy, coordinate conversion).
 */

import type { Piece, Player } from './types/game.js';

/**
 * Deep copy an object using JSON serialization
 */
export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Convert row/column coordinates to algebraic notation (e.g., 0,0 -> a9)
 */
export function coordToAlgebraic(r: number, c: number): string {
  const file = String.fromCharCode(97 + c); // a-i
  const rank = 9 - r; // 9-1
  return `${file}${rank}`;
}

/**
 * Debounce a function to limit how often it can be called
 */
export function debounce<T extends (..._args: unknown[]) => void>( // eslint-disable-line space-before-function-paren
  fn: T,
  delay: number = 150
): (..._args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Safely parses JSON with a fallback value.
 * Logs errors instead of throwing.
 */
export function safeJSONParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error('JSON Parse Error:', e);
    return fallback;
  }
}

export interface ParsedFEN {
  board: (Piece | null)[][];
  turn: Player;
}

/**
 * Parses a 9x9 FEN string into board and game state
 */
export function parseFEN(fen: string): ParsedFEN {
  const parts = fen.split(' ');
  const position = parts[0];
  const turn: Player = parts[1] === 'w' ? 'white' : 'black';

  const board: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  const rows = position.split('/');
  for (let r = 0; r < 9; r++) {
    const rowStr = rows[r];
    let c = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (!isNaN(parseInt(char))) {
        c += parseInt(char);
      } else {
        const color: Player = char === char.toUpperCase() ? 'white' : 'black';
        const type = char.toLowerCase() as Piece['type'];
        board[r][c] = { type, color };
        c++;
      }
    }
  }

  return { board, turn };
}

/**
 * Serializes a board + side-to-move into a 9x9 FEN string.
 * Empty ranks use digit 9 (not 8). Fairy pieces: a/c/e/j (case = color).
 * Halfmove/fullmove default to 0 1 when omitted.
 */
export function toFEN(
  board: (Piece | null)[][],
  turn: Player = 'white',
  halfMove: number = 0,
  fullMove: number = 1
): string {
  const size = board.length;
  const ranks: string[] = [];
  for (let r = 0; r < size; r++) {
    let rank = '';
    let empty = 0;
    const row = board[r] ?? [];
    const cols = row.length || size;
    for (let c = 0; c < cols; c++) {
      const p = row[c];
      if (!p) {
        empty++;
        continue;
      }
      if (empty > 0) {
        rank += String(empty);
        empty = 0;
      }
      const ch = p.type;
      rank += p.color === 'white' ? ch.toUpperCase() : ch.toLowerCase();
    }
    if (empty > 0) rank += String(empty);
    ranks.push(rank);
  }
  const stm = turn === 'white' ? 'w' : 'b';
  return `${ranks.join('/')} ${stm} - - ${halfMove} ${fullMove}`;
}

export interface SharePositionParams {
  fen: string;
  turn?: Player;
}

/**
 * Extract a shared position from URL search (`?fen=…`) or hash (`#fen=…`).
 * Returns null when no usable FEN is present.
 */
export function parseShareQuery(
  search: string = typeof location !== 'undefined' ? location.search : '',
  hash: string = typeof location !== 'undefined' ? location.hash : ''
): SharePositionParams | null {
  const fromParams = (raw: string): SharePositionParams | null => {
    const q = raw.startsWith('?') || raw.startsWith('#') ? raw.slice(1) : raw;
    if (!q) return null;
    const params = new URLSearchParams(q);
    const fen = params.get('fen');
    if (!fen || !fen.includes('/')) return null;
    const turnRaw = params.get('turn');
    const turn: Player | undefined =
      turnRaw === 'b' || turnRaw === 'black'
        ? 'black'
        : turnRaw === 'w' || turnRaw === 'white'
          ? 'white'
          : undefined;
    return turn ? { fen, turn } : { fen };
  };

  return fromParams(search) ?? fromParams(hash);
}

/**
 * Build a shareable absolute URL for a position (query form).
 * Keeps the current origin + path; only replaces search.
 */
export function buildShareUrl(
  fen: string,
  base: string = typeof location !== 'undefined'
    ? `${location.origin}${location.pathname}`
    : 'https://bumblei3.github.io/schach9x9/'
): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('fen', fen);
  return url.toString();
}
