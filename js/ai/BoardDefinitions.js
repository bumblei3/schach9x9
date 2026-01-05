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

// Colors
export const COLOR_WHITE = 16; // 0001 0000
export const COLOR_BLACK = 32; // 0010 0000

export const TYPE_MASK = 15;   // 0000 1111
export const COLOR_MASK = 48;  // 0011 0000 (Bits 4 and 5)

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

export const BLACK_PAWN = COLOR_BLACK | PIECE_PAWN;
export const BLACK_KNIGHT = COLOR_BLACK | PIECE_KNIGHT;
export const BLACK_BISHOP = COLOR_BLACK | PIECE_BISHOP;
export const BLACK_ROOK = COLOR_BLACK | PIECE_ROOK;
export const BLACK_QUEEN = COLOR_BLACK | PIECE_QUEEN;
export const BLACK_KING = COLOR_BLACK | PIECE_KING;
export const BLACK_ARCHBISHOP = COLOR_BLACK | PIECE_ARCHBISHOP;
export const BLACK_CHANCELLOR = COLOR_BLACK | PIECE_CHANCELLOR;
export const BLACK_ANGEL = COLOR_BLACK | PIECE_ANGEL;

// Helper Functions
export function getPieceType(piece) {
    return piece & TYPE_MASK;
}

export function getPieceColor(piece) {
    return piece & COLOR_MASK;
}

export function isWhite(piece) {
    return (piece & COLOR_WHITE) !== 0;
}

export function isBlack(piece) {
    return (piece & COLOR_BLACK) !== 0;
}

// Coordinate conversions
export function indexToRow(index) {
    return Math.floor(index / BOARD_SIZE);
}

export function indexToCol(index) {
    return index % BOARD_SIZE;
}

export function coordsToIndex(r, c) {
    return r * BOARD_SIZE + c;
}

// Debug / String conversions
const TYPE_CHARS = {
    [PIECE_NONE]: '.',
    [PIECE_PAWN]: 'p',
    [PIECE_KNIGHT]: 'n',
    [PIECE_BISHOP]: 'b',
    [PIECE_ROOK]: 'r',
    [PIECE_QUEEN]: 'q',
    [PIECE_KING]: 'k',
    [PIECE_ARCHBISHOP]: 'a',
    [PIECE_CHANCELLOR]: 'c',
    [PIECE_ANGEL]: 'e'
};

export function pieceToString(piece) {
    if (piece === 0) return '.';
    const type = piece & TYPE_MASK;
    const color = piece & COLOR_MASK;
    const char = TYPE_CHARS[type] || '?';
    return color === COLOR_WHITE ? char.toUpperCase() : char;
}
