import { BOARD_SIZE } from '../config.js';
import { see } from './MoveGenerator.js';

// Killer Moves: Moves that caused beta cutoffs at each depth
// Format: killerMoves[depth] = [move1, move2]
const killerMoves = new Map();
const MAX_KILLER_MOVES = 2; // Store top 2 killer moves per depth

// History Heuristic: Track which moves have been good historically
// Format: historyTable[piece.type][from.r][from.c][to.r][to.c] = score
const historyTable = {};

// Initialize history table
export function initHistoryTable() {
  const types = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e'];
  for (const type of types) {
    historyTable[type] = [];
    for (let fr = 0; fr < BOARD_SIZE; fr++) {
      historyTable[type][fr] = [];
      for (let fc = 0; fc < BOARD_SIZE; fc++) {
        historyTable[type][fr][fc] = [];
        for (let tr = 0; tr < BOARD_SIZE; tr++) {
          historyTable[type][fr][fc][tr] = new Array(BOARD_SIZE).fill(0);
        }
      }
    }
  }
}

// Clear killer moves (between moves)
export function clearKillerMoves() {
  killerMoves.clear();
}

/**
 * Add a killer move for a specific depth
 */
export function addKillerMove(depth, move) {
  if (!killerMoves.has(depth)) {
    killerMoves.set(depth, []);
  }

  const killers = killerMoves.get(depth);

  // Check if move already exists in killers
  const exists = killers.some(
    k =>
      k &&
      k.from.r === move.from.r &&
      k.from.c === move.from.c &&
      k.to.r === move.to.r &&
      k.to.c === move.to.c
  );

  if (!exists) {
    // Add to front and keep only top MAX_KILLER_MOVES
    killers.unshift(move);
    if (killers.length > MAX_KILLER_MOVES) {
      killers.pop();
    }
  }
}

/**
 * Update history heuristic for a good move
 */
export function updateHistory(piece, move, depth) {
  if (!piece || !historyTable[piece.type]) return;

  // Increase history score based on depth (deeper = more valuable)
  const bonus = depth * depth; // Quadratic bonus
  historyTable[piece.type][move.from.r][move.from.c][move.to.r][move.to.c] += bonus;

  // Cap history values to prevent overflow
  const maxHistory = 10000;
  if (historyTable[piece.type][move.from.r][move.from.c][move.to.r][move.to.c] > maxHistory) {
    historyTable[piece.type][move.from.r][move.from.c][move.to.r][move.to.c] = maxHistory;
  }
}

/**
 * Order moves for better alpha-beta pruning
 * Priority: 1) TT best move, 2) Captures (MVV-LVA), 3) Killer moves, 4) History heuristic
 */
export function orderMoves(board, moves, ttBestMove, depth = 0) {
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    let score = 0;
    const fromPiece = board[move.from.r][move.from.c];
    if (!fromPiece) continue;

    // 1. TT move gets highest priority
    if (
      ttBestMove &&
      move.from.r === ttBestMove.from.r &&
      move.from.c === ttBestMove.from.c &&
      move.to.r === ttBestMove.to.r &&
      move.to.c === ttBestMove.to.c
    ) {
      score += 10000;
    }

    // 2. SEE-based capture scoring (replaces MVV-LVA)
    const targetPiece = board[move.to.r][move.to.c];
    if (targetPiece) {
      const seeScore = see(board, move.from, move.to);
      // Good captures (winning material) get high scores
      // Bad captures (losing material) still tried after good captures but before quiet moves
      if (seeScore >= 0) {
        score += 5000 + seeScore; // Good captures: 5000+
      } else {
        score += 1000 + seeScore; // Bad captures: 1000 + negative = less priority
      }
    } else {
      // 3. Killer moves (non-capture moves that caused beta cutoffs)
      const killers = killerMoves.get(depth);
      if (killers) {
        // Optimized check for MAX_KILLER_MOVES = 2
        const k0 = killers[0];
        if (
          k0 &&
          move.from.r === k0.from.r &&
          move.from.c === k0.from.c &&
          move.to.r === k0.to.r &&
          move.to.c === k0.to.c
        ) {
          score += 900;
        } else {
          const k1 = killers[1];
          if (
            k1 &&
            move.from.r === k1.from.r &&
            move.from.c === k1.from.c &&
            move.to.r === k1.to.r &&
            move.to.c === k1.to.c
          ) {
            score += 800;
          }
        }
      }

      // 4. History heuristic
      if (historyTable[fromPiece.type]) {
        const historyValue =
          historyTable[fromPiece.type][move.from.r][move.from.c][move.to.r][move.to.c];
        if (historyValue > 0) {
          score += historyValue / 100;
        }
      }
    }

    move._score = score;
  }

  // Sort by score (highest first)
  moves.sort((a, b) => (b._score || 0) - (a._score || 0));

  return moves;
}

// Initialize on load
initHistoryTable();
