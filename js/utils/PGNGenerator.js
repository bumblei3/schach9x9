/**
 * PGN Generator for Schach 9x9
 * Generates Portable Game Notation strings from game history.
 * @module PGNGenerator
 */

/**
 * Piece type to standard notation letter.
 * @type {Object<string, string>}
 */
const PIECE_NOTATION = {
  k: 'K',
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
  p: '', // Pawns have no letter prefix
  a: 'A', // Archbishop (custom)
  c: 'C', // Chancellor (custom)
  e: 'E', // Angel (custom)
};

/**
 * Convert column index (0-8) to file letter (a-i for 9x9).
 * @param {number} col - Column index (0-8)
 * @returns {string} File letter
 */
function colToFile(col) {
  return String.fromCharCode(97 + col); // 'a' = 97
}

/**
 * Convert row index to rank number.
 * Row 0 is rank 9 (top), Row 8 is rank 1 (bottom).
 * @param {number} row - Row index (0-8)
 * @returns {string} Rank number as string
 */
function rowToRank(row) {
  return String(9 - row);
}

/**
 * Convert a move record to algebraic notation.
 * @param {Object} move - Move record from game history
 * @param {Object} game - Game instance (for disambiguation)
 * @returns {string} Algebraic notation string (e.g., "Nf3", "exd5", "O-O")
 */
export function moveToNotation(move, _game = null) {
  if (!move || !move.from || !move.to) {
    return '??';
  }

  // Handle castling
  if (move.specialMove?.type === 'castling') {
    // Kingside or queenside?
    const isKingside = move.to.c > move.from.c;
    return isKingside ? 'O-O' : 'O-O-O';
  }

  const pieceType = move.piece?.type || 'p';
  const pieceLetter = PIECE_NOTATION[pieceType] || '';
  const fromFile = colToFile(move.from.c);
  const _fromRank = rowToRank(move.from.r);
  const toFile = colToFile(move.to.c);
  const toRank = rowToRank(move.to.r);

  let notation = '';

  // Piece notation
  if (pieceLetter) {
    notation += pieceLetter;
  }

  // Disambiguation (for non-pawns, add file if needed)
  // Simplified: always add file for non-pawns if capturing
  if (!pieceLetter && move.captured) {
    // Pawn capture: include origin file
    notation += fromFile;
  }

  // Capture indicator
  if (move.captured) {
    notation += 'x';
  }

  // Destination
  notation += toFile + toRank;

  // Promotion
  if (move.specialMove?.type === 'promotion') {
    const promotedTo = move.specialMove.promotedTo || 'q';
    notation += '=' + (PIECE_NOTATION[promotedTo] || 'Q');
  }

  // Check/Checkmate indicators (would require game state analysis)
  // For simplicity, we skip these for now

  return notation;
}

/**
 * Generate PGN string from a game.
 * @param {Object} game - Game instance with moveHistory
 * @param {Object} options - Optional metadata
 * @returns {string} PGN formatted string
 */
export function generatePGN(game, options = {}) {
  const headers = [];

  // Standard headers
  headers.push(`[Event "${options.event || 'Schach 9x9 Game'}"]`);
  headers.push(`[Site "${options.site || 'Local'}"]`);
  headers.push(`[Date "${new Date().toISOString().split('T')[0].replace(/-/g, '.')}"]`);
  headers.push(`[Round "${options.round || '1'}"]`);
  headers.push(`[White "${options.white || 'Player'}"]`);
  headers.push(`[Black "${options.black || 'AI'}"]`);

  // Result
  let result = '*'; // Ongoing
  if (game.winner === 'white') result = '1-0';
  else if (game.winner === 'black') result = '0-1';
  else if (game.winner === 'draw') result = '1/2-1/2';
  headers.push(`[Result "${result}"]`);

  // Custom variant header
  headers.push('[Variant "9x9"]');

  // Move text
  const moves = game.moveHistory || [];
  const moveText = [];
  let moveNumber = 1;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const notation = moveToNotation(move, game);

    if (i % 2 === 0) {
      // White's move
      moveText.push(`${moveNumber}. ${notation}`);
    } else {
      // Black's move
      moveText[moveText.length - 1] += ` ${notation}`;
      moveNumber++;
    }
  }

  // Append result
  moveText.push(result);

  // Combine
  return headers.join('\n') + '\n\n' + moveText.join(' ');
}

/**
 * Copy PGN to clipboard.
 * @param {string} pgn - PGN string
 * @returns {Promise<boolean>} Success status
 */
export async function copyPGNToClipboard(pgn) {
  try {
    await navigator.clipboard.writeText(pgn);
    return true;
  } catch (err) {
    console.error('Failed to copy PGN:', err);
    return false;
  }
}

/**
 * Download PGN as a file.
 * @param {string} pgn - PGN string
 * @param {string} filename - Filename (default: 'game.pgn')
 */
export function downloadPGN(pgn, filename = 'game.pgn') {
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
