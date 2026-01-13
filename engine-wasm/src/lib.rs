pub mod definitions;
pub mod move_gen;
pub mod eval;
pub mod search;
pub mod zobrist;
pub mod ordering;

use wasm_bindgen::prelude::*;
use definitions::*;
use search::*;
use eval::*;

#[wasm_bindgen]
pub fn get_best_move_wasm(board_bytes: &[i8], color_str: &str, depth: i8, personality_str: &str, elo: i32) -> String {
    let mut board: Board = [0; 81];
    for (i, &v) in board_bytes.iter().enumerate().take(81) {
        board[i] = v;
    }
    
    let color = if color_str == "white" { COLOR_WHITE } else { COLOR_BLACK };
    let personality = match personality_str {
        "AGGRESSIVE" => Personality::AGGRESSIVE,
        "SOLID" => Personality::SOLID,
        "GENTLE" => Personality::GENTLE,
        _ => Personality::NORMAL,
    };

    let config_elo = if elo > 0 { Some(elo) } else { None };

    let config = EvalConfig {
        personality,
        elo: config_elo,
    };

    let (best_move, score, nodes) = search(&board, depth, color, &config);
    
    serde_json::to_string(&(best_move, score, nodes)).unwrap()
}
