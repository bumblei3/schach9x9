use crate::definitions::*;
use crate::move_gen::*;
use crate::eval::*;
use crate::zobrist::*;
use crate::ordering::*;
use rand::Rng;

// =====================================================================
// Search Constants
// =====================================================================
const TT_SIZE: usize = 65536;
const MATE_SCORE: i32 = 30000;
const INFINITY: i32 = 30000;

// Null-Move Pruning
const NULL_MOVE_R: i8 = 2;
const NULL_MOVE_MIN_DEPTH: i8 = 3;

// Futility / Razoring
const FUTILITY_MARGIN: i32 = 200;
const RAZOR_MARGIN: i32 = 400;

// Late Move Reductions (LMR)
const LMR_BASE_DEPTH: i8 = 3;
const LMR_MOVE_COUNT: i32 = 3;
const LMR_MAX_REDUCTION: i8 = 3;

// ProbCut
const PROBCUT_DEPTH: i8 = 5;
const PROBCUT_REDUCTION: i8 = 3;
const PROBCUT_BETA_MARGIN: i32 = 150;

// Singular Extensions
const SINGULAR_DEPTH: i8 = 6;
const SINGULAR_MARGIN: i32 = 100;

// Aspiration Windows
const ASPIRATION_WINDOW: i32 = 50;

// IIR (Internal Iterative Reduction)
const IIR_WINDOW: usize = 3;
const IIR_STABILITY_THRESHOLD: i32 = 50;

#[derive(Clone, Copy)]
pub struct TTEntry {
    pub hash: u64,
    pub depth: i8,
    pub score: i32,
    pub flag: u8,
    pub best_move: Option<Move>,
}

pub struct SearchContext {
    pub nodes: u64,
    pub tt: Vec<Option<TTEntry>>,
    pub stop: bool,
    pub killer_moves: [[Option<Move>; 2]; 64],
    pub history: [i32; 81 * 81],
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

    // Iterative Deepening with Aspiration Windows + IIR
    let mut last_scores: Vec<i32> = Vec::new();
    let mut iir_stable_count = 0;
    let mut iir_unstable_count = 0;

    for d in 1..=depth {
        let mut aspiration_mult = 1.0;
        if last_scores.len() >= 2 {
            let delta = (last_scores[last_scores.len() - 1] - last_scores[last_scores.len() - 2]).abs();
            if delta <= IIR_STABILITY_THRESHOLD {
                iir_stable_count += 1;
                iir_unstable_count = 0;
                if iir_stable_count >= 2 {
                    aspiration_mult = 0.5;
                }
            } else {
                iir_unstable_count += 1;
                iir_stable_count = 0;
                if iir_unstable_count >= 1 {
                    aspiration_mult = 2.0;
                }
            }
        }

        let mut alpha = if d == 1 { -INFINITY } else { best_score - (ASPIRATION_WINDOW as f32 * aspiration_mult) as i32 };
        let mut beta = if d == 1 { INFINITY } else { best_score + (ASPIRATION_WINDOW as f32 * aspiration_mult) as i32 };
        
        alpha = alpha.max(-INFINITY + 100);
        beta = beta.min(INFINITY - 100);

        let (m, s) = alphabeta(board, d, alpha, beta, color, 0, &mut ctx, config);
        
        // Aspiration window re-search if failed
        if s <= alpha {
            alpha = (best_score - ASPIRATION_WINDOW * 10).max(-INFINITY + 100);
            let (m2, s2) = alphabeta(board, d, alpha, beta, color, 0, &mut ctx, config);
            if s2 > alpha {
                overall_best_move = m2;
                best_score = s2;
            }
        } else if s >= beta {
            beta = (best_score + ASPIRATION_WINDOW * 10).min(INFINITY - 100);
            let (m2, s2) = alphabeta(board, d, alpha, beta, color, 0, &mut ctx, config);
            if s2 < beta {
                overall_best_move = m2;
                best_score = s2;
            }
        } else {
            overall_best_move = m;
            best_score = s;
        }

        last_scores.push(best_score);
        if last_scores.len() > IIR_WINDOW {
            last_scores.remove(0);
        }

        // IIR: skip depth if extremely stable
        if d >= 4 && last_scores.len() >= 3 &&
           (last_scores[last_scores.len() - 1] - last_scores[last_scores.len() - 2]).abs() < 10 &&
           (last_scores[last_scores.len() - 2] - last_scores[last_scores.len() - 3]).abs() < 10 {
            // Still continue for safety, but could break here
        }

        if best_score.abs() > MATE_SCORE - 100 {
            break;
        }
    }

    // Blunder Simulation for low Elo
    if let Some(elo) = config.elo {
        if elo < 1200 {
            let blunder_chance = ((1200 - elo) as f32 / 1000.0).min(0.4);
            let mut rng = rand::thread_rng();
            if rng.r#gen::<f32>() < blunder_chance {
                let moves = get_all_legal_moves(board, color);
                if moves.len() > 1 {
                    let random_idx = rng.gen_range(0..moves.len());
                    return (Some(moves[random_idx]), best_score, ctx.nodes);
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
    beta: i32,
    color: i8,
    ply: i8,
    ctx: &mut SearchContext,
    config: &EvalConfig
) -> (Option<Move>, i32) {
    ctx.nodes += 1;

    // Time check every 1024 nodes
    if ctx.nodes % 1024 == 0 {
        // In WASM we can't easily check time, but we can add a stop flag check
        if ctx.stop { return (None, evaluate_position(board, color, config)); }
    }

    let hash = compute_hash(board, color);
    let tt_index = (hash as usize) % TT_SIZE;
    let mut tt_move = None;

    if let Some(entry) = ctx.tt[tt_index] {
        if entry.hash == hash && entry.depth >= depth {
            if entry.flag == TT_EXACT { return (entry.best_move, entry.score); }
            if entry.flag == TT_ALPHA && entry.score <= alpha { return (entry.best_move, alpha); }
            if entry.flag == TT_BETA && entry.score >= beta { return (entry.best_move, beta); }
        }
        if entry.hash == hash {
            tt_move = entry.best_move;
        }
    }

    // Check for mate distance
    if depth <= 0 {
        return (None, quiescence(board, alpha, beta, color, config));
    }

    // ============================================================
    // NULL-MOVE PRUNING
    // ============================================================
    if depth >= NULL_MOVE_MIN_DEPTH && !is_in_check(board, color) {
        // Check if we have non-pawn material
        let mut has_material = false;
        for &p in board.iter() {
            if p != PIECE_NONE && (p & COLOR_MASK) == color {
                let pt = p & TYPE_MASK;
                if pt != PIECE_PAWN && pt != PIECE_KING {
                    has_material = true;
                    break;
                }
            }
        }
        if has_material {
            // Make null move (pass turn)
            let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
            let null_score = -alphabeta(board, depth - 1 - NULL_MOVE_R, -beta, -beta + 1, enemy_color, ply + 1, ctx, config).1;
            if null_score >= beta {
                return (None, beta);
            }
        }
    }

    // Generate and order moves
    let mut moves = get_all_legal_moves(board, color);
    if moves.is_empty() {
        if is_in_check(board, color) {
            return (None, -MATE_SCORE + ply as i32);
        }
        return (None, 0);
    }

    order_moves(board, &mut moves, tt_move, &ctx.killer_moves, &ctx.history, ply as usize);

    // ============================================================
    // PROBCUT (before move loop)
    // ============================================================
    if depth >= PROBCUT_DEPTH && !is_in_check(board, color) {
        let probcut_beta = beta - PROBCUT_BETA_MARGIN;
        if probcut_beta > -INFINITY {
            // Only try captures and promotions for probcut
            let probcut_moves: Vec<Move> = moves.iter().filter(|m| {
                board[m.to] != PIECE_NONE || m.promotion.is_some()
            }).cloned().collect();
            
            if probcut_moves.len() > 0 {
                // Sort by victim value
                let mut probcut_ordered = probcut_moves.clone();
                probcut_ordered.sort_by(|a, b| {
                    let victim_a = if board[a.to] != PIECE_NONE { piece_value(board[a.to] & TYPE_MASK) } else { i32::MAX };
                    let victim_b = if board[b.to] != PIECE_NONE { piece_value(board[b.to] & TYPE_MASK) } else { i32::MAX };
                    victim_b.cmp(&victim_a)
                });

                let max_tries = probcut_ordered.len().min(3);
                for i in 0..max_tries {
                    let m = probcut_ordered[i];
                    let mut next_board = *board;
                    make_move(&mut next_board, m);
                    let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
                    let (_, score) = alphabeta(&next_board, depth - 1 - PROBCUT_REDUCTION, probcut_beta - 1, probcut_beta, enemy_color, ply + 1, ctx, config);
                    if -score >= probcut_beta {
                        return (None, beta);
                    }
                }
            }
        }
    }

    let mut best_move = None;
    let mut best_score = -INFINITY;
    let old_alpha = alpha;

    let mut moves_searched = 0;
    let in_check = is_in_check(board, color);

    for m in moves {
        moves_searched += 1;

        // ============================================================
        // LATE MOVE REDUCTIONS (LMR)
        // ============================================================
        let mut reduction = 0;
        let is_capture = board[m.to] != PIECE_NONE;
        let is_promotion = m.promotion.is_some();
        let is_tt_move = tt_move.map_or(false, |tm| tm.from == m.from && tm.to == m.to);

        if depth >= LMR_BASE_DEPTH 
            && moves_searched > LMR_MOVE_COUNT 
            && !is_capture 
            && !is_promotion 
            && !is_tt_move 
            && !in_check 
        {
            let depth_log = (depth as f32).ln();
            let move_log = (moves_searched as f32).ln();
            reduction = (depth_log * move_log / 1.75).floor() as i8;
            reduction = reduction.min(LMR_MAX_REDUCTION).max(1);
        }

        let mut next_board = *board;
        make_move(&mut next_board, m);
        let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };

        let mut score: i32;
        if reduction > 0 {
            // Reduced search first
            let (_, reduced_score) = alphabeta(&next_board, depth - 1 - reduction, -beta, -alpha, enemy_color, ply + 1, ctx, config);
            score = -reduced_score;

            // If reduced search fails high, re-search at full depth
            if score >= beta {
                let (_, full_score) = alphabeta(&next_board, depth - 1, -beta, -alpha, enemy_color, ply + 1, ctx, config);
                score = -full_score;
            }
        } else {
            // Full depth search
            let (_, full_score) = alphabeta(&next_board, depth - 1, -beta, -alpha, enemy_color, ply + 1, ctx, config);
            score = -full_score;
        }

        if score > best_score {
            best_score = score;
            best_move = Some(m);
        }

        if score > alpha {
            alpha = score;
        }

        if alpha >= beta {
            // Beta cutoff - update killers and history
            if !is_capture {
                if ply < 64 {
                    if ctx.killer_moves[ply as usize][0] != Some(m) {
                        ctx.killer_moves[ply as usize][1] = ctx.killer_moves[ply as usize][0];
                        ctx.killer_moves[ply as usize][0] = Some(m);
                    }
                    let h_idx = m.from * 81 + m.to;
                    ctx.history[h_idx] += depth as i32 * depth as i32;
                    if ctx.history[h_idx] > 100_000 {
                        for i in 0..4096 { ctx.history[i] /= 2; }
                    }
                }
            }
            break;
        }
    }

    // ============================================================
    // SINGULAR EXTENSIONS
    // ============================================================
    if depth >= SINGULAR_DEPTH && best_move.is_some() && !in_check {
        let singular_margin = SINGULAR_MARGIN;
        let singular_beta = best_score + singular_margin;
        let singular_alpha = best_score - singular_margin;
        
        let legal_moves = get_all_legal_moves(board, color);
        let mut is_singular = true;
        
        for m in legal_moves {
            if best_move.unwrap().from == m.from && best_move.unwrap().to == m.to {
                continue;
            }
            
            let mut next_board = *board;
            make_move(&mut next_board, m);
            let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
            let (_, score) = alphabeta(&next_board, depth - 1 - 2, -singular_beta, -singular_alpha, enemy_color, ply + 1, ctx, config);
            let score = -score;
            
            if score >= singular_alpha {
                is_singular = false;
                break;
            }
        }
        
        if is_singular {
            // Re-search best move with depth + 1
            let mut next_board = *board;
            make_move(&mut next_board, best_move.unwrap());
            let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
            let (_, ext_score) = alphabeta(&next_board, depth, -beta, -alpha, enemy_color, ply + 1, ctx, config);
            let ext_score = -ext_score;
            
            if ext_score > best_score {
                best_score = ext_score;
            }
        }
    }

    // Futility / Razoring at depth 1-2 (already handled by quiescence transition at depth 0)
    // But can add early exit for depth 1-2 in maximizing node
    // This is implicitly handled since we go to quiescence at depth 0

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

    if stand_pat >= beta { return beta; }
    if stand_pat > alpha { alpha = stand_pat; }

    let mut captures = get_all_capture_moves(board, color);
    
    let dummy_killers = [[None; 2]; 64];
    let dummy_history = [0; 81*81];
    order_moves(board, &mut captures, None, &dummy_killers, &dummy_history, 0);

    for m in captures {
        let mut next_board = *board;
        make_move(&mut next_board, m);
        let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
        let score = -quiescence(&next_board, -beta, -alpha, enemy_color, config);

        if score >= beta { return beta; }
        if score > alpha { alpha = score; }
    }
    alpha
}

fn piece_value(pt: i8) -> i32 {
    match pt {
        PIECE_PAWN => 100,
        PIECE_KNIGHT => 320,
        PIECE_BISHOP => 330,
        PIECE_ROOK => 500,
        PIECE_QUEEN => 900,
        PIECE_KING => 20000,
        PIECE_ARCHBISHOP => 600,
        PIECE_CHANCELLOR => 700,
        PIECE_ANGEL => 1000,
        PIECE_NIGHTRIDER => 600,
        _ => 0,
    }
}

fn is_in_check(board: &Board, color: i8) -> bool {
    // Find king
    let mut king_sq = 0;
    for (i, &p) in board.iter().enumerate() {
        if p != PIECE_NONE && (p & COLOR_MASK) == color && (p & TYPE_MASK) == PIECE_KING {
            king_sq = i;
            break;
        }
    }
    let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
    is_square_attacked(board, king_sq, enemy_color)
}
