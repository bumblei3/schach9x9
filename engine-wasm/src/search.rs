use crate::definitions::*;
use crate::move_gen::*;
use crate::eval::*;
use crate::zobrist::*;
use crate::ordering::*;
use std::collections::HashMap;
use rand::Rng;

pub struct SearchContext {
    pub nodes: u64,
    pub tt: HashMap<u64, TTEntry>,
    pub stop: bool,
}

pub struct TTEntry {
    pub depth: i8,
    pub score: i32,
    pub flag: u8,
    pub best_move: Option<Move>,
}

pub const TT_EXACT: u8 = 0;
pub const TT_ALPHA: u8 = 1;
pub const TT_BETA: u8 = 2;

pub fn search(board: &Board, depth: i8, color: i8, config: &EvalConfig) -> (Option<Move>, i32, u64) {
    let mut ctx = SearchContext {
        nodes: 0,
        tt: HashMap::new(),
        stop: false,
    };

    let mut overall_best_move = None;
    let mut best_score = -30000;

    for d in 1..=depth {
        let (m, s) = alphabeta(board, d, -30000, 30000, color, 0, &mut ctx, config);
        if !ctx.stop {
            overall_best_move = m;
            best_score = s;
        }
    }

    // Blunder Simulation for low Elo
    if let Some(best) = overall_best_move {
        if let Some(elo) = config.elo {
            if elo < 1200 {
                let blunder_prob = (1200.0 - elo as f32) / 1000.0;
                let mut rng = rand::thread_rng();
                if rng.r#gen::<f32>() < blunder_prob {
                     let moves = get_all_legal_moves(board, color);
                     if moves.len() > 1 {
                          // Pick random not equal to best
                          let others: Vec<_> = moves.into_iter().filter(|m| *m != best).collect();
                          if !others.is_empty() {
                               let random_index = rng.gen_range(0..others.len());
                               // Return blunder with penalty score
                               return (Some(others[random_index]), best_score - 200, ctx.nodes);
                          }
                     }
                }
            }
        }
    }

    (overall_best_move, best_score, ctx.nodes)
}

fn alphabeta(
    board: &Board,
    depth: i8,
    mut alpha: i32,
    mut beta: i32,
    color: i8,
    ply: i8,
    ctx: &mut SearchContext,
    config: &EvalConfig
) -> (Option<Move>, i32) {
    ctx.nodes += 1;

    let hash = compute_hash(board, color);
    let mut tt_move = None;

    if let Some(entry) = ctx.tt.get(&hash) {
        if entry.depth >= depth {
            if entry.flag == TT_EXACT { return (entry.best_move, entry.score); }
            if entry.flag == TT_ALPHA && entry.score <= alpha { return (entry.best_move, alpha); }
            if entry.flag == TT_BETA && entry.score >= beta { return (entry.best_move, beta); }
        }
        tt_move = entry.best_move;
    }

    if depth <= 0 {
        let s = evaluate_position(board, color, config);
        return (None, s);
    }

    let mut moves = get_all_legal_moves(board, color);
    if moves.is_empty() {
        if is_square_attacked(board, find_king(board, color), if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE }) {
            return (None, -30000 + ply as i32);
        }
        return (None, 0);
    }

    order_moves(board, &mut moves, tt_move);

    let mut best_move = None;
    let mut best_score = -30000;
    let old_alpha = alpha;

    for m in moves {
        let mut next_board = *board;
        make_move(&mut next_board, m);
        let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
        
        let (_, score) = alphabeta(&next_board, depth - 1, -beta, -alpha, enemy_color, ply + 1, ctx, config);
        let score = -score;

        if score > best_score {
            best_score = score;
            best_move = Some(m);
        }

        if score > alpha {
            alpha = score;
        }

        if alpha >= beta {
            break;
        }
    }

    let flag = if best_score <= old_alpha {
        TT_ALPHA
    } else if best_score >= beta {
        TT_BETA
    } else {
        TT_EXACT
    };

    ctx.tt.insert(hash, TTEntry {
        depth,
        score: best_score,
        flag,
        best_move,
    });

    (best_move, best_score)
}
