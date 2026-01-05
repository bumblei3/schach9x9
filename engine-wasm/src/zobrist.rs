use crate::definitions::*;
use std::sync::OnceLock;

static ZOBRIST_KEYS: OnceLock<[[u64; SQUARE_COUNT]; 64]> = OnceLock::new();
static SIDE_TO_MOVE_KEY: OnceLock<u64> = OnceLock::new();

pub fn get_zobrist_keys() -> &'static [[u64; SQUARE_COUNT]; 64] {
    ZOBRIST_KEYS.get_or_init(|| {
        let mut keys = [[0u64; SQUARE_COUNT]; 64];
        let mut seed = 123456789u64;
        for p in 0..64 {
            for s in 0..SQUARE_COUNT {
                seed = xorshift64(seed);
                keys[p][s] = seed;
            }
        }
        keys
    })
}

pub fn get_side_key() -> u64 {
    *SIDE_TO_MOVE_KEY.get_or_init(|| xorshift64(987654321u64))
}

fn xorshift64(mut x: u64) -> u64 {
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    x
}

pub fn compute_hash(board: &Board, color: i8) -> u64 {
    let keys = get_zobrist_keys();
    let mut hash = 0u64;
    for i in 0..SQUARE_COUNT {
        let p = board[i];
        if p != PIECE_NONE {
            if p >= 0 && p < 64 {
                hash ^= keys[p as usize][i];
            }
        }
    }
    if color == COLOR_WHITE {
        hash ^= get_side_key();
    }
    hash
}
