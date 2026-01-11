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
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number = 150
): (...args: Parameters<T>) => void {
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
