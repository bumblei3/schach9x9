use crate::definitions::*;
use crate::move_gen::*;
use crate::eval::*;
use crate::zobrist::*;
use crate::ordering::*;
// use rand::Rng;

const TT_SIZE: usize = 65536; // 64K entries, ~1.5MB RAM

#[derive(Clone, Copy)]
pub struct TTEntry {
    pub hash: u64, // Store full hash to verify collision
    pub depth: i8,
    pub score: i32,
    pub flag: u8,
    pub best_move: Option<Move>,
}

pub struct SearchContext {
    pub nodes: u64,
    pub tt: Vec<Option<TTEntry>>,
    pub stop: bool,
    pub killer_moves: [[Option<Move>; 2]; 64], // [ply][slot]
    pub history: [i32; 81 * 81], // [from * 81 + to]
}

pub const TT_EXACT: u8 = 0;
pub const TT_ALPHA: u8 = 1;
pub const TT_BETA: u8 = 2;

pub fn search(board: &Board, depth: i8, color: i8, config: &EvalConfig) -> (Option<Move>, i32, u64) {
    let mut ctx = SearchContext {
        nodes: 0,
        tt: vec![None; TT_SIZE],
        stop: false,
        killer_moves: [[None; 2]; 64],
        history: [0; 81 * 81],
    };

    let mut overall_best_move = None;
    let mut best_score = evaluate_position(board, color, config);

    // Iterative Deepening
    for d in 1..=depth {
        let (m, s) = alphabeta(board, d, -30000, 30000, color, 0, &mut ctx, config);
        if !ctx.stop {
            overall_best_move = m;
            best_score = s;
        }
    }

    // Blunder Simulation for low Elo
    // Blunder Simulation removed for stability testing
    /*
    if let Some(best) = overall_best_move {
        if let Some(elo) = config.elo {
            if elo < 1200 {
                // ...
            }
        }
    }
    */

    (overall_best_move, best_score, ctx.nodes)
}

fn alphabeta(
    board: &Board,
    depth: i8,
    mut alpha: i32,
    beta: i32,
    color: i8,
    ply: i8,
    ctx: &mut SearchContext,
    config: &EvalConfig
) -> (Option<Move>, i32) {
    ctx.nodes += 1;

    let hash = compute_hash(board, color);
    let tt_index = (hash as usize) % TT_SIZE;
    let mut tt_move = None;

    if let Some(entry) = ctx.tt[tt_index] {
        if entry.hash == hash && entry.depth >= depth {
            if entry.flag == TT_EXACT { return (entry.best_move, entry.score); }
            if entry.flag == TT_ALPHA && entry.score <= alpha { return (entry.best_move, alpha); }
            if entry.flag == TT_BETA && entry.score >= beta { return (entry.best_move, beta); }
        }
        // Use move for ordering regardless of depth match (if hash matches)
        if entry.hash == hash {
            tt_move = entry.best_move;
        }
    }

    if depth <= 0 {
        return (None, quiescence(board, alpha, beta, color, config));
    }

    let mut moves = get_all_legal_moves(board, color);
    if moves.is_empty() {
        if is_square_attacked(board, find_king(board, color), if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE }) {
            return (None, -30000 + ply as i32);
        }
        return (None, 0);
    }

    order_moves(board, &mut moves, tt_move, &ctx.killer_moves, &ctx.history, ply as usize);


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
            // Beta Cutoff found
            // Store Killer Move if not a capture
            if board[m.to] == PIECE_NONE {
                let p = ply as usize;
                if p < 64 {
                    if ctx.killer_moves[p][0] != Some(m) {
                        ctx.killer_moves[p][1] = ctx.killer_moves[p][0];
                        ctx.killer_moves[p][0] = Some(m);
                    }
                    // Update History Heuristic
                    let h_idx = m.from * 81 + m.to;
                    ctx.history[h_idx] += depth as i32 * depth as i32;
                    if ctx.history[h_idx] > 100_000 {
                         // Aging to prevent overflow
                         for i in 0..4096 { ctx.history[i] /= 2; }
                    }
                }
            }
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

    ctx.tt[tt_index] = Some(TTEntry {
        hash,
        depth,
        score: best_score,
        flag,
        best_move,
    });


    (best_move, best_score)
}

fn quiescence(
    board: &Board,
    mut alpha: i32,
    beta: i32,
    color: i8,
    config: &EvalConfig
) -> i32 {
    let stand_pat = evaluate_position(board, color, config);

    if stand_pat >= beta {
        return beta;
    }
    if stand_pat > alpha {
        alpha = stand_pat;
    }

    let mut captures = get_all_capture_moves(board, color);
    
    // Sort captures (using None for tt_move as simple capture sort)
    // Pass empty killer/history for Q-Search
    let dummy_killers = [[None; 2]; 64];
    let dummy_history = [0; 81*81];
    order_moves(board, &mut captures, None, &dummy_killers, &dummy_history, 0);

    for m in captures {
        let mut next_board = *board;
        make_move(&mut next_board, m);
        
        let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
        let score = -quiescence(&next_board, -beta, -alpha, enemy_color, config);

        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }
    alpha
}
