use crate::definitions::*;

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
    
    let mut white_material = 0;
    let mut black_material = 0;

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

    for i in 0..SQUARE_COUNT {
        let piece = board[i];
        if piece == PIECE_NONE { continue; }

        let piece_type = piece & TYPE_MASK;
        let color = piece & COLOR_MASK;
        let is_white = color == COLOR_WHITE;
        let side_mult = if is_white { 1 } else { -1 };

        let val = PIECE_VALUES[piece_type as usize];
        if is_white { white_material += val; } else { black_material += val; }
        total_phase += PHASE_VALUES[piece_type as usize];

        // Basic material evaluation
        mg_score += (val as f32 * material_weight) as i32 * side_mult;
        eg_score += (val as f32 * material_weight) as i32 * side_mult;

        // Simplify for initial port: skip PST for now or add them later
        // PST implementation is tedious to copy-paste, can be injected or hardcoded later
    }

    let max_phase = 32;
    let phase = total_phase.min(max_phase);
    let mg_weight = phase as f32 / max_phase as f32;
    let eg_weight = 1.0 - mg_weight;

    let total = (mg_score as f32 * mg_weight + eg_score as f32 * eg_weight) as i32;

    // Root noise logic
    if let Some(elo) = config.elo {
        if elo < 2500 {
            // Simplistic noise for now
        }
    }

    let perspective = if turn_color == COLOR_WHITE { 1 } else { -1 };
    total * perspective
}
