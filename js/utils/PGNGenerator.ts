import { logger } from '../logger.js';
import type { Game } from '../gameEngine.js';
import type { MoveHistoryEntry } from '../gameEngine.js';
type Piece = { type: string; color: 'white' | 'black'; hasMoved?: boolean };

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
 * Pieces of the same type+colour that could also legally reach `to` from their
 * current square (ignoring whether the resulting position is legal — the same
 * simplification the standard PGN disambiguation uses). Used to decide whether
 * the moving piece's file/rank must be written out.
 */
function collectAmbiguousPieces(
  game: Game,
  pieceType: string,
  move: MoveHistoryEntry,
): { r: number; c: number }[] {
  const board = (game as unknown as { board: (Piece | null)[][] }).board;
  if (!board) return [];
  const color = move.piece?.color;
  const result: { r: number; c: number }[] = [];
  const dest = move.to;

  const isClear = (r0: number, c0: number, r1: number, c1: number): boolean => {
    const dr = Math.sign(r1 - r0);
    const dc = Math.sign(c1 - c0);
    let r = r0 + dr;
    let c = c0 + dc;
    while (r !== r1 || c !== c1) {
      if (board[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  };

  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (r === move.from.r && c === move.from.c) continue;
      const p = board[r][c];
      if (!p || p.type !== pieceType || p.color !== color) continue;

      if (p.type === 'n') {
        // Knight: one of the 8 L-jumps lands on dest.
        const dr = Math.abs(dest.r - r);
        const dc = Math.abs(dest.c - c);
        if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) result.push({ r, c });
      } else if (p.type === 'k') {
        if (Math.max(Math.abs(dest.r - r), Math.abs(dest.c - c)) === 1) result.push({ r, c });
      } else {
        // Sliding pieces (q/r/b/a/c/e): straight/diagonal, path clear.
        const dr = dest.r - r;
        const dc = dest.c - c;
        const straight = dr === 0 || dc === 0;
        const diagonal = Math.abs(dr) === Math.abs(dc);
        const slides = ['q', 'r'].includes(p.type) && straight;
        const glides = ['q', 'b', 'a', 'c', 'e'].includes(p.type) && diagonal;
        if ((slides || glides) && isClear(r, c, dest.r, dest.c)) result.push({ r, c });
      }
    }
  }
  return result;
}

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

  // Handle castling (isCastling is a top-level flag on MoveHistoryEntry;
  // it is NOT nested under specialMove.type, so read it directly).
  if (move.isCastling) {
    return move.to.c > move.from.c ? 'O-O' : 'O-O-O';
  }

  const pieceType = move.piece?.type || 'p';
  const pieceLetter = PIECE_NOTATION[pieceType] || '';
  const fromFile = colToFile(move.from.c);
  const fromRank = rowToRank(move.from.r);
  const toFile = colToFile(move.to.c);
  const toRank = rowToRank(move.to.r);

  let notation = '';

  // Piece notation
  if (pieceLetter) {
    notation += pieceLetter;
  }

  // Disambiguation: if another piece of the same type (and colour) could
  // also move to the destination, the moving piece must be disambiguated.
  // Prefer file, then rank, then both.
  if (pieceLetter && _game) {
    const others = collectAmbiguousPieces(_game, pieceType, move);
    if (others.length > 0) {
      const sameFile = others.some((o) => o.c === move.from.c);
      const sameRank = others.some((o) => o.r === move.from.r);
      if (!sameFile) notation += fromFile;
      else if (!sameRank) notation += fromRank;
      else notation += fromFile + fromRank;
    }
  } else if (!pieceLetter && move.captured) {
    // Pawn captures are disambiguated by their source file.
    notation += fromFile;
  }

  // Capture indicator
  if (move.captured) {
    notation += 'x';
  }

  // Destination
  notation += toFile + toRank;

  // Promotion (move.promotion is a top-level string on MoveHistoryEntry).
  if (move.promotion) {
    const promotedTo = move.promotion || 'q';
    notation += '=' + (PIECE_NOTATION[promotedTo] || 'Q');
  }

  // Check / checkmate suffix.
  if (move.isCheckmate) {
    notation += '#';
  } else if (move.isCheck) {
    notation += '+';
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

