use crate::definitions::*;

const HASH_MOVE_SCORE: i32 = 3000000;
const WINNING_CAPTURE_SCORE: i32 = 2000000;

const PIECE_VALUES: [i32; 16] = {
    let mut v = [0; 16];
    v[PIECE_PAWN as usize] = 100;
    v[PIECE_KNIGHT as usize] = 320;
    v[PIECE_BISHOP as usize] = 330;
    v[PIECE_ROOK as usize] = 500;
    v[PIECE_QUEEN as usize] = 900;
    v[PIECE_KING as usize] = 20000;
    v[PIECE_ARCHBISHOP as usize] = 600;
    v[PIECE_CHANCELLOR as usize] = 700;
    v[PIECE_ANGEL as usize] = 1000;
    v
};

pub fn order_moves(board: &Board, moves: &mut [Move], tt_move: Option<Move>) {
    let mut scored_moves: Vec<(Move, i32)> = moves.iter().map(|&m| {
        let mut score = 0;

        if let Some(tm) = tt_move {
            if m.from == tm.from && m.to == tm.to {
                score = HASH_MOVE_SCORE;
            }
        }

        if score == 0 {
            let target = board[m.to];
            if target != PIECE_NONE {
                let victim_val = PIECE_VALUES[(target & TYPE_MASK) as usize];
                let attacker_val = PIECE_VALUES[(board[m.from] & TYPE_MASK) as usize];
                score = WINNING_CAPTURE_SCORE + victim_val * 10 - attacker_val;
            }
        }

        (m, score)
    }).collect();

    scored_moves.sort_by(|a, b| b.1.cmp(&a.1));

    for (i, (m, _)) in scored_moves.into_iter().enumerate() {
        moves[i] = m;
    }
}
