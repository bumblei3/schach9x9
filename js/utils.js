// utils.js
/**
 * Utility functions for Schach9x9.
 * Add helper functions here (e.g., deep copy, coordinate conversion).
 */
export function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function coordToAlgebraic(r, c) {
  const file = String.fromCharCode(97 + c); // a-i
  const rank = 9 - r; // 9-1
  return `${file}${rank}`;
}

export function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Safely parses JSON with a fallback value.
 * Logs errors instead of throwing.
 * @param {string} jsonString
 * @param {any} fallback
 * @returns {any}
 */
export function safeJSONParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON Parse Error:', e);
    return fallback;
  }
}

/**
 * Parses a 9x9 FEN string into board and game state
 * @param {string} fen
 * @returns {Object} { board, turn, castling, enPassant, halfMove, fullMove }
 */
export function parseFEN(fen) {
  const parts = fen.split(' ');
  const position = parts[0];
  const turn = parts[1] === 'w' ? 'white' : 'black';

  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  const rows = position.split('/');
  for (let r = 0; r < 9; r++) {
    const rowStr = rows[r];
    let c = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (!isNaN(char)) {
        c += parseInt(char);
      } else {
        const color = char === char.toUpperCase() ? 'white' : 'black';
        const type = char.toLowerCase();
        board[r][c] = { type, color, hasMoved: true }; // Default hasMoved to true for FEN mostly
        c++;
      }
    }
  }

  return { board, turn };
}
