use crate::definitions::*;

const UP: i32 = -9;
const DOWN: i32 = 9;
const LEFT: i32 = -1;
const RIGHT: i32 = 1;

const KNIGHT_OFFSETS: [i32; 8] = [-19, -17, -11, -7, 7, 11, 17, 19];
const KING_OFFSETS: [i32; 8] = [-10, -9, -8, -1, 1, 8, 9, 10];
const BISHOP_OFFSETS: [i32; 4] = [-10, -8, 8, 10];
const ROOK_OFFSETS: [i32; 4] = [-9, 9, -1, 1];

pub struct UndoInfo {
    pub move_obj: Move,
    pub captured: i8,
    pub piece: i8,
}

pub fn get_all_legal_moves(board: &Board, color: i8) -> Vec<Move> {
    let mut moves = Vec::new();
    let enemy_color = if color == COLOR_WHITE { COLOR_BLACK } else { COLOR_WHITE };

    for from in 0..SQUARE_COUNT {
        let piece = board[from];
        if piece == PIECE_NONE || (piece & COLOR_MASK) != color {
            continue;
        }

        let piece_type = piece & TYPE_MASK;
        if piece_type == PIECE_PAWN {
            generate_pawn_moves(board, from, color, &mut moves);
        } else {
            generate_piece_moves(board, from, piece_type, color, &mut moves);
        }
    }

    let mut legal_moves = Vec::new();
    let my_king_pos = find_king(board, color);

    for m in moves {
        let mut temp_board = *board;
        let undo = make_move(&mut temp_board, m);
        
        let king_pos = if m.from == my_king_pos { m.to } else { my_king_pos };
        if !is_square_attacked(&temp_board, king_pos, enemy_color) {
            legal_moves.push(m);
        }
    }

    legal_moves
}

pub fn get_all_capture_moves(board: &Board, color: i8) -> Vec<Move> {
    let all = get_all_legal_moves(board, color);
    all.into_iter().filter(|m| board[m.to] != PIECE_NONE).collect()
}

fn generate_pawn_moves(board: &Board, from: usize, color: i8, moves: &mut Vec<Move>) {
    let direction = if color == COLOR_WHITE { UP } else { DOWN };
    let rank = index_to_row(from);

    let forward = (from as i32 + direction) as usize;
    if is_valid_square(forward as i32) && board[forward] == PIECE_NONE {
        moves.push(Move { from, to: forward, promotion: None, flags: FLAG_NONE });

        let is_start = (color == COLOR_WHITE && rank == 6) || (color == COLOR_BLACK && rank == 2);
        if is_start {
            let double_forward = (forward as i32 + direction) as usize;
            if is_valid_square(double_forward as i32) && board[double_forward] == PIECE_NONE {
                moves.push(Move { from, to: double_forward, promotion: None, flags: FLAG_DOUBLE });
            }
        }
    }

    // Captures
    for side in [LEFT, RIGHT] {
        let capture = (from as i32 + direction + side) as i32;
        if is_valid_square(capture) {
            let capture_idx = capture as usize;
            if (index_to_col(from) as i32 - index_to_col(capture_idx) as i32).abs() == 1 {
                let target = board[capture_idx];
                if target != PIECE_NONE && (target & COLOR_MASK) != color {
                    moves.push(Move { from, to: capture_idx, promotion: None, flags: FLAG_NONE });
                }
            }
        }
    }
}

fn generate_piece_moves(board: &Board, from: usize, piece_type: i8, color: i8, moves: &mut Vec<Move>) {
    match piece_type {
        PIECE_KNIGHT | PIECE_ARCHBISHOP | PIECE_CHANCELLOR | PIECE_ANGEL => {
            generate_stepping_moves(board, from, &KNIGHT_OFFSETS, color, moves);
        }
        _ => {}
    }
    if piece_type == PIECE_KING {
        generate_stepping_moves(board, from, &KING_OFFSETS, color, moves);
    }
    
    match piece_type {
        PIECE_BISHOP | PIECE_ARCHBISHOP | PIECE_QUEEN | PIECE_ANGEL => {
            generate_sliding_moves(board, from, &BISHOP_OFFSETS, color, moves);
        }
        _ => {}
    }
    match piece_type {
        PIECE_ROOK | PIECE_CHANCELLOR | PIECE_QUEEN | PIECE_ANGEL => {
            generate_sliding_moves(board, from, &ROOK_OFFSETS, color, moves);
        }
        _ => {}
    }
}

fn generate_stepping_moves(board: &Board, from: usize, offsets: &[i32], color: i8, moves: &mut Vec<Move>) {
    let r = index_to_row(from) as i32;
    let c = index_to_col(from) as i32;

    for &offset in offsets {
        let to = from as i32 + offset;
        if !is_valid_square(to) { continue; }

        let tr = index_to_row(to as usize) as i32;
        let tc = index_to_col(to as usize) as i32;
        if (tr - r).abs() > 2 || (tc - c).abs() > 2 { continue; }

        let target = board[to as usize];
        if target == PIECE_NONE || (target & COLOR_MASK) != color {
            moves.push(Move { from, to: to as usize, promotion: None, flags: FLAG_NONE });
        }
    }
}

fn generate_sliding_moves(board: &Board, from: usize, offsets: &[i32], color: i8, moves: &mut Vec<Move>) {
    let r = index_to_row(from) as i32;
    let c = index_to_col(from) as i32;

    for &offset in offsets {
        let mut current = from as i32;
        loop {
            current += offset;
            if !is_valid_square(current) { break; }

            let tr = index_to_row(current as usize) as i32;
            let tc = index_to_col(current as usize) as i32;

            // Wrap checks
            if offset == 1 || offset == -1 {
                if tr != r { break; }
            } else if offset == 9 || offset == -9 {
                if tc != c { break; }
            } else {
                let prev = current - offset;
                let pr = index_to_row(prev as usize) as i32;
                let pc = index_to_col(prev as usize) as i32;
                if (tr - pr).abs() != 1 || (tc - pc).abs() != 1 { break; }
            }

            let target = board[current as usize];
            if target == PIECE_NONE {
                moves.push(Move { from, to: current as usize, promotion: None, flags: FLAG_NONE });
            } else {
                if (target & COLOR_MASK) != color {
                    moves.push(Move { from, to: current as usize, promotion: None, flags: FLAG_NONE });
                }
                break;
            }
        }
    }
}

pub fn make_move(board: &mut Board, m: Move) -> UndoInfo {
    let piece = board[m.from];
    let captured = board[m.to];
    board[m.to] = piece;
    board[m.from] = PIECE_NONE;
    UndoInfo { move_obj: m, captured, piece }
}

pub fn undo_move(board: &mut Board, undo: UndoInfo) {
    board[undo.move_obj.from] = undo.piece;
    board[undo.move_obj.to] = undo.captured;
}

pub fn is_square_attacked(board: &Board, square: usize, attacker_color: i8) -> bool {
    let forward = if attacker_color == COLOR_WHITE { UP } else { DOWN };
    let pawn_origins = [-(forward + LEFT), -(forward + RIGHT)];
    
    for offset in pawn_origins {
        let from = square as i32 + offset;
        if is_valid_square(from) {
            let from_idx = from as usize;
            if (index_to_col(square) as i32 - index_to_col(from_idx) as i32).abs() == 1 {
                let p = board[from_idx];
                if (p & COLOR_MASK) == attacker_color && (p & TYPE_MASK) == PIECE_PAWN {
                    return true;
                }
            }
        }
    }

    for &offset in &KNIGHT_OFFSETS {
        let from = square as i32 - offset;
        if is_valid_square(from) {
            let from_idx = from as usize;
            let fr = index_to_row(from_idx) as i32;
            let fc = index_to_col(from_idx) as i32;
            let r = index_to_row(square) as i32;
            let c = index_to_col(square) as i32;
            if (fr - r).abs() > 2 || (fc - c).abs() > 2 { continue; }

            let p = board[from_idx];
            if p != PIECE_NONE && (p & COLOR_MASK) == attacker_color {
                let t = p & TYPE_MASK;
                if matches!(t, PIECE_KNIGHT | PIECE_ARCHBISHOP | PIECE_CHANCELLOR | PIECE_ANGEL) {
                    return true;
                }
            }
        }
    }

    for &offset in &KING_OFFSETS {
        let from = square as i32 - offset;
        if is_valid_square(from) {
            let from_idx = from as usize;
            if (index_to_col(square) as i32 - index_to_col(from_idx) as i32).abs() > 1 { continue; }
            let p = board[from_idx];
            if p != PIECE_NONE && (p & COLOR_MASK) == attacker_color && (p & TYPE_MASK) == PIECE_KING {
                return true;
            }
        }
    }

    if check_ray_attacks(board, square, &BISHOP_OFFSETS, attacker_color, &[PIECE_BISHOP, PIECE_QUEEN, PIECE_ARCHBISHOP, PIECE_ANGEL]) {
        return true;
    }
    if check_ray_attacks(board, square, &ROOK_OFFSETS, attacker_color, &[PIECE_ROOK, PIECE_QUEEN, PIECE_CHANCELLOR, PIECE_ANGEL]) {
        return true;
    }

    false
}

fn check_ray_attacks(board: &Board, square: usize, offsets: &[i32], attacker_color: i8, valid_types: &[i8]) -> bool {
    let r = index_to_row(square) as i32;
    let c = index_to_col(square) as i32;

    for &offset in offsets {
        let mut curr = square as i32;
        loop {
            curr += offset;
            if !is_valid_square(curr) { break; }

            let cr = index_to_row(curr as usize) as i32;
            let cc = index_to_col(curr as usize) as i32;
            let prev = curr - offset;
            let pr = index_to_row(prev as usize) as i32;
            let pc = index_to_col(prev as usize) as i32;

            if (cr - pr).abs() > 1 || (cc - pc).abs() > 1 { break; }

            let p = board[curr as usize];
            if p != PIECE_NONE {
                if (p & COLOR_MASK) == attacker_color && valid_types.contains(&(p & TYPE_MASK)) {
                    return true;
                }
                break;
            }
        }
    }
    false
}

pub fn find_king(board: &Board, color: i8) -> usize {
    for i in 0..SQUARE_COUNT {
        if (board[i] & TYPE_MASK) == PIECE_KING && (board[i] & COLOR_MASK) == color {
            return i;
        }
    }
    usize::MAX
}
