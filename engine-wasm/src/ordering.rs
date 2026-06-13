use crate::definitions::*;
use crate::move_gen::make_move;

const HASH_MOVE_SCORE: i32 = 3000000;
const WINNING_CAPTURE_SCORE: i32 = 2000000;
const KILLER_MOVE_1_SCORE: i32 = 900000;
const KILLER_MOVE_2_SCORE: i32 = 800000;
const COUNTER_MOVE_SCORE: i32 = 700000;
const HISTORY_SCORE_MAX: i32 = 100000;
const PROMOTION_SCORE: i32 = 1500000;
const THREAT_CHECK_SCORE: i32 = 300000;

// Threat scoring constants
const THREAT_CAPTURE_HIGH_VALUE: i32 = 200000;      // Attacking Queen/Rook/Archbishop/etc (value >= 500)
const THREAT_CAPTURE_MID_VALUE: i32 = 100000;       // Attacking Knight/Bishop (value >= 300)
const THREAT_CAPTURE_LOW_VALUE: i32 = 50000;        // Attacking Pawn
const THREAT_XRAY_HIGH: i32 = 80000;                // Discovered attack on high-value piece
const THREAT_XRAY_MID: i32 = 40000;                 // Discovered attack on mid-value piece
const THREAT_DISCOVERED_CHECK: i32 = 150000;        // Moving blocker reveals check
const THREAT_PIN_BREAK: i32 = 60000;                // Breaking a pin (freeing own piece)
const THREAT_KING_SAFETY_PENALTY: i32 = -50000;     // Move exposes own king to threat
const THREAT_HANGING_PIECE_BONUS: i32 = 100000;     // Capturing a hanging piece (not defended)

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
    v[PIECE_NIGHTRIDER as usize] = 600;
    v
};

/// Check if a square is attacked by a given color
fn is_square_attacked(board: &Board, square: usize, by_color: i8) -> bool {
    // Quick pawn attacks
    let pawn_forward = if by_color == COLOR_WHITE { -9 } else { 9 };
    let pawn_attacks = [square as i32 - pawn_forward - 1, square as i32 - pawn_forward + 1];
    for from in pawn_attacks {
        if from >= 0 && from < 81 {
            let from_sq = from as usize;
            if (from_sq % 9) != 0 && (from_sq % 9) != 8 { // basic file check
                 if (square as i32 % 9 - from_sq as i32 % 9).abs() == 1 {
                    let p = board[from_sq];
                    if p != PIECE_NONE && (p & COLOR_MASK) == by_color && (p & TYPE_MASK) == PIECE_PAWN {
                        return true;
                    }
                }
            }
        }
    }

    // Knight attacks
    for offset in KNIGHT_OFFSETS {
        let from = square as i32 + offset;
        if from < 0 || from >= 81 { continue; }
        let from_sq = from as usize;
        let dr = (from_sq / 9) as i32 - (square / 9) as i32;
        let dc = (from_sq % 9) as i32 - (square % 9) as i32;
        if dr.abs() > 2 || dc.abs() > 2 { continue; }
        let p = board[from_sq];
        if p != PIECE_NONE && (p & COLOR_MASK) == by_color {
            let pt = p & TYPE_MASK;
            if pt == PIECE_KNIGHT || pt == PIECE_ARCHBISHOP || pt == PIECE_CHANCELLOR || pt == PIECE_ANGEL {
                return true;
            }
        }
    }

    // King attacks
    for offset in KING_OFFSETS {
        let from = square as i32 + offset;
        if from < 0 || from >= 81 { continue; }
        let from_sq = from as usize;
        let dr = (from_sq / 9) as i32 - (square / 9) as i32;
        let dc = (from_sq % 9) as i32 - (square % 9) as i32;
        if dr.abs() > 1 || dc.abs() > 1 { continue; }
        let p = board[from_sq];
        if p != PIECE_NONE && (p & COLOR_MASK) == by_color && (p & TYPE_MASK) == PIECE_KING {
            return true;
        }
    }

    // Sliding attacks (Bishop/Rook/Queen/Archbishop/Chancellor/Angel)
    for offset in BISHOP_OFFSETS.iter().chain(ROOK_OFFSETS.iter()) {
        let mut curr = square as i32 + *offset;
        while curr >= 0 && curr < 81 {
            let curr_sq = curr as usize;
            let dr = (curr_sq / 9) as i32 - ((curr - *offset) / 9) as i32;
            let dc = (curr_sq % 9) as i32 - ((curr - *offset) % 9) as i32;
            if dr.abs() > 1 || dc.abs() > 1 { break; }

            let p = board[curr_sq];
            if p == PIECE_NONE {
                curr += *offset;
                continue;
            }
            if (p & COLOR_MASK) == by_color {
                let pt = p & TYPE_MASK;
                // Bishop-like
                if BISHOP_OFFSETS.contains(offset) && 
                   (pt == PIECE_BISHOP || pt == PIECE_QUEEN || pt == PIECE_ARCHBISHOP || pt == PIECE_ANGEL) {
                    return true;
                }
                // Rook-like
                if ROOK_OFFSETS.contains(offset) && 
                   (pt == PIECE_ROOK || pt == PIECE_QUEEN || pt == PIECE_CHANCELLOR || pt == PIECE_ANGEL) {
                    return true;
                }
            }
            break; // Blocked by any piece
        }
    }

    // Nightrider attacks
    for offset in KNIGHT_OFFSETS {
        let mut curr = square as i32 + offset;
        while curr >= 0 && curr < 81 {
            let curr_sq = curr as usize;
            let dr = (curr_sq / 9) as i32 - ((curr - offset) / 9) as i32;
            let dc = (curr_sq % 9) as i32 - ((curr - offset) % 9) as i32;
            if !((dr == 2 && dc == 1) || (dr == 1 && dc == 2)) { break; }

            let p = board[curr_sq];
            if p == PIECE_NONE {
                curr += offset;
                continue;
            }
            if (p & COLOR_MASK) == by_color && (p & TYPE_MASK) == PIECE_NIGHTRIDER {
                return true;
            }
            break;
        }
    }

    false
}

/// Find king of given color
fn find_king(board: &Board, color: i8) -> Option<usize> {
    for (i, &p) in board.iter().enumerate() {
        if p != PIECE_NONE && (p & COLOR_MASK) == color && (p & TYPE_MASK) == PIECE_KING {
            return Some(i);
        }
    }
    None
}

/// Check if moving a piece creates a discovered attack (X-ray through own piece)
fn is_discovered_attack(board: &Board, move_from: usize, move_to: usize, color: i8) -> Vec<(usize, i8)> {
    let mut discoveries = Vec::new();
    let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };
    
    // Check all rays from move_from to see if our piece was blocking an attack
    for offset in BISHOP_OFFSETS.iter().chain(ROOK_OFFSETS.iter()).chain(KNIGHT_OFFSETS.iter()) {
        let mut curr = move_from as i32;
        let mut found_our_piece = false;
        
        // Search in both directions
        for &direction in &[1i32, -1] {
            curr = move_from as i32 + direction * offset;
            while curr >= 0 && curr < 81 {
                let curr_sq = curr as usize;
                let dr = (curr_sq / 9) as i32 - ((curr - direction * offset) / 9) as i32;
                let dc = (curr_sq % 9) as i32 - ((curr - direction * offset) % 9) as i32;
                if KNIGHT_OFFSETS.contains(offset) {
                    if !((dr == 2 && dc == 1) || (dr == 1 && dc == 2)) { break; }
                } else {
                    if dr.abs() > 1 || dc.abs() > 1 { break; }
                }

                let p = board[curr_sq];
                if p == PIECE_NONE {
                    curr += direction * offset;
                    continue;
                }
                
                if (p & COLOR_MASK) == color {
                    if !found_our_piece {
                        found_our_piece = true;
                    } else {
                        break; // Second own piece blocks
                    }
                } else {
                    // Enemy piece - if we had our piece in between, this is a discovered attack
                    if found_our_piece {
                        discoveries.push((curr_sq, p & TYPE_MASK));
                    }
                    break;
                }
            }
        }
    }
    discoveries
}

pub fn order_moves(board: &Board, moves: &mut [Move], tt_move: Option<Move>, killer_moves: &[[Option<Move>; 2]; 64], history: &[i32; 81*81], ply: usize) {
    // Determine side to move from the board
    let mut side_to_move = COLOR_WHITE;
    for &p in board.iter() {
        if p != PIECE_NONE {
            side_to_move = p & COLOR_MASK;
            break;
        }
    }
    let enemy_color = if side_to_move == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };

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

                // THREAT: Hanging piece bonus - captured piece is not defended
                if !is_square_attacked(board, m.to, enemy_color) && victim_val > 0 {
                    score += THREAT_HANGING_PIECE_BONUS;
                }
            } else {
                // Non-captures: check for threats
                if ply < 64 {
                    if killer_moves[ply][0] == Some(m) {
                        score = KILLER_MOVE_1_SCORE;
                    } else if killer_moves[ply][1] == Some(m) {
                        score = KILLER_MOVE_2_SCORE;
                    } else {
                        // History Heuristic
                        score = history[m.from * 81 + m.to];
                    }
                }

                // THREAT ANALYSIS for non-captures
                // Make a copy of the board to evaluate the move
                let mut board_after = *board;
                make_move(&mut board_after, m);

                // 1. Check if move gives check
                if let Some(enemy_king) = find_king(&board_after, enemy_color) {
                    if is_square_attacked(&board_after, enemy_king, side_to_move) {
                        score += THREAT_CHECK_SCORE;
                    }
                }

                // 2. Direct attacks on enemy pieces (non-captures that attack valuable pieces)
                let mover_piece = board_after[m.to];
                if mover_piece != PIECE_NONE {
                    let mover_color = mover_piece & COLOR_MASK;
                    if mover_color == side_to_move {
                        // Check all attacks from the new position
                        for offset in BISHOP_OFFSETS.iter().chain(ROOK_OFFSETS.iter()).chain(KNIGHT_OFFSETS.iter()) {
                            let mut curr = m.to as i32 + *offset;
                            while curr >= 0 && curr < 81 {
                                let curr_sq = curr as usize;
                                // Check ray continuity
                                let dr = (curr_sq / 9) as i32 - ((curr - *offset) / 9) as i32;
                                let dc = (curr_sq % 9) as i32 - ((curr - *offset) % 9) as i32;
                                if KNIGHT_OFFSETS.contains(offset) {
                                    if !((dr == 2 && dc == 1) || (dr == 1 && dc == 2)) { break; }
                                } else {
                                    if dr.abs() > 1 || dc.abs() > 1 { break; }
                                }

                                let p = board_after[curr_sq];
                                if p == PIECE_NONE {
                                    curr += *offset;
                                    continue;
                                }

                                if (p & COLOR_MASK) == enemy_color {
                                    // Found an attack on enemy piece
                                    let victim_val = PIECE_VALUES[(p & TYPE_MASK) as usize];
                                    if victim_val >= 500 {
                                        score += THREAT_CAPTURE_HIGH_VALUE;
                                    } else if victim_val >= 300 {
                                        score += THREAT_CAPTURE_MID_VALUE;
                                    } else if victim_val > 0 {
                                        score += THREAT_CAPTURE_LOW_VALUE;
                                    }
                                    break; // Stop at first piece on this ray
                                } else {
                                    break; // Own piece blocks
                                }
                            }
                        }

                        // Knight-like pieces (including Archbishop, Chancellor, Angel, Nightrider)
                        for offset in KNIGHT_OFFSETS {
                            let curr = m.to as i32 + offset;
                            if curr < 0 || curr >= 81 { continue; }
                            let curr_sq = curr as usize;
                            let dr = (curr_sq / 9) as i32 - (m.to / 9) as i32;
                            let dc = (curr_sq % 9) as i32 - (m.to % 9) as i32;
                            if dr.abs() > 2 || dc.abs() > 2 { continue; }

                            let p = board_after[curr_sq];
                            if p != PIECE_NONE && (p & COLOR_MASK) == enemy_color {
                                let victim_val = PIECE_VALUES[(p & TYPE_MASK) as usize];
                                if victim_val >= 500 {
                                    score += THREAT_CAPTURE_HIGH_VALUE;
                                } else if victim_val >= 300 {
                                    score += THREAT_CAPTURE_MID_VALUE;
                                } else if victim_val > 0 {
                                    score += THREAT_CAPTURE_LOW_VALUE;
                                }
                            }
                        }

                        // King attacks (adjacent squares)
                        for offset in KING_OFFSETS {
                            let curr = m.to as i32 + offset;
                            if curr < 0 || curr >= 81 { continue; }
                            let curr_sq = curr as usize;
                            let dr = (curr_sq / 9) as i32 - (m.to / 9) as i32;
                            let dc = (curr_sq % 9) as i32 - (m.to % 9) as i32;
                            if dr.abs() > 1 || dc.abs() > 1 { continue; }

                            let p = board_after[curr_sq];
                            if p != PIECE_NONE && (p & COLOR_MASK) == enemy_color {
                                let victim_val = PIECE_VALUES[(p & TYPE_MASK) as usize];
                                if victim_val >= 500 {
                                    score += THREAT_CAPTURE_HIGH_VALUE;
                                } else if victim_val >= 300 {
                                    score += THREAT_CAPTURE_MID_VALUE;
                                } else if victim_val > 0 {
                                    score += THREAT_CAPTURE_LOW_VALUE;
                                }
                            }
                        }
                    }
                }

                // 3. Discovered attacks / X-ray threats (moving piece was blocking an attack)
                let discoveries = is_discovered_attack(board, m.from, m.to, side_to_move);
                for (target_sq, target_type) in discoveries {
                    let victim_val = PIECE_VALUES[target_type as usize];
                    if target_type == PIECE_KING {
                        score += THREAT_DISCOVERED_CHECK;
                    } else if victim_val >= 500 {
                        score += THREAT_XRAY_HIGH;
                    } else if victim_val >= 300 {
                        score += THREAT_XRAY_MID;
                    }
                }

                // 4. King safety: penalize moves that expose our own king
                if let Some(our_king) = find_king(&board_after, side_to_move) {
                    if is_square_attacked(&board_after, our_king, enemy_color) {
                        score += THREAT_KING_SAFETY_PENALTY;
                    }
                }
            }
        }

        (m, score)
    }).collect();

    scored_moves.sort_by(|a, b| b.1.cmp(&a.1));

    for (i, (m, _)) in scored_moves.into_iter().enumerate() {
        moves[i] = m;
    }
}
