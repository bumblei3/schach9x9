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
import { progressCallback, type AIProgressData } from './aiEngine';
import type { IntBoard } from './evaluate';

// =====================================================================
// Search constants
// =====================================================================
const MATE_SCORE = 20000;
const INFINITY = 30000;
const MAX_SEARCH_TIME = 3000; // 3 seconds max per search (was 8s)

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
// Probcut (Probabilistic Cut-off) - ~15-20% node reduction
// =====================================================================
// Probcut tries a shallow search with a reduced beta bound to prove
// the current move fails high before doing a full-depth search.
// Only applied when depth >= PROBCUT_DEPTH and score is near beta.

const PROBCUT_DEPTH = 5;
const PROBCUT_REDUCTION = 3;           // How much to reduce depth
const PROBCUT_BETA_MARGIN = 150;       // Beta margin for probcut (beta - margin)

function probcut(
  b: IntBoard,
  d: number,
  beta: number,
  maximizing: boolean,
  start: number,
  nodes: { count: number }
): boolean {
  // Only apply probcut at sufficient depth
  if (d < PROBCUT_DEPTH) return false;
  
  // Don't probcut if in check (forced moves need full search)
  const activeColor = maximizing ? color : color ^ COLOR_MASK;
  if (checkInt(b, activeColor)) return false;
  
  // Probcut beta is stricter than normal beta
  const probcutBeta = beta - PROBCUT_BETA_MARGIN;
  if (probcutBeta < -INFINITY) return false;
  
  // Generate captures and promotions only for probcut
  const activeColorStr = activeColor === COLOR_WHITE ? 'white' : 'black';
  const legalMoves = genLegalInt(b, activeColorStr);
  
  // Filter: only captures, promotions, and TT-move likely to cause cutoffs
  const probcutMoves = legalMoves.filter(m => 
    b[m.to] !== PIECE_NONE || (m.promotion !== undefined)
  );
  
  if (probcutMoves.length === 0) return false;
  
  // Order by capture value (MVV-LVA)
  probcutMoves.sort((a, b) => {
    const victimA = b[a.to] & TYPE_MASK;
    const victimB = b[b.to] & TYPE_MASK;
    const valA = EVAL_VALUES[victimA] || 0;
    const valB = EVAL_VALUES[victimB] || 0;
    return valB - valA;
  });
  
  // Try probcut on top few moves
  const maxTries = Math.min(probcutMoves.length, 3);
  for (let i = 0; i < maxTries; i++) {
    const move = probcutMoves[i];
    const undo = makeMoveInt(b, move);
    nodes.count++;
    if (nodes.count % 1000 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
      undoMoveInt(b, undo);
      return false;
    }
    
    // Reduced depth search with null window
    const result = search(b, d - 1 - PROBCUT_REDUCTION, probcutBeta - 1, probcutBeta, !maximizing);
    undoMoveInt(b, undo);
    
    // If reduced search returns >= probcutBeta, we cut off
    if (result.score >= probcutBeta) return true;
  }
  
  return false;
}

// =====================================================================
// Singular Extensions - Extend search for forced/singular moves
// =====================================================================
// A singular move is one where all alternatives fail significantly
// lower than the best move. We search it one ply deeper.

const SINGULAR_DEPTH = 6;           // Minimum depth for singular extensions
const SINGULAR_MARGIN = 100;        // Margin to consider move singular

function isSingularMove(
  b: IntBoard,
  d: number,
  bestMove: Move,
  bestScore: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  start: number,
  nodes: { count: number }
): boolean {
  if (d < SINGULAR_DEPTH) return false;
  if (!bestMove) return false;
  
  // Don't extend in check (already forced)
  const activeColor = maximizing ? color : color ^ COLOR_MASK;
  if (checkInt(b, activeColor)) return false;
  
  // Search all other moves with reduced depth and tight bounds
  // around bestScore to verify no alternative is close
  const activeColorStr = activeColor === COLOR_WHITE ? 'white' : 'black';
  const legalMoves = genLegalInt(b, activeColorStr);
  
  for (const move of legalMoves) {
    // Skip the best move
    if (move.from === bestMove.from && move.to === bestMove.to) continue;
    
    const undo = makeMoveInt(b, move);
    nodes.count++;
    if (nodes.count % 1000 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
      undoMoveInt(b, undo);
      return false;
    }
    
    // Search with reduced depth and tight window
    const margin = SINGULAR_MARGIN;
    const singularAlpha = bestScore - margin;
    const singularBeta = bestScore + margin;
    
    const result = search(b, d - 1 - 2, singularAlpha, singularBeta, !maximizing);
    undoMoveInt(b, undo);
    
    // If any alternative is within margin, the move is NOT singular
    if (maximizing) {
      if (result.score >= singularAlpha) return false;
    } else {
      if (result.score <= singularBeta) return false;
    }
  }
  
  return true;
}

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

      // Late Move Reductions (LMR) constants
      const LMR_BASE_DEPTH = 3;        // Minimum depth for LMR
      const LMR_MOVE_COUNT = 3;        // First N moves not reduced
      const LMR_MAX_REDUCTION = 3;     // Max reduction

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

        // Track if we're in check (for LMR condition)
        const inCheck = checkInt(b, maximizing ? color : color ^ COLOR_MASK);

        // --- Probcut (before move loop, for both sides) ---
        let probcutCutoff = false;
        if (d >= PROBCUT_DEPTH && !inCheck) {
          if (probcut(b, d, beta, maximizing, start, { count: nodes })) {
            probcutCutoff = true;
          }
        }

        if (!probcutCutoff) {
          if (maximizing) {
            let movesSearched = 0;
            for (const move of ordered) {
              movesSearched++;

              // --- Late Move Reductions (LMR) ---
              let reduction = 0;
              const isCapture = b[move.to] !== PIECE_NONE;
              const isPromotion = move.promotion !== undefined;
              const isTTMove = ttBest && move.from === ttBest.from && move.to === ttBest.to;

              // Conditions for LMR: depth >= 3, not first few moves, not capture, not promotion, not TT move, not in check
              if (
                d >= LMR_BASE_DEPTH &&
                movesSearched > LMR_MOVE_COUNT &&
                !isCapture &&
                !isPromotion &&
                !isTTMove &&
                !inCheck
              ) {
                // Standard LMR formula: reduction = log(depth) * log(movesSearched) / scale
                const depthLog = Math.log(d);
                const moveLog = Math.log(movesSearched);
                reduction = Math.min(LMR_MAX_REDUCTION, Math.floor(depthLog * moveLog / 1.75));
                reduction = Math.max(1, reduction); // At least 1 ply reduction
              }

              const undo = makeMoveInt(b, move);
              let result: { score: number; bestMove: Move | null };

              if (reduction > 0) {
                // Reduced search first
                result = search(b, d - 1 - reduction, alpha, beta, false);

                // If reduced search fails high (>= beta), re-search at full depth
                if (result.score >= beta) {
                  result = search(b, d - 1, alpha, beta, false);
                }
              } else {
                // Full depth search
                result = search(b, d - 1, alpha, beta, false);
              }

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

            // --- Singular Extension (after finding best move) ---
            if (d >= SINGULAR_DEPTH && bestMove && !inCheck) {
              if (isSingularMove(b, d, bestMove, bestScore, alpha, beta, maximizing, start, { count: nodes })) {
                // Re-search best move with depth + 1
                const undo = makeMoveInt(b, bestMove);
                const extResult = search(b, d, alpha, beta, false);
                undoMoveInt(b, undo);
                // If extension improves score, use it
                if (extResult.score > bestScore) {
                  bestScore = extResult.score;
                  bestMove = extResult.bestMove || bestMove;
                }
              }
            }

          } else {
            let movesSearched = 0;
            for (const move of ordered) {
              movesSearched++;

              // --- Late Move Reductions (LMR) ---
              let reduction = 0;
              const isCapture = b[move.to] !== PIECE_NONE;
              const isPromotion = move.promotion !== undefined;
              const isTTMove = ttBest && move.from === ttBest.from && move.to === ttBest.to;

              // Conditions for LMR: depth >= 3, not first few moves, not capture, not promotion, not TT move, not in check
              if (
                d >= LMR_BASE_DEPTH &&
                movesSearched > LMR_MOVE_COUNT &&
                !isCapture &&
                !isPromotion &&
                !isTTMove &&
                !inCheck
              ) {
                const depthLog = Math.log(d);
                const moveLog = Math.log(movesSearched);
                reduction = Math.min(LMR_MAX_REDUCTION, Math.floor(depthLog * moveLog / 1.75));
                reduction = Math.max(1, reduction);
              }

              const undo = makeMoveInt(b, move);
              let result: { score: number; bestMove: Move | null };

              if (reduction > 0) {
                // Reduced search first
                result = search(b, d - 1 - reduction, alpha, beta, true);

                // If reduced search fails high (>= beta), re-search at full depth
                if (result.score >= beta) {
                  result = search(b, d - 1, alpha, beta, true);
                }
              } else {
                // Full depth search
                result = search(b, d - 1, alpha, beta, true);
              }

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

            // --- Singular Extension (after finding best move) ---
            if (d >= SINGULAR_DEPTH && bestMove && !inCheck) {
              if (isSingularMove(b, d, bestMove, bestScore, alpha, beta, maximizing, start, { count: nodes })) {
                // Re-search best move with depth + 1
                const undo = makeMoveInt(b, bestMove);
                const extResult = search(b, d, alpha, beta, true);
                undoMoveInt(b, undo);
                if (extResult.score < bestScore) {
                  bestScore = extResult.score;
                  bestMove = extResult.bestMove || bestMove;
                }
              }
            }
          }
        } // end of move loop

        tt.store(hash, d, bestScore, flag, bestMove);
        return { score: bestScore, bestMove };
        }


      // Iterative Deepening with Aspiration Windows + Internal Iterative Reduction (IIR)
      let bestResult: { score: number; bestMove: Move | null } = { score: 0, bestMove: null };
      
      // IIR State tracking
      const lastScores: number[] = [];
      const IIR_WINDOW = 3;           // Number of iterations to track for stability
      const IIR_STABILITY_THRESHOLD = 50; // Score delta considered "stable" (centipawns)
      let iirStableCount = 0;
      let iirUnstableCount = 0;

      for (let d = 1; d <= maxDepth; d++) {
        if (performance.now() - start > MAX_SEARCH_TIME * 0.8) break;

        let prevScore = d === 1 ? 0 : bestResult.score;
        if (Math.abs(prevScore) > MATE_SCORE - 200) prevScore = 0;

        // --- Internal Iterative Reduction (IIR) ---
        // Adjust aspiration window based on score stability
        let aspirationMult = 1;
        if (lastScores.length >= 2) {
          const delta = Math.abs(lastScores[lastScores.length - 1] - lastScores[lastScores.length - 2]);
          if (delta <= IIR_STABILITY_THRESHOLD) {
            iirStableCount++;
            iirUnstableCount = 0;
            // Stable: tighten aspiration window for efficiency
            if (iirStableCount >= 2) aspirationMult = 0.5;
          } else {
            iirUnstableCount++;
            iirStableCount = 0;
            // Unstable: widen aspiration window to avoid re-searches
            if (iirUnstableCount >= 1) aspirationMult = 2.0;
          }
        }

        let a = prevScore - ASPIRATION_WINDOW * aspirationMult;
        let be = prevScore + ASPIRATION_WINDOW * aspirationMult;
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

        // Track scores for IIR
        lastScores.push(result.score);
        if (lastScores.length > IIR_WINDOW) lastScores.shift();

        // IIR: Skip depth if score is extremely stable (diminishing returns)
        // Only skip if we have enough data and time permits next depth
        const shouldSkipDepth = d >= 4 && 
          lastScores.length >= 3 &&
          Math.abs(lastScores[lastScores.length - 1] - lastScores[lastScores.length - 2]) < 10 &&
          Math.abs(lastScores[lastScores.length - 2] - lastScores[lastScores.length - 3]) < 10 &&
          (performance.now() - start) < MAX_SEARCH_TIME * 0.5;

        if (performance.now() - start <= MAX_SEARCH_TIME) bestResult = result;

        // Report progress at each depth iteration
        if (progressCallback) {
          progressCallback({
            depth: d,
            nodes,
            time: performance.now() - start,
            score: result.score,
            pv: result.bestMove ? `${result.bestMove.from}-${result.bestMove.to}` : undefined,
          } as AIProgressData);
        }

        if (Math.abs(result.score) > MATE_SCORE - 100) break;
        
        // Optional: Early exit if IIR suggests depth increase won't help
        if (shouldSkipDepth && d + 1 <= maxDepth) {
          // Still do one more iteration for safety, but could break here
        }
      }

      return { move: bestResult.bestMove, score: bestResult.score, nodes, depth: maxDepth };
    }
  };
}
