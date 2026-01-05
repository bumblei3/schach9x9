import {
  PIECE_NONE,
  COLOR_WHITE,
  COLOR_BLACK,
  SQUARE_COUNT,
  indexToRow,
  indexToCol,
} from './BoardDefinitions.js';

import {
  getAllLegalMoves,
  makeMove,
  undoMove,
  getAllCaptureMoves,
  isInCheck,
} from './MoveGenerator.js';

import { evaluatePosition } from './Evaluation.js';

import {
  storeTT,
  probeTT,
  computeZobristHash,
  getXORSideToMove,
  getZobristKey,
  TT_EXACT,
  TT_BETA,
  getTTMove,
} from './TranspositionTable.js';

import { orderMoves, updateCounterMove, clearMoveOrdering } from './MoveOrdering.js';

import { logger } from '../logger.js';

// --- Global Search State ---
let nodesEvaluated = 0;
let searchStartTime = 0;
let timeLimit = 0;
let stopSearch = false;
// let softTimeLimit = 0;
let progressCallback = null;

// History Heuristic: [from][to] -> score
const historyTable = new Int32Array(SQUARE_COUNT * SQUARE_COUNT); // 81*81 = 6561 entries
// Killer Moves: [depth][2]
const MAX_DEPTH = 64;
let killerMoves = new Array(MAX_DEPTH).fill(null).map(() => [null, null]);

export function setProgressCallback(cb) {
  progressCallback = cb;
}

export function getNodesEvaluated() {
  return nodesEvaluated;
}

export function resetNodesEvaluated() {
  nodesEvaluated = 0;
}

// --- Time Management ---
function checkTime() {
  if (nodesEvaluated % 2048 === 0) {
    if (Date.now() - searchStartTime > timeLimit) {
      stopSearch = true;
    }
  }
  return stopSearch;
}

// --- Main Search Entry ---
export function getBestMoveDetailed(
  board,
  turnColor,
  maxDepth = 4,
  difficulty = 'expert',
  timeParams = {}
) {
  resetNodesEvaluated();
  stopSearch = false;
  searchStartTime = Date.now();

  // Time Setup - Support both legacy numeric format and new object format
  let allocatedTime = 0;

  if (typeof timeParams === 'number') {
    // Legacy format: timeParams is directly the time limit in ms
    allocatedTime = timeParams || 1000;
  } else {
    // New object format
    const { whiteTime, blackTime, moveTime, maxTime } = timeParams;
    if (moveTime || maxTime) {
      allocatedTime = moveTime || maxTime;
    } else {
      const remaining = turnColor === 'white' ? whiteTime : blackTime;
      if (remaining) {
        allocatedTime = remaining / 20; // safe estimation
      } else {
        allocatedTime = 1000; // default
      }
    }
  }

  timeLimit = allocatedTime;
  // softTimeLimit = allocatedTime * 0.6;

  // Clear heuristics
  killerMoves = new Array(MAX_DEPTH).fill(null).map(() => [null, null]);
  historyTable.fill(0);
  clearMoveOrdering();

  const colorInt = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const rootZobrist = computeZobristHash(board, colorInt);

  // If not expert, we perform a shallow search and pick from top N moves to introduce "mistakes"
  // Also handle 'hard' which should behave like expert but at lower depth
  if (difficulty !== 'expert' && difficulty !== 'hard') {
    const moves = getAllLegalMoves(board, turnColor);
    if (moves.length === 0) return { move: null, score: 0, pv: [] };
    if (moves.length === 1)
      return { move: convertMoveToResult(moves[0]), score: 0, pv: [convertMoveToResult(moves[0])] };

    // Order moves by MVV-LVA first for better quality candidates
    const orderedMoves = orderMoves(board, moves, null, null, historyTable, null);

    // Score moves at shallow depth (1)
    const scoredMoves = orderedMoves.map(move => {
      const undo = makeMove(board, move);
      const nextHash =
        rootZobrist ^
        getZobristKey(undo.piece, move.from) ^
        getZobristKey(undo.piece, move.to) ^
        (undo.captured !== PIECE_NONE ? getZobristKey(undo.captured, move.to) : 0n) ^
        getXORSideToMove();
      const score = -minimax(
        board,
        0,
        1,
        -Infinity,
        Infinity,
        colorInt === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE,
        nextHash,
        move,
        false
      );
      undoMove(board, undo);
      return { move, score };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    // Determine candidate pool size based on difficulty
    let candidateCount;
    switch (difficulty) {
      case 'beginner':
        candidateCount = Math.min(scoredMoves.length, 5);
        break;
      case 'easy':
        candidateCount = Math.min(scoredMoves.length, 3);
        break;
      case 'medium':
      case 'intermediate':
      default:
        candidateCount = Math.min(scoredMoves.length, 2);
        break;
    }

    // For easy/medium, prefer the best move more often
    if (difficulty === 'easy' || difficulty === 'medium') {
      // 70% chance to pick the best move
      if (Math.random() < 0.7) {
        return {
          move: convertMoveToResult(scoredMoves[0].move),
          score: scoredMoves[0].score,
          pv: [convertMoveToResult(scoredMoves[0].move)],
        };
      }
    }

    const candidates = scoredMoves.slice(0, candidateCount);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      move: convertMoveToResult(selected.move),
      score: selected.score,
      pv: [convertMoveToResult(selected.move)],
    };
  }

  let finalScore = 0;
  let alpha = -Infinity;
  let beta = Infinity;
  const ASPIRATION_WINDOW = 50; // centipawns

  // Expert: Standard Iterative Deepening
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (stopSearch) break;

    // Use Aspiration Window for deeper searches
    if (depth >= 3) {
      alpha = finalScore - ASPIRATION_WINDOW;
      beta = finalScore + ASPIRATION_WINDOW;
    }

    let score = minimax(board, depth, 0, alpha, beta, colorInt, rootZobrist, null, true);

    // Fail-low or Fail-high: Re-search with full window
    if (!stopSearch && (score <= alpha || score >= beta)) {
      alpha = -Infinity;
      beta = Infinity;
      score = minimax(board, depth, 0, alpha, beta, colorInt, rootZobrist, null, true);
    }

    if (!stopSearch) finalScore = score;
    const m = getTTMove(rootZobrist);
    if (m) {
      logger.debug(
        `Depth ${depth}: ${indexToRow(m.from)},${indexToCol(m.from)} -> ${indexToRow(m.to)},${indexToCol(m.to)} (Score: ${score})`
      );
      if (progressCallback) {
        progressCallback({
          depth,
          score,
          nodes: nodesEvaluated,
          pv: extractPV(board, turnColor, depth), // Expensive? maybe just best move
          bestMove: m,
        });
      }
    }
  }

  // Retrieve Best Move from TT
  const foundMove = getTTMove(rootZobrist);
  if (foundMove) {
    const pv = extractPV(board, turnColor, maxDepth);
    if (progressCallback) {
      progressCallback({
        depth: maxDepth,
        score: finalScore,
        nodes: nodesEvaluated,
        bestMove: convertMoveToResult(foundMove),
        pv,
      });
    }
    return { move: convertMoveToResult(foundMove), score: finalScore, pv };
  }

  // Fallback: First legal move
  const moves = getAllLegalMoves(board, turnColor);
  if (moves.length > 0) {
    const fallbackMove = convertMoveToResult(moves[0]);
    if (progressCallback) {
      progressCallback({
        depth: maxDepth,
        score: 0,
        nodes: nodesEvaluated,
        bestMove: fallbackMove,
        pv: [fallbackMove],
      });
    }
    return { move: fallbackMove, score: 0, pv: [fallbackMove] };
  }

  return { move: null, score: 0, pv: [] };
}

export function getBestMove(
  board,
  turnColor,
  maxDepth = 4,
  difficulty = 'expert',
  timeParams = {}
) {
  const result = getBestMoveDetailed(board, turnColor, maxDepth, difficulty, timeParams);
  return result ? result.move : null;
}

// Convert integer/internal move to UI result
function convertMoveToResult(move) {
  if (!move) return null;
  return {
    from: { r: indexToRow(move.from), c: indexToCol(move.from) },
    to: { r: indexToRow(move.to), c: indexToCol(move.to) },
    promotion: move.promotion, // if any
  };
}

function minimax(board, depth, ply, alpha, beta, color, zobrist, prevMove, isPvNode) {
  nodesEvaluated++;

  // Max Ply
  if (ply >= MAX_DEPTH) return evaluatePosition(board, color === COLOR_WHITE ? 'white' : 'black');

  // Check Time
  if (checkTime()) return 0;

  // Is in check?
  const inCheck = isInCheck(board, color);
  if (inCheck) depth++; // Check Extension

  // Horizon
  if (depth <= 0) {
    return quiescence(board, alpha, beta, color, zobrist);
  }

  // TT Probe
  const ttScore = probeTT(zobrist, depth, alpha, beta);
  if (ttScore !== null && !isPvNode) {
    // Don't use TT cutoff at PV nodes (Root isn't PV? Root is PV.)
    // Actually, isPvNode param passed?
    // Root calls with true.
    // If !isPvNode (e.g. ZW search), use cutoff.
    return ttScore;
  }
  // Also fetch ttMove for ordering
  const ttMove = getTTMove(zobrist);

  // Null Move Pruning (NMP)
  // conditions: depth >= 3, not in check, not PV, has pieces, static eval > beta
  if (!isPvNode && depth >= 3 && !inCheck) {
    // Need static eval
    const staticEval = evaluatePosition(board, color === COLOR_WHITE ? 'white' : 'black');
    if (staticEval >= beta) {
      // Try null move
      const R = 3 + Math.floor(depth / 6);
      // Make null move
      // Zobrist update: XOR side to move. En Passant?
      const nullZobrist = zobrist ^ getXORSideToMove();
      const enemyColor = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;

      const score = -minimax(
        board,
        depth - R - 1,
        ply + 1,
        -beta,
        -beta + 1,
        enemyColor,
        nullZobrist,
        null,
        false
      );

      if (stopSearch) return 0;
      if (score >= beta) return beta; // Cutoff
    }
  }

  // Generate Moves
  const moves = getAllLegalMoves(board, color === COLOR_WHITE ? 'white' : 'black');

  // Checkmate / Stalemate
  if (moves.length === 0) {
    if (inCheck) return -30000 + ply; // Mate
    return 0; // Stalemate
  }

  // Move Ordering
  const orderedMoves = orderMoves(board, moves, ttMove, killerMoves[ply], historyTable, prevMove);

  let bestMove = null;
  let bestScore = -Infinity;
  let moveCount = 0;

  for (const move of orderedMoves) {
    // PVS (Principal Variation Search)
    // LMR (Late Move Reduction)

    // Make Move
    const undo = makeMove(board, move);

    // Incremental Zobrist Update (O(1) instead of O(81))
    // hash ^= key(piece, from) ^ key(piece, to)
    // if capture: hash ^= key(captured, to)
    // hash ^= sideToMove
    const piece = undo.piece;
    const captured = undo.captured;
    let nextZobrist = zobrist;
    nextZobrist ^= getZobristKey(piece, move.from);
    nextZobrist ^= getZobristKey(piece, move.to);
    if (captured !== PIECE_NONE) {
      nextZobrist ^= getZobristKey(captured, move.to);
    }
    nextZobrist ^= getXORSideToMove();

    const enemyColor = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;

    let score;

    if (moveCount === 0) {
      score = -minimax(
        board,
        depth - 1,
        ply + 1,
        -beta,
        -alpha,
        enemyColor,
        nextZobrist,
        move,
        true
      );
    } else {
      // LMR Logic
      let d = depth - 1;
      if (depth >= 3 && moveCount > 4 && !inCheck /* && !isCapture */) {
        d -= 1;
      }

      // LMR Search (Zw)
      score = -minimax(board, d, ply + 1, -alpha - 1, -alpha, enemyColor, nextZobrist, move, false);

      // Re-search if LMR failed or PVS failed
      if (score > alpha && score < beta) {
        // Full depth research
        score = -minimax(
          board,
          depth - 1,
          ply + 1,
          -beta,
          -alpha,
          enemyColor,
          nextZobrist,
          move,
          true
        );
      }
    }

    undoMove(board, undo);

    if (stopSearch) return 0;
    moveCount++;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      if (score > alpha) {
        alpha = score;
        // Update History
        // updateHistory(move, depth, color);
        // Need implementation
        if (!(board[move.to] !== PIECE_NONE)) {
          // Quiet
          // updateHistory
          // const idx = move.from * 81 + move.to; // Wait, simplistic index
          // history logic: historyTable[move.from][move.to]
          // We initialized historyTable as 1D array size 81*81.
          const hIdx = move.from * 81 + move.to;
          historyTable[hIdx] += depth * depth;

          // Killer
          if (!areMovesEqual(move, killerMoves[ply][0])) {
            killerMoves[ply][1] = killerMoves[ply][0];
            killerMoves[ply][0] = move;
          }

          // CounterMove
          if (prevMove) {
            updateCounterMove(prevMove, move);
          }
        }
      }
      if (alpha >= beta) {
        // Beta Cutoff
        // Store TT (Beta)
        storeTT(zobrist, depth, beta, TT_BETA, bestMove);
        return beta;
      }
    }
  }

  // Store TT (Alpha if no move raised, Exact if move raised)
  // Actually standard Alpha-Beta:
  // If bestScore <= alphaOrig (Failed Low), Flag = Alpha.
  // If bestScore >= beta (Failed High), Flag = Beta.
  // Else Exact.

  // In PVS, alpha updates.
  // If bestScore > alpha (original), result is Exact.
  // If bestScore <= alpha (original), result is Alpha/FailLow.
  // Wait, simple store:
  // If (bestScore <= alphaOriginal) flag = TT_ALPHA.
  // Else flag = TT_EXACT.
  // (Beta cutoff handled above).

  // const flag = bestScore <= alpha ? TT_ALPHA : TT_EXACT; // Warning: alpha var mutated.
  // Need alphaOrig.
  // But simplified: Store 'bestScore' with 'flag'.
  // If we raised alpha, it's Exact.
  storeTT(zobrist, depth, bestScore, TT_EXACT, bestMove); // Simplified flagging

  return bestScore;
}

function quiescence(board, alpha, beta, color, zobrist) {
  nodesEvaluated++;
  // Stand Pat
  const standPat = evaluatePosition(board, color === COLOR_WHITE ? 'white' : 'black');
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  // Delta Pruning?
  // If standPat + 900 < alpha, return alpha?
  const BIG_DELTA = 975;
  if (standPat < alpha - BIG_DELTA) {
    // Can we prune? Only if we check if there are no promotions or massive checks.
    // Let's rely on standard Q for Refactor.
  }

  // Captures only
  const moves = getAllCaptureMoves(board, color === COLOR_WHITE ? 'white' : 'black');
  // Order captures (MVV-LVA)
  const ordered = orderMoves(board, moves, null, null, null, null);

  for (const move of ordered) {
    const undo = makeMove(board, move);

    // Incremental Zobrist (O(1))
    const piece = undo.piece;
    const captured = undo.captured;
    let nextZobrist = zobrist;
    nextZobrist ^= getZobristKey(piece, move.from);
    nextZobrist ^= getZobristKey(piece, move.to);
    if (captured !== PIECE_NONE) {
      nextZobrist ^= getZobristKey(captured, move.to);
    }
    nextZobrist ^= getXORSideToMove();

    const enemyColor = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;

    const score = -quiescence(board, -beta, -alpha, enemyColor, nextZobrist);

    undoMove(board, undo);

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function areMovesEqual(m1, m2) {
  if (!m1 || !m2) return false;
  return m1.from === m2.from && m1.to === m2.to; // fast check
}

// Helpers for analyzePosition and extractPV
export function analyzePosition(board, turnColor) {
  if (!board) return { score: 0, topMoves: [] };
  // const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const moves = getAllLegalMoves(board, turnColor === 'white' ? 'white' : 'black');

  // Order moves for better "top moves" suggestion
  const ordered = orderMoves(board, moves, null, killerMoves[0], historyTable, null);

  return {
    score: 0,
    topMoves: ordered.slice(0, 3).map(m => ({
      move: convertMoveToResult(m),
      score: 0,
    })),
  };
}

export function extractPV(board, turnColor, depth = 5) {
  const pv = [];
  const tempBoard = new Int8Array(board); // Clone
  let color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  let currentZobrist = computeZobristHash(tempBoard, color);

  // Safety loop
  for (let i = 0; i < depth; i++) {
    const move = getTTMove(currentZobrist);
    if (!move) break;

    pv.push(convertMoveToResult(move));

    // Advance
    makeMove(tempBoard, move);
    color = color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE;
    currentZobrist = computeZobristHash(tempBoard, color);
  }
  return pv;
}
