/**
 * Search module for Schach 9x9 AI.
 * Contains alpha-beta search, quiescence search, move ordering,
 * and the JS fallback search with iterative deepening.
 */

import {
  SQUARE_COUNT,
  PIECE_NONE,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_ARCHBISHOP,
  PIECE_CHANCELLOR,
  PIECE_ANGEL,
  TYPE_MASK,
  COLOR_MASK,
  COLOR_WHITE,
  COLOR_BLACK,
} from './ai/BoardDefinitions';
import type { Move } from './ai/MoveGenerator';
import {
  getAllLegalMoves as genLegalInt,
  makeMove as makeMoveInt,
  undoMove as undoMoveInt,
  getAllCaptureMoves,
  isInCheck as checkInt,
} from './ai/MoveGenerator';
import { evaluate } from './evaluate';
import { computeZobristHash, TranspositionTable } from './ai/transpositionTable';
import type { IntBoard } from './evaluate';

// =====================================================================
// Search constants
// =====================================================================
const MATE_SCORE = 20000;
const INFINITY = 30000;
const MAX_SEARCH_TIME = 8000;

// =====================================================================
// Quiescence search — resolve captures to avoid horizon effect
// =====================================================================

function quiesce(
  b: IntBoard,
  alpha: number,
  beta: number,
  c: number,
  start: number,
  nodes: { count: number }
): number {
  nodes.count++;

  if (nodes.count % 1000 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
    return evaluate(b, c);
  }

  const standPat = evaluate(b, c);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const activeColorStr = c === COLOR_WHITE ? 'white' : 'black';
  const captures = getAllCaptureMoves(b, activeColorStr);

  captures.sort((_, mv) => {
    const victim = b[mv.to] & TYPE_MASK;
    const attacker = b[mv.from] & TYPE_MASK;
    return (EVAL_VALUES[victim] || 0) - (EVAL_VALUES[attacker] || 0);
  });

  for (const move of captures) {
    const undo = makeMoveInt(b, move);
    const score = -quiesce(b, -beta, -alpha, c ^ COLOR_MASK, start, nodes);
    undoMoveInt(b, undo);

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// =====================================================================
// Move ordering — TT move, MVV-LVA, promotions, killers, history
// =====================================================================

function orderMoves(
  moves: Move[],
  b: IntBoard,
  ttBest: Move | null,
  killers: (Move | null)[],
  history: Int32Array
): Move[] {
  const PIECE_VALS: Record<number, number> = {
    [PIECE_PAWN]: 100, [PIECE_KNIGHT]: 320, [PIECE_BISHOP]: 330,
    [PIECE_ROOK]: 500, [PIECE_QUEEN]: 900, [PIECE_KING]: 20000,
    [PIECE_ARCHBISHOP]: 600, [PIECE_CHANCELLOR]: 700, [PIECE_ANGEL]: 1000,
  };

  return moves
    .map(move => {
      let score = 0;

      if (ttBest && move.from === ttBest.from && move.to === ttBest.to) {
        score = 2000000;
      } else {
        const target = b[move.to];
        if (target !== PIECE_NONE) {
          const victimVal = PIECE_VALS[target & TYPE_MASK] || 0;
          const attackerVal = PIECE_VALS[b[move.from] & TYPE_MASK] || 0;
          score = 1000000 + victimVal * 10 - attackerVal;
        } else {
          if (killers[0] && move.from === killers[0].from && move.to === killers[0].to) {
            score = 900000;
          } else if (killers[1] && move.from === killers[1].from && move.to === killers[1].to) {
            score = 800000;
          } else {
            const hIdx = move.from * 81 + move.to;
            score = history[hIdx] || 0;
          }
        }
      }

      if (move.promotion) {
        score += 1500000;
      }

      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.move);
}

// EVAL_VALUES needed for quiesce sort
const EVAL_VALUES: Record<number, number> = {
  [PIECE_PAWN]: 100, [PIECE_KNIGHT]: 320, [PIECE_BISHOP]: 330,
  [PIECE_ROOK]: 500, [PIECE_QUEEN]: 900, [PIECE_KING]: 20000,
  [PIECE_ARCHBISHOP]: 650, [PIECE_CHANCELLOR]: 850, [PIECE_ANGEL]: 1220,
};

// =====================================================================
// JS Fallback Search — Alpha-Beta with TT, Move Ordering, Iterative Deepening
// =====================================================================

interface JsSearchResult {
  move: Move | null;
  score: number;
  nodes: number;
  depth: number;
}

export function createJsSearch() {
  return {
    async run(
      board: IntBoard,
      turnColor: 'white' | 'black',
      maxDepth: number
    ): Promise<JsSearchResult> {
      const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
      const start = performance.now();
      let nodes = 0;
      const tt = new TranspositionTable();

      const killers: (Move | null)[][] = [];
      for (let i = 0; i <= maxDepth; i++) killers[i] = [null, null];
      const history = new Int32Array(81 * 81);

      const NULL_MOVE_R = 2;
      const FUTILITY_MARGIN = 200;
      const RAZOR_MARGIN = 400;
      const ASPIRATION_WINDOW = 50;

      function search(
        b: IntBoard, d: number, alpha: number, beta: number, maximizing: boolean
      ): { score: number; bestMove: Move | null } {
        nodes++;
        if (nodes % 1000 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
          return { score: evaluate(b, color), bestMove: null };
        }

        const hash = computeZobristHash(b);
        const ttEntry = tt.probe(hash, d);
        let ttBest: Move | null = null;

        if (ttEntry && ttEntry.depth >= d) {
          ttBest = ttEntry.bestMove;
          if (ttEntry.flag === 'exact') return { score: ttEntry.score, bestMove: ttEntry.bestMove };
          if (ttEntry.flag === 'lower' && ttEntry.score >= beta) return { score: ttEntry.score, bestMove: ttEntry.bestMove };
          if (ttEntry.flag === 'upper' && ttEntry.score <= alpha) return { score: ttEntry.score, bestMove: ttEntry.bestMove };
        }

        if (d === 0) {
          const qScore = quiesce(b, alpha, beta, color, start, { count: 0 });
          return { score: qScore, bestMove: null };
        }

        // Null-move pruning
        if (d >= 3 && !checkInt(b, maximizing ? color : color ^ COLOR_MASK)) {
          let hasMaterial = false;
          const activeColor = maximizing ? color : color ^ COLOR_MASK;
          for (let i = 0; i < SQUARE_COUNT; i++) {
            const p = b[i];
            if (p !== PIECE_NONE && (p & COLOR_MASK) === activeColor) {
              const tp = p & TYPE_MASK;
              if (tp !== PIECE_PAWN && tp !== PIECE_KING) { hasMaterial = true; break; }
            }
          }
          if (hasMaterial) {
            const nullScore = search(b, d - 1 - NULL_MOVE_R, beta - 1, beta, maximizing);
            if (nullScore.score >= beta) return { score: beta, bestMove: null };
          }
        }

        // Futility / Razoring
        if (d <= 2 && d >= 1 && !checkInt(b, maximizing ? color : color ^ COLOR_MASK)) {
          const standPat = evaluate(b, color);
          const margin = d === 2 ? RAZOR_MARGIN : FUTILITY_MARGIN;
          if (maximizing) {
            if (standPat + margin < alpha) {
              const qScore = quiesce(b, alpha, beta, color, start, { count: 0 });
              return { score: qScore, bestMove: null };
            }
          } else {
            if (standPat - margin > beta) {
              const qScore = quiesce(b, alpha, beta, color, start, { count: 0 });
              return { score: qScore, bestMove: null };
            }
          }
        }

        const activeColorStr = (maximizing ? color : color ^ COLOR_MASK) === COLOR_WHITE ? 'white' : 'black';
        const legalMoves = genLegalInt(b, activeColorStr);

        if (legalMoves.length === 0) {
          if (checkInt(b, maximizing ? color : color ^ COLOR_MASK)) {
            const score = maximizing ? -MATE_SCORE + (maxDepth - d) : MATE_SCORE - (maxDepth - d);
            return { score, bestMove: null };
          }
          return { score: 0, bestMove: null };
        }

        const ordered = orderMoves(legalMoves, b, ttBest, killers[d] || [null, null], history);
        let bestMove: Move | null = null;
        let bestScore = maximizing ? -INFINITY : INFINITY;
        let flag: 'exact' | 'lower' | 'upper' = 'upper';

        if (maximizing) {
          for (const move of ordered) {
            const undo = makeMoveInt(b, move);
            const result = search(b, d - 1, alpha, beta, false);
            undoMoveInt(b, undo);
            if (result.score > bestScore) { bestScore = result.score; bestMove = result.bestMove || move; }
            alpha = Math.max(alpha, result.score);
            if (beta <= alpha) {
              flag = 'lower';
              if (b[move.to] === PIECE_NONE) {
                const k = killers[d];
                if (k && !(k[0] && k[0].from === move.from && k[0].to === move.to)) {
                  k[1] = k[0]; k[0] = move;
                }
                history[move.from * 81 + move.to] += d * d;
              }
              break;
            }
          }
          if (bestScore > alpha) flag = 'exact';
        } else {
          for (const move of ordered) {
            const undo = makeMoveInt(b, move);
            const result = search(b, d - 1, alpha, beta, true);
            undoMoveInt(b, undo);
            if (result.score < bestScore) { bestScore = result.score; bestMove = result.bestMove || move; }
            beta = Math.min(beta, result.score);
            if (beta <= alpha) {
              flag = 'upper';
              if (b[move.to] === PIECE_NONE) {
                const k = killers[d];
                if (k && !(k[0] && k[0].from === move.from && k[0].to === move.to)) {
                  k[1] = k[0]; k[0] = move;
                }
                history[move.from * 81 + move.to] += d * d;
              }
              break;
            }
          }
          if (bestScore < beta) flag = 'exact';
        }

        tt.store(hash, d, bestScore, flag, bestMove);
        return { score: bestScore, bestMove };
      }

      // Iterative Deepening with Aspiration Windows
      let bestResult: { score: number; bestMove: Move | null } = { score: 0, bestMove: null };

      for (let d = 1; d <= maxDepth; d++) {
        if (performance.now() - start > MAX_SEARCH_TIME * 0.8) break;

        let prevScore = d === 1 ? 0 : bestResult.score;
        if (Math.abs(prevScore) > MATE_SCORE - 200) prevScore = 0;

        let a = prevScore - ASPIRATION_WINDOW;
        let be = prevScore + ASPIRATION_WINDOW;
        let result = search(board, d, a, be, true);

        if (result.score <= a) {
          a = prevScore - ASPIRATION_WINDOW * 10;
          if (a < -INFINITY + 100) a = -INFINITY + 100;
          result = search(board, d, a, be, true);
        } else if (result.score >= be) {
          be = prevScore + ASPIRATION_WINDOW * 10;
          if (be > INFINITY - 100) be = INFINITY - 100;
          result = search(board, d, a, be, true);
        }

        if (performance.now() - start <= MAX_SEARCH_TIME) bestResult = result;
        if (Math.abs(result.score) > MATE_SCORE - 100) break;
      }

      return { move: bestResult.bestMove, score: bestResult.score, nodes, depth: maxDepth };
    }
  };
}
