export const BOARD_SIZE = 9;
export const SQUARE_COUNT = 81;

// Piece Types (0-15 bit mask)
export const PIECE_NONE = 0;
export const PIECE_PAWN = 1;
export const PIECE_KNIGHT = 2;
export const PIECE_BISHOP = 3;
export const PIECE_ROOK = 4;
export const PIECE_QUEEN = 5;
export const PIECE_KING = 6;
export const PIECE_ARCHBISHOP = 7;
export const PIECE_CHANCELLOR = 8;
export const PIECE_ANGEL = 9;
export const PIECE_NIGHTRIDER = 10;

// Colors
export const COLOR_WHITE = 16; // 0001 0000
export const COLOR_BLACK = 32; // 0010 0000

export const TYPE_MASK = 15; // 0000 1111
export const COLOR_MASK = 48; // 0011 0000 (Bits 4 and 5)

// Combined Pieces
export const WHITE_PAWN = COLOR_WHITE | PIECE_PAWN;
export const WHITE_KNIGHT = COLOR_WHITE | PIECE_KNIGHT;
export const WHITE_BISHOP = COLOR_WHITE | PIECE_BISHOP;
export const WHITE_ROOK = COLOR_WHITE | PIECE_ROOK;
export const WHITE_QUEEN = COLOR_WHITE | PIECE_QUEEN;
export const WHITE_KING = COLOR_WHITE | PIECE_KING;
export const WHITE_ARCHBISHOP = COLOR_WHITE | PIECE_ARCHBISHOP;
export const WHITE_CHANCELLOR = COLOR_WHITE | PIECE_CHANCELLOR;
export const WHITE_ANGEL = COLOR_WHITE | PIECE_ANGEL;
export const WHITE_NIGHTRIDER = COLOR_WHITE | PIECE_NIGHTRIDER;

export const BLACK_PAWN = COLOR_BLACK | PIECE_PAWN;
export const BLACK_KNIGHT = COLOR_BLACK | PIECE_KNIGHT;
export const BLACK_BISHOP = COLOR_BLACK | PIECE_BISHOP;
export const BLACK_ROOK = COLOR_BLACK | PIECE_ROOK;
export const BLACK_QUEEN = COLOR_BLACK | PIECE_QUEEN;
export const BLACK_KING = COLOR_BLACK | PIECE_KING;
export const BLACK_ARCHBISHOP = COLOR_BLACK | PIECE_ARCHBISHOP;
export const BLACK_CHANCELLOR = COLOR_BLACK | PIECE_CHANCELLOR;
export const BLACK_ANGEL = COLOR_BLACK | PIECE_ANGEL;
export const BLACK_NIGHTRIDER = COLOR_BLACK | PIECE_NIGHTRIDER;

// Helper Functions
export function getPieceType(piece: number): number {
  return piece & TYPE_MASK;
}

export function getPieceColor(piece: number): number {
  return piece & COLOR_MASK;
}

export function isWhite(piece: number): boolean {
  return (piece & COLOR_WHITE) !== 0;
}

export function isBlack(piece: number): boolean {
  return (piece & COLOR_BLACK) !== 0;
}

// Coordinate conversions
export function indexToRow(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

export function indexToCol(index: number): number {
  return index % BOARD_SIZE;
}

export function coordsToIndex(r: number, c: number): number {
  return r * BOARD_SIZE + c;
}

// Piece type -> index lookup table for Zobrist hashing (O(1) instead of linear search)
// Index by PIECE_TYPE value (0-10), returns 0-8 for valid pieces, -1 for NONE/unknown
export const PIECE_TYPE_INDEX: number[] = new Array(16).fill(-1);
PIECE_TYPE_INDEX[PIECE_PAWN] = 0;
PIECE_TYPE_INDEX[PIECE_KNIGHT] = 1;
PIECE_TYPE_INDEX[PIECE_BISHOP] = 2;
PIECE_TYPE_INDEX[PIECE_ROOK] = 3;
PIECE_TYPE_INDEX[PIECE_QUEEN] = 4;
PIECE_TYPE_INDEX[PIECE_KING] = 5;
PIECE_TYPE_INDEX[PIECE_ARCHBISHOP] = 6;
PIECE_TYPE_INDEX[PIECE_CHANCELLOR] = 7;
PIECE_TYPE_INDEX[PIECE_ANGEL] = 8;

// Debug / String conversions
const TYPE_CHARS: Record<number, string> = {
  [PIECE_NONE]: '.',
  [PIECE_PAWN]: 'p',
  [PIECE_KNIGHT]: 'n',
  [PIECE_BISHOP]: 'b',
  [PIECE_ROOK]: 'r',
  [PIECE_QUEEN]: 'q',
  [PIECE_KING]: 'k',
  [PIECE_ARCHBISHOP]: 'a',
  [PIECE_CHANCELLOR]: 'c',
  [PIECE_ANGEL]: 'e',
  [PIECE_NIGHTRIDER]: 'j',
};

export function pieceToString(piece: number): string {
  if (piece === 0) return '.';
  const type = piece & TYPE_MASK;
  const color = piece & COLOR_MASK;
  const char = TYPE_CHARS[type] || '?';
  return color === COLOR_WHITE ? char.toUpperCase() : char;
}

// Direction constants for move generation
export const UP = -9; // North (decrease row)
export const DOWN = 9; // South (increase row)
export const LEFT = -1; // West (decrease col)
export const RIGHT = 1; // East (increase col)

// Diagonal directions
export const UP_LEFT = -10;
export const UP_RIGHT = -8;
export const DOWN_LEFT = 8;
export const DOWN_RIGHT = 10;

// Knight moves (offsets on 9x9 board)
export const KNIGHT_OFFSETS = [-19, -17, -11, -7, 7, 11, 17, 19];
