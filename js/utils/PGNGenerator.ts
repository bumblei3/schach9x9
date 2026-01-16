/**
 * PGN Generator for Schach 9x9
 * Generates Portable Game Notation strings from game history.
 * @module PGNGenerator
 */

import type { Game } from '../gameEngine.js';

/**
 * Piece type to standard notation letter.
 */
const PIECE_NOTATION: Record<string, string> = {
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
 * @param col - Column index (0-8)
 * @returns File letter
 */
function colToFile(col: number): string {
  return String.fromCharCode(97 + col); // 'a' = 97
}

/**
 * Convert row index to rank number.
 * Row 0 is rank 9 (top), Row 8 is rank 1 (bottom).
 * @param row - Row index (0-8)
 * @returns Rank number as string
 */
function rowToRank(row: number): string {
  return String(9 - row);
}

/**
 * Convert a move record to algebraic notation.
 * @param move - Move record from game history
 * @param _game - Game instance (for disambiguation)
 * @returns Algebraic notation string
 */
export function moveToNotation(move: any, _game: Game | null = null): string {
  if (!move || !move.from || !move.to) {
    return '??';
  }

  // Handle castling
  const sm = (move as any).specialMove;
  if (sm?.type === 'castling') {
    return sm.isKingside ? 'O-O' : 'O-O-O';
  }

  const pieceType = move.piece?.type || 'p';
  const pieceLetter = PIECE_NOTATION[pieceType] || '';
  const fromFile = colToFile(move.from.c);
  const toFile = colToFile(move.to.c);
  const toRank = rowToRank(move.to.r);

  let notation = '';

  // Piece notation
  if (pieceLetter) {
    notation += pieceLetter;
  }

  // Disambiguation
  if (!pieceLetter && move.captured) {
    notation += fromFile;
  }

  // Capture indicator
  if (move.captured) {
    notation += 'x';
  }

  // Destination
  notation += toFile + toRank;

  // Promotion
  if (sm?.type === 'promotion') {
    const promotedTo = sm.promotedTo || 'q';
    notation += '=' + (PIECE_NOTATION[promotedTo] || 'Q');
  }

  return notation;
}

/**
 * Generate PGN string from a game.
 * @param game - Game instance with moveHistory
 * @param options - Optional metadata
 * @returns PGN formatted string
 */
export function generatePGN(game: Game, options: any = {}): string {
  const headers: string[] = [];

  // Standard headers
  headers.push(`[Event "${options.event || 'Schach 9x9 Game'}"]`);
  headers.push(`[Site "${options.site || 'Local'}"]`);
  headers.push(`[Date "${new Date().toISOString().split('T')[0].replace(/-/g, '.')}"]`);
  headers.push(`[Round "${options.round || '1'}"]`);
  headers.push(`[White "${options.white || 'Player'}"]`);
  headers.push(`[Black "${options.black || 'AI'}"]`);

  // Result
  let result = '*'; // Ongoing
  const g = game as any;
  if (g.winner === 'white') result = '1-0';
  else if (g.winner === 'black') result = '0-1';
  else if (g.winner === 'draw') result = '1/2-1/2';
  headers.push(`[Result "${result}"]`);

  // Variant and FEN for non-standard boards
  if (game.boardShape === 'cross') {
    headers.push('[Variant "Cross"]');
    // Cross mode has 15 total rows/cols logically but 9x9 in the data array.
    // However, the initial state is fixed. We should provide a Setup/FEN header
    // so readers know it's not a standard start.
    headers.push('[SetUp "1"]');
    headers.push('[FEN "3pp3/3pp3/3pp3/pppppppp/pppkpppb/pppppppp/3pp3/3pp3/3pp3 w - - 0 1"]'); // Simplified or specific to state
  } else {
    headers.push('[Variant "9x9"]');
  }

  // Move text
  const moves = game.moveHistory || [];
  const moveText: string[] = [];
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
 * @param pgn - PGN string
 * @returns Success status
 */
export async function copyPGNToClipboard(pgn: string): Promise<boolean> {
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
 * @param pgn - PGN string
 * @param filename - Filename (default: 'game.pgn')
 */
export function downloadPGN(pgn: string, filename: string = 'game.pgn'): void {
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
