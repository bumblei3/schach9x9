use crate::definitions::*;
use rand::Rng;

pub enum Personality {
    NORMAL,
    AGGRESSIVE,
    SOLID,
    GENTLE,
}

pub struct EvalConfig {
    pub personality: Personality,
    pub elo: Option<i32>,
}

// PST constant arrays
// Simplified loading (hardcoded or macro would be better, but explicit array init is fine)
// We will use the values from JS
const PST_PAWN: [i8; 81] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 25, 20, 0, 0, 0,
  5, -5, -10, 0, 10, 0, -10, -5, 5,
  5, 10, 10, -20, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT: [i8; 81] = [
  -50, -40, -30, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 25, 20, 15, 0, -30,
  -30, 5, 15, 20, 20, 20, 15, 5, -30,
  -30, 0, 10, 15, 15, 15, 10, 0, -30,
  -40, -20, 0, 5, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -30, -40, -50,
];

// Using simplified mapping for other pieces to save space/time, or just copying arrays?
// Let's implement get_pst helper and map others to similar tables or 0 if needed.
// JS used KNIGHT PST for Archbishop and QUEEN for others.

const PST_BISHOP: [i8; 81] = [
  -20, -10, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 15, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 0, 5, -10,
  -10, 0, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK: [i8; 81] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 5, 0, 0, 0, // Approx last row
];

const PST_QUEEN: [i8; 81] = [
  -20, -10, -10, -5, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 5, 0, 0,
  -5, -5, 0, 5, 5, 5, 5, 5, 0,
  -5, -10, 0, 5, 5, 5, 5, 5, 0,
  -10, -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -5, -10, -10, -20,
];

const PST_KING_MG: [i8; 81] = [
  -30, -40, -40, -50, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -50, -40, -40, -30,
  -30, -40, -50, -50, -50, -40, -40, -30, -30,
  -20, -30, -30, -40, -40, -40, -30, -30, -20,
  20, 20, 0, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 0, 10, 30, 20,
  20, 30, 10, 0, 0, 0, 10, 30, 20,
];

const PST_KING_EG: [i8; 81] = [
  -50, -40, -30, -20, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, 0, -10, -20, -30,
  -30, -10, 10, 20, 20, 20, 10, -10, -30,
  -30, 0, 20, 30, 30, 30, 20, 0, -30,
  -30, 0, 20, 30, 40, 30, 20, 0, -30,
  -30, 0, 20, 30, 30, 30, 20, 0, -30,
  -30, -10, 10, 20, 20, 20, 10, -10, -30,
  -20, -10, 0, 0, 0, 0, 0, -10, -20,
  -50, -40, -30, -20, -20, -20, -30, -40, -50,
];

fn get_pst(piece_type: i8, r: usize, c: usize, color: i8, is_endgame: bool) -> i32 {
    let rank = if color == COLOR_WHITE { r } else { 8 - r };
    let idx = rank * 9 + c;

    let val = match piece_type {
        PIECE_PAWN => PST_PAWN[idx],
        PIECE_KNIGHT => PST_KNIGHT[idx],
        PIECE_BISHOP => PST_BISHOP[idx],
        PIECE_ROOK => PST_ROOK[idx],
        PIECE_QUEEN => PST_QUEEN[idx],
        PIECE_KING => if is_endgame { PST_KING_EG[idx] } else { PST_KING_MG[idx] },
        PIECE_ARCHBISHOP => PST_KNIGHT[idx],
        PIECE_CHANCELLOR => PST_QUEEN[idx],
        PIECE_ANGEL => PST_QUEEN[idx],
        _ => 0,
    };
    val as i32
}

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
    v[PIECE_ANGEL as usize] = 1220;
    v
};

const PHASE_VALUES: [i32; 16] = {
    let mut v = [0; 16];
    v[PIECE_KNIGHT as usize] = 1;
    v[PIECE_BISHOP as usize] = 1;
    v[PIECE_ROOK as usize] = 2;
    v[PIECE_QUEEN as usize] = 4;
    v[PIECE_ARCHBISHOP as usize] = 3;
    v[PIECE_CHANCELLOR as usize] = 3;
    v[PIECE_ANGEL as usize] = 4;
    v
};


pub fn evaluate_position(board: &Board, turn_color: i8, config: &EvalConfig) -> i32 {
    let mut mg_score = 0;
    let mut eg_score = 0;
    let mut total_phase = 0;
    
    let mut attack_weight = 1.0;
    let mut pawn_structure_weight = 1.0;
    let mut king_safety_weight = 1.0;
    let mut material_weight = 1.0;

    match config.personality {
        Personality::AGGRESSIVE => {
            attack_weight = 1.4;
            pawn_structure_weight = 0.7;
            king_safety_weight = 0.8;
        }
        Personality::SOLID => {
            attack_weight = 0.7;
            pawn_structure_weight = 1.3;
            king_safety_weight = 1.4;
        }
        Personality::GENTLE => {
            material_weight = 0.9;
            attack_weight = 0.8;
        }
        _ => {}
    }

    let mut pawn_cols_white = [0; 9];
    let mut pawn_cols_black = [0; 9];
    let mut white_king_idx = -1i32;
    let mut black_king_idx = -1i32;

    // Tempo
    let side_mult = if turn_color == COLOR_WHITE { 1 } else { -1 };
    mg_score += 10 * side_mult;
    eg_score += 5 * side_mult;

    for i in 0..SQUARE_COUNT {
        let piece = board[i];
        if piece == PIECE_NONE { continue; }

        let piece_type = piece & TYPE_MASK;
        let color = piece & COLOR_MASK;
        let is_white = color == COLOR_WHITE;
        let side_mult = if is_white { 1 } else { -1 };

        let val = PIECE_VALUES[piece_type as usize];

        total_phase += PHASE_VALUES[piece_type as usize];

        let r = index_to_row(i);
        let c = index_to_col(i);

        // PST
        let mg_pst = get_pst(piece_type, r, c, color, false);
        let eg_pst = get_pst(piece_type, r, c, color, true);

        // Material + PST
        mg_score += (val as f32 * material_weight + mg_pst as f32 * attack_weight) as i32 * side_mult;
        eg_score += (val as f32 * material_weight + eg_pst as f32 * attack_weight) as i32 * side_mult;

        // Collect stats
        if piece_type == PIECE_PAWN {
            if is_white { pawn_cols_white[c] += 1; } else { pawn_cols_black[c] += 1; }
        } else if piece_type == PIECE_KING {
            if is_white { white_king_idx = i as i32; } else { black_king_idx = i as i32; }
        } else {
            // Mobility
            let mut mob = 0;
            match piece_type {
                PIECE_KNIGHT => {
                    // Knight mobility is simpler (just check targets)
                    // Simplified: just check number of empty/enemy targets
                    // Proper implementation requires `generate_stepping_moves` logic or similar
                }
                PIECE_BISHOP => { mob = count_mobility(board, i, &[-10, -8, 8, 10], color); }
                PIECE_ROOK => { mob = count_mobility(board, i, &[-9, 9, -1, 1], color); }
                PIECE_QUEEN => {
                     mob = count_mobility(board, i, &[-10, -8, 8, 10], color) 
                         + count_mobility(board, i, &[-9, 9, -1, 1], color);
                }
                PIECE_ARCHBISHOP => {
                    // Bishop + Knight
                     mob = count_mobility(board, i, &[-10, -8, 8, 10], color);
                }
                PIECE_CHANCELLOR => {
                     // Rook + Knight
                     mob = count_mobility(board, i, &[-9, 9, -1, 1], color);
                }
                 PIECE_ANGEL => {
                     // Queen + Knight
                     mob = count_mobility(board, i, &[-10, -8, 8, 10], color) 
                         + count_mobility(board, i, &[-9, 9, -1, 1], color);
                }
                _ => {}
            }
            
            // Weight mobility: 2-5 points per move?
            // Let's be conservative: 2 points per square
            mg_score += mob * 2 * side_mult;
            eg_score += mob * 3 * side_mult;
        }
    }

    // Pawn Structure (Doubled, Isolated, Connected)
    let doubled_pawn_penalty = 15.0 * pawn_structure_weight;
    let isolated_pawn_penalty = 20.0 * pawn_structure_weight;
    let linked_pawn_bonus = 10.0 * pawn_structure_weight;

    for c in 0..9 {
        // White
        if pawn_cols_white[c] > 1 {
            let penalty = (pawn_cols_white[c] - 1) as f32 * doubled_pawn_penalty;
            mg_score -= penalty as i32;
            eg_score -= penalty as i32;
        }
        if pawn_cols_white[c] > 0 {
            let left = if c > 0 { pawn_cols_white[c - 1] } else { 0 };
            let right = if c < 8 { pawn_cols_white[c + 1] } else { 0 };
            if left == 0 && right == 0 {
                let penalty = isolated_pawn_penalty;
                mg_score -= penalty as i32;
                eg_score -= penalty as i32;
            } else {
                // Connected / Linked
                let bonus = pawn_cols_white[c] as f32 * linked_pawn_bonus;
                mg_score += bonus as i32;
                eg_score += bonus as i32;
            }
        }
        // Black
        if pawn_cols_black[c] > 1 {
            let penalty = (pawn_cols_black[c] - 1) as f32 * doubled_pawn_penalty;
            mg_score += penalty as i32;
            eg_score += penalty as i32;
        }
        if pawn_cols_black[c] > 0 {
            let left = if c > 0 { pawn_cols_black[c - 1] } else { 0 };
            let right = if c < 8 { pawn_cols_black[c + 1] } else { 0 };
            if left == 0 && right == 0 {
                let penalty = isolated_pawn_penalty;
                mg_score += penalty as i32;
                eg_score += penalty as i32;
            } else {
                // Connected / Linked
                let bonus = pawn_cols_black[c] as f32 * linked_pawn_bonus;
                mg_score -= bonus as i32;
                eg_score -= bonus as i32;
            }
        }
    }

    // King Safety (Shelter)
    let shelter_penalty = 15.0 * king_safety_weight;
    if white_king_idx != -1 {
         let c = index_to_col(white_king_idx as usize);
         if pawn_cols_white[c] == 0 {
             mg_score -= shelter_penalty as i32;
             eg_score -= (shelter_penalty * 0.5) as i32;
         }
    }
    if black_king_idx != -1 {
         let c = index_to_col(black_king_idx as usize);
         if pawn_cols_black[c] == 0 {
             mg_score += shelter_penalty as i32;
             eg_score += (shelter_penalty * 0.5) as i32;
         }
    }


    let max_phase = 32;
    let phase = total_phase.min(max_phase);
    let mg_weight = phase as f32 / max_phase as f32;
    let eg_weight = 1.0 - mg_weight;

    let total = (mg_score as f32 * mg_weight + eg_score as f32 * eg_weight) as i32;

    // Root noise logic
    if let Some(elo) = config.elo {
        if elo < 2500 {
            let noise_range = (2500 - elo).max(0) / 8;
            if noise_range > 0 {
                let mut rng = rand::thread_rng();
                let noise = rng.r#gen_range(-noise_range..=noise_range);
                // Return score with noise
                let perspective = if turn_color == COLOR_WHITE { 1 } else { -1 };
                return (total + noise) * perspective;
            }
        }
    }

    let perspective = if turn_color == COLOR_WHITE { 1 } else { -1 };
    total * perspective
}

fn count_mobility(board: &Board, square: usize, offsets: &[i32], color: i8) -> i32 {
    let mut count = 0;
    let r = index_to_row(square) as i32;
    let c = index_to_col(square) as i32;
    
    for &offset in offsets {
        let mut curr = square as i32;
        loop {
            curr += offset;
            if !is_valid_square(curr) { break; }
            
            let cr = index_to_row(curr as usize) as i32;
            let cc = index_to_col(curr as usize) as i32;
            
            // Wrap checks using previous square logic
            if offset == 1 || offset == -1 { if cr != r { break; } }
            else if offset == 9 || offset == -9 { if cc != c { break; } }
            else {
                 let prev = curr - offset;
                 let pr = index_to_row(prev as usize) as i32;
                 let pc = index_to_col(prev as usize) as i32;
                 if (cr - pr).abs() != 1 || (cc - pc).abs() != 1 { break; }
            }

            let p = board[curr as usize];
            if p == PIECE_NONE {
                count += 1;
            } else {
                if (p & COLOR_MASK) != color {
                    count += 1;
                }
                break;
            }
        }
    }
    count
}
