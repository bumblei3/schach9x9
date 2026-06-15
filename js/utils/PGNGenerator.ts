import { logger } from '../logger.js';
import type { Game } from '../gameEngine.js';
import type { MoveHistoryEntry } from '../gameEngine.js';

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
  j: 'J', // Nightrider (custom)
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
 * Quality symbols for PGN annotations.
 */
const QUALITY_SYMBOLS: Record<string, string> = {
  brilliant: '!!',
  great: '!',
  best: '!', // or leave empty for best
  excellent: '!',
  good: '', // good moves don't need special marker
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  book: '',
};

/**
 * Convert a move record to algebraic notation with optional engine annotations.
 * @param move - Move record from game history
 * @param _game - Game instance (for disambiguation)
 * @param includeEngineAnnotations - Whether to include engine evaluation annotations
 * @returns Algebraic notation string with optional annotations
 */
export function moveToNotation(
  move: MoveHistoryEntry | null | undefined,
  _game: Game | null = null,
  includeEngineAnnotations: boolean = false
): string {
  if (!move || !move.from || !move.to) {
    return '??';
  }

  // Handle castling
  const sm = move.specialMove as Record<string, unknown> | undefined;
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

  // Disambiguation (only for pawn captures)
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
    notation += '=' + (PIECE_NOTATION[promotedTo as string] || 'Q');
  }

  // Engine annotations (Nag - Numeric Annotation Glyphs + eval)
  if (includeEngineAnnotations) {
    const annotations: string[] = [];

    // Quality symbol
    const quality = move.classification as string | undefined;
    if (quality && QUALITY_SYMBOLS[quality]) {
      annotations.push(QUALITY_SYMBOLS[quality]);
    }

    // Eval score
    if (move.evalScore !== undefined && move.evalScore !== null) {
      const cp = move.evalScore;
      const sign = cp >= 0 ? '+' : '';
      annotations.push(`[%eval ${sign}${cp / 100}]`);
    }

    // Time on clock
    if (move.timeUsed !== undefined && move.timeUsed !== null) {
      const mins = Math.floor(move.timeUsed / 60);
      const secs = Math.floor(move.timeUsed % 60);
      annotations.push(`[%clk ${mins}:${secs.toString().padStart(2, '0')}]`);
    }

// Principal variation (if available in analysis)
    const pvMove = move as MoveHistoryEntry & { pv?: MoveHistoryEntry[] };
    if (pvMove.pv && pvMove.pv.length > 0) {
      const pvMoves = pvMove.pv.map((pv) => moveToNotation(pv));
      annotations.push(`[%pv ${pvMoves.join(' ')}]`);
    }

    // Add annotations to notation
    if (annotations.length > 0) {
      notation += ' ' + annotations.join(' ');
    }
  }

  return notation;
}

/**
 * Generate PGN string from a game.
 * @param game - Game instance with moveHistory
 * @param options - Optional metadata
 * @param includeEngineAnnotations - Whether to include engine evaluation annotations
 * @returns PGN formatted string
 */
export function generatePGN(
  game: Game,
  options: Record<string, unknown> = {},
  includeEngineAnnotations: boolean = true
): string {
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
  const g = game as Game & { winner?: 'white' | 'black' | 'draw' };
  if (g.winner === 'white') result = '1-0';
  else if (g.winner === 'black') result = '0-1';
  else if (g.winner === 'draw') result = '1/2-1/2';
  headers.push(`[Result "${result}"]`);

  // Variant and FEN for non-standard boards
  if (game.boardShape === 'cross') {
    headers.push('[Variant "Cross"]');
    headers.push('[SetUp "1"]');
    headers.push('[FEN "3pp3/3pp3/3pp3/pppppppp/pppkpppb/pppppppp/3pp3/3pp3/3pp3 w - - 0 1"]');
  } else {
    headers.push('[Variant "9x9"]');
  }

  // Engine info header
  if (includeEngineAnnotations) {
    headers.push('[Annotator "Schach9x9 Engine"]');
  }

  // Move text
  const moves = game.moveHistory || [];
  const moveText: string[] = [];
  let moveNumber = 1;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const notation = moveToNotation(move, game, includeEngineAnnotations);

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
    logger.context('PGNGenerator').error('Failed to copy PGN:', err);
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

