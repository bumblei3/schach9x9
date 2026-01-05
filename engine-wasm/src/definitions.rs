pub const BOARD_SIZE: usize = 9;
pub const SQUARE_COUNT: usize = 81;

// Piece Types
pub const PIECE_NONE: i8 = 0;
pub const PIECE_PAWN: i8 = 1;
pub const PIECE_KNIGHT: i8 = 2;
pub const PIECE_BISHOP: i8 = 3;
pub const PIECE_ROOK: i8 = 4;
pub const PIECE_QUEEN: i8 = 5;
pub const PIECE_KING: i8 = 6;
pub const PIECE_ARCHBISHOP: i8 = 7;
pub const PIECE_CHANCELLOR: i8 = 8;
pub const PIECE_ANGEL: i8 = 9;

// Colors
pub const COLOR_WHITE: i8 = 16;
pub const COLOR_BLACK: i8 = 32;

pub const TYPE_MASK: i8 = 15;
pub const COLOR_MASK: i8 = 48;

#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Move {
    pub from: usize,
    pub to: usize,
    pub promotion: Option<i8>,
    pub flags: u8,
}

pub const FLAG_NONE: u8 = 0;
pub const FLAG_DOUBLE: u8 = 1;
pub const FLAG_EN_PASSANT: u8 = 2;
pub const FLAG_CASTLE: u8 = 4;

pub type Board = [i8; SQUARE_COUNT];

pub fn index_to_row(index: usize) -> usize {
    index / BOARD_SIZE
}

pub fn index_to_col(index: usize) -> usize {
    index % BOARD_SIZE
}

pub fn coords_to_index(r: usize, c: usize) -> usize {
    r * BOARD_SIZE + c
}

pub fn is_valid_square(idx: i32) -> bool {
    idx >= 0 && idx < SQUARE_COUNT as i32
}
