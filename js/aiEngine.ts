/**
 * Core AI Logic for Schach 9x9 (Bridge Layer)
 * Converts UI Objects to Integer Board for the optimized AI Engine.
 */

import { logger } from './logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import {
  getBestMoveWasm,
  getWasmNodesEvaluated,
  resetWasmNodesEvaluated,
} from './ai/wasmBridge.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { setOpeningBook, queryOpeningBook } from './ai/OpeningBook.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import {
  getAllLegalMoves as genLegalInt,
  makeMove as makeMoveInt,
  undoMove as undoMoveInt,
  getAllCaptureMoves,
  isInCheck as checkInt,
  isSquareAttacked as isSquareAttackedInt,
  findKing as findKingInt,
  see as seeInt,
  type Move,
} from './ai/MoveGenerator.js';

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
  COLOR_WHITE,
  COLOR_BLACK,
  TYPE_MASK,
  indexToRow,
  indexToCol,
  coordsToIndex,
  COLOR_MASK,
} from './ai/BoardDefinitions.js';
import { getCurrentBoardShape } from './config.js';

import type { Player, Square, Piece } from './types/game.js';

// --- Types ---

export interface EloParams {
  maxDepth: number;
  elo: number;
  personality?: string;
}

export interface TimeParams {
  elo?: number;
  personality?: string;
  maxDepth?: number;
}

export interface MoveResult {
  from: Square;
  to: Square;
  promotion?: string;
  capture?: boolean;
  score?: number;
}

export interface SearchResult {
  move: MoveResult | null;
  score: number;
  depth?: number;
  nodes?: number;
  pv?: MoveResult[];
}

export interface UndoInfo {
  move: { from: Square; to: Square };
  captured: Piece | null;
  oldHasMoved?: boolean;
}

type UiBoard = (Piece | null)[][];
type IntBoard = Int8Array;

// --- Conversion Helpers ---

const TYPE_MAP_TO_INT: Record<string, number> = {
  p: PIECE_PAWN,
  n: PIECE_KNIGHT,
  b: PIECE_BISHOP,
  r: PIECE_ROOK,
  q: PIECE_QUEEN,
  k: PIECE_KING,
  a: PIECE_ARCHBISHOP,
  c: PIECE_CHANCELLOR,
  e: PIECE_ANGEL,
};

const TYPE_INT_TO_STR: Record<number, string> = {
  [PIECE_PAWN]: 'p',
  [PIECE_KNIGHT]: 'n',
  [PIECE_BISHOP]: 'b',
  [PIECE_ROOK]: 'r',
  [PIECE_QUEEN]: 'q',
  [PIECE_KING]: 'k',
  [PIECE_ARCHBISHOP]: 'a',
  [PIECE_CHANCELLOR]: 'c',
  [PIECE_ANGEL]: 'e',
};

export function convertBoardToInt(uiBoard: UiBoard | IntBoard): IntBoard {
  if (uiBoard instanceof Int8Array) return uiBoard;

  const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  const size = uiBoard.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const p = uiBoard[r][c];
      if (p) {
        const type = TYPE_MAP_TO_INT[p.type] || PIECE_NONE;
        const color = p.color === 'white' ? COLOR_WHITE : COLOR_BLACK;
        board[r * 9 + c] = (type | color) as number;
      }
    }
  }
  return board;
}

// --- Worker Management ---

let aiWorker: Worker | null = null;
const workerPendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
>();
let workerReqId = 0;

function initAiWorker(): void {
  if (aiWorker || typeof Worker === 'undefined') return;

  try {
    aiWorker = new Worker(new URL('./ai/aiWorker.ts', import.meta.url).href, { type: 'module' });
    aiWorker.onmessage = (e: MessageEvent) => {
      const { type, id, data, payload, error } = e.data;
      logger.debug(`[AiEngine] Received worker message: type=${type} id=${id}`);
      if (workerPendingRequests.has(id)) {
        const { resolve, reject } = workerPendingRequests.get(id)!;
        workerPendingRequests.delete(id);

        if (type === 'SEARCH_ERROR') reject(error);
        else if (type === 'bestMove') resolve(data);
        else if (type === 'topMoves') resolve(data);
        else resolve(payload);
      } else {
        logger.warn(`[AiEngine] Received worker message with unknown id: ${id}`);
      }
    };
    logger.info('[AiEngine] AI Worker initialized');
  } catch (err) {
    logger.error('[AiEngine] Failed to init AI Worker', err);
  }
}

export function terminateAiWorker(): void {
  if (aiWorker) {
    aiWorker.terminate();
    aiWorker = null;
    workerPendingRequests.forEach(({ reject }) => {
      reject(new Error('AI Worker terminated (request cancelled)'));
    });
    workerPendingRequests.clear();
    logger.info('[AiEngine] AI Worker terminated');
  }
}

function runWorkerSearch(
  board: IntBoard,
  turnColor: Player,
  depth: number,
  personality: string,
  elo: number
): Promise<SearchResult> {
  if (!aiWorker) initAiWorker();
  if (!aiWorker) throw new Error('Worker not available');

  return new Promise((resolve, reject) => {
    const id = workerReqId++;
    const timeoutDesc = setTimeout(() => {
      if (workerPendingRequests.has(id)) {
        workerPendingRequests.delete(id);
        reject(new Error('AI Worker timed out'));
      }
    }, 30000); // 30s timeout limit

    workerPendingRequests.set(id, {
      resolve: val => {
        clearTimeout(timeoutDesc);
        resolve(val as SearchResult);
      },
      reject: err => {
        clearTimeout(timeoutDesc);
        reject(err);
      },
    });
    aiWorker!.postMessage({
      type: 'getBestMove', // Use standard protocol
      id,
      data: { board, color: turnColor, depth, config: { personality, elo } }, // map payload to data
    });
  });
}

function runWorkerTopMoves(
  board: IntBoard,
  color: Player,
  count: number,
  depth: number,
  maxTimeMs: number
): Promise<SearchResult[]> {
  // If a request is already pending, terminate and restart to "cancel" the old search
  if (workerPendingRequests.size > 0) {
    logger.debug('[AiEngine] Terminating worker to cancel pending search');
    terminateAiWorker();
  }

  if (!aiWorker) initAiWorker();
  if (!aiWorker) throw new Error('Worker not available');

  return new Promise((resolve, reject) => {
    const id = workerReqId++;
    const timeoutDesc = setTimeout(() => {
      if (workerPendingRequests.has(id)) {
        workerPendingRequests.delete(id);
        reject(new Error('AI Worker TOP_MOVES timed out'));
      }
    }, 15000); // 15s is plenty for optimized topMoves

    workerPendingRequests.set(id, {
      resolve: val => {
        clearTimeout(timeoutDesc);
        resolve(val as SearchResult[]);
      },
      reject: err => {
        clearTimeout(timeoutDesc);
        reject(err);
      },
    });

    aiWorker!.postMessage({
      type: 'getTopMoves',
      id,
      data: { board, color, count, depth, maxTimeMs },
    });
  });
}

function convertMoveToResult(
  move: { from: number | Square; to: number | Square; promotion?: number | string } | null
): MoveResult | null {
  if (!move) return null;

  // If already converted (e.g. from worker result which was already processed)
  if (typeof move.from === 'object' && move.from !== null && 'r' in move.from) {
    return move as unknown as MoveResult;
  }

  // At this point from/to are guaranteed to be numbers
  const fromIdx = move.from as number;
  const toIdx = move.to as number;

  return {
    from: { r: indexToRow(fromIdx), c: indexToCol(fromIdx) },
    to: { r: indexToRow(toIdx), c: indexToCol(toIdx) },
    promotion:
      typeof move.promotion === 'number'
        ? TYPE_INT_TO_STR[move.promotion & TYPE_MASK]
        : move.promotion,
  };
}

// --- Bridge Functions ---

/**
 * Maps Elo rating to search parameters
 */
export function getParamsForElo(elo: number): EloParams {
  // With TT + Move Ordering + Iterative Deepening, higher depths are feasible
  let depth = 4;
  if (elo < 1000) depth = 3;
  else if (elo < 1400) depth = 4;
  else if (elo < 1800) depth = 5;
  else if (elo < 2200) depth = 6;
  else depth = 7;

  return {
    maxDepth: depth,
    elo: elo,
  };
}

export async function getBestMove(
  uiBoard: UiBoard,
  turnColor: Player,
  maxDepth: number = 4,
  _difficulty: string = 'expert',
  timeParams: TimeParams = {}
): Promise<MoveResult | null> {
  const result = await getBestMoveDetailed(uiBoard, turnColor, maxDepth, timeParams);
  if (!result || !result.move) return null;
  const move = result.move;
  move.score = result.score;
  return move;
}

export async function getBestMoveDetailed(
  uiBoard: UiBoard,
  turnColor: Player,
  maxDepth: number = 4,
  timeParams: TimeParams = {},
  moveNumber?: number
): Promise<SearchResult | null> {
  const board = convertBoardToInt(uiBoard);

  // --- Step 1: Check Opening Book ---
  if (moveNumber !== undefined && moveNumber < 15) {
    const bookMove = queryOpeningBook(uiBoard, moveNumber);
    if (bookMove) {
      logger.info(
        `[AiEngine] Opening Book Move Found: ${bookMove.from.r},${bookMove.from.c} -> ${bookMove.to.r},${bookMove.to.c}`
      );
      return {
        move: bookMove,
        score: 0,
        depth: 0,
        nodes: 0,
      };
    }
  }

  let config = timeParams;
  if (timeParams.elo) {
    const eloParams = getParamsForElo(timeParams.elo);
    config = { ...timeParams, ...eloParams };
    maxDepth = config.maxDepth!;
  }

  const personality = config.personality || 'NORMAL';
  const elo = config.elo || 2500;

  const boardShape = getCurrentBoardShape();

  // Use Worker if available (Browser) - ONLY for standard board shape
  // WASM doesn't support custom board shapes yet
  if (boardShape === 'standard' && typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    try {
      const result = await runWorkerSearch(board, turnColor, maxDepth, personality, elo);
      if (result && result.move) {
        logger.debug('[AiEngine] Using Wasm Worker Result');
        return {
          ...result,
          move: convertMoveToResult(
            result.move as unknown as { from: number; to: number; promotion?: number }
          ),
        };
      }
    } catch (err) {
      logger.error('[AiEngine] Worker search failed, falling back to main thread', err);
    }
  }

  // Fallback or Node.js environment - Try WASM first (only for standard board)
  if (boardShape === 'standard') {
    try {
      const wasmResult = await getBestMoveWasm(board, turnColor, maxDepth, personality, elo);
      if (wasmResult) {
        return wasmResult;
      }
    } catch (err) {
      logger.debug('[AiEngine] WASM fallback failed, using JS');
    }
  }

  logger.debug('[AiEngine] Using JS Fallback Search');
  // Run JS Search
  const jsResult = await runJsSearch(board, turnColor, maxDepth, elo);
  if (jsResult) {
    return {
      score: jsResult.score,
      move: convertMoveToResult(jsResult.move),
    };
  }

  return null;
}

// --- JS Fallback Search (Alpha-Beta with TT, Move Ordering, Iterative Deepening) ---

const MATE_SCORE = 20000;
const INFINITY = 30000;
const MAX_SEARCH_TIME = 8000; // 8 seconds max per search

interface JsSearchResult {
  move: Move | null;
  score: number;
  nodes: number;
  depth: number;
}

const EVAL_VALUES: Record<number, number> = {
  [PIECE_PAWN]: 100,
  [PIECE_KNIGHT]: 320,
  [PIECE_BISHOP]: 330,
  [PIECE_ROOK]: 500,
  [PIECE_QUEEN]: 900,
  [PIECE_KING]: 20000,
  [PIECE_ARCHBISHOP]: 650,
  [PIECE_CHANCELLOR]: 850,
  [PIECE_ANGEL]: 1220,
};

// Positional bonus tables (9x9 board, from white's perspective)
// Encourages centralization, pawn advancement, king safety
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  5,  5,  5,  5,  5,  5,  5,  5,  5,
  10, 10, 10, 10, 10, 10, 10, 10, 10,
  15, 15, 15, 15, 15, 15, 15, 15, 15,
  20, 20, 20, 20, 20, 20, 20, 20, 20,
  15, 15, 15, 15, 15, 15, 15, 15, 15,
  10, 10, 10, 10, 10, 10, 10, 10, 10,
  5,  5,  5,  5,  5,  5,  5,  5,  5,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0, 10, 10, 10, 10, 10, 10, 10,  0,
  0, 10, 20, 20, 20, 20, 20, 10,  0,
  0, 10, 20, 30, 30, 30, 20, 10,  0,
  0, 10, 20, 30, 40, 30, 20, 10,  0,
  0, 10, 20, 30, 30, 30, 20, 10,  0,
  0, 10, 20, 20, 20, 20, 20, 10,  0,
  0, 10, 10, 10, 10, 10, 10, 10,  0,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
];

const KING_MIDGAME_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  5,  5,  5,  5,  5,  0,  0,
  0,  0,  5, 10, 10, 10,  5,  0,  0,
  0,  0,  5, 10, 20, 10,  5,  0,  0,
];

// Transposition Table
interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMove: Move | null;
}

// Zobrist-like hash: simple board hash for TT lookup
function computeBoardHash(b: IntBoard): number {
  let h = 0;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    h = ((h << 5) - h + b[i]) | 0;
  }
  return h;
}

function evaluate(b: IntBoard, c: number): number {
  let score = 0;
  let totalMaterial = 0;

  for (let i = 0; i < SQUARE_COUNT; i++) {
    const p = b[i];
    if (p === PIECE_NONE) continue;

    const type = p & TYPE_MASK;
    const pColor = p & COLOR_MASK;
    const val = EVAL_VALUES[type] || 0;
    const row = indexToRow(i);
    const col = indexToCol(i);

    let positional = 0;
    if (type === PIECE_PAWN) {
      positional = PAWN_TABLE[pColor === c ? row * 9 + col : (8 - row) * 9 + col];
    } else if (type === PIECE_KNIGHT) {
      positional = KNIGHT_TABLE[pColor === c ? row * 9 + col : (8 - row) * 9 + col];
    } else if (type === PIECE_KING) {
      positional = KING_MIDGAME_TABLE[pColor === c ? row * 9 + col : (8 - row) * 9 + col];
    }

    const total = val + positional;
    totalMaterial += val;

    if (pColor === c) score += total;
    else score -= total;
  }

  return score;
}

// Quiescence search: only resolve captures to avoid horizon effect
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

  // Order captures by MVV-LVA
  captures.sort((a, mv) => {
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

// Move ordering for alpha-beta efficiency
function orderMoves(moves: Move[], b: IntBoard, ttBest: Move | null): Move[] {
  return moves
    .map(move => {
      let score = 0;

      // TT best move gets highest priority
      if (ttBest && move.from === ttBest.from && move.to === ttBest.to) {
        score += 1000000;
      }

      // MVV-LVA for captures
      const target = b[move.to];
      if (target !== PIECE_NONE) {
        const victimVal = EVAL_VALUES[target & TYPE_MASK] || 0;
        const attackerVal = EVAL_VALUES[b[move.from] & TYPE_MASK] || 0;
        score += 500000 + victimVal * 10 - attackerVal;
      }

      // Promotions
      if (move.promotion) {
        score += 400000;
      }

      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.move);
}

async function runJsSearch(
  board: IntBoard,
  turnColor: Player,
  maxDepth: number,
  _elo: number
): Promise<JsSearchResult> {
  const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const start = performance.now();
  let nodes = 0;
  const tt = new Map<number, TTEntry>();

  function search(b: IntBoard, d: number, alpha: number, beta: number, maximizing: boolean): { score: number; bestMove: Move | null } {
    nodes++;

    // Time check every 1000 nodes
    if (nodes % 1000 === 0 && performance.now() - start > MAX_SEARCH_TIME) {
      return { score: evaluate(b, color), bestMove: null };
    }

    const hash = computeBoardHash(b);
    const ttEntry = tt.get(hash);
    let ttBest: Move | null = null;

    if (ttEntry && ttEntry.depth >= d) {
      ttBest = ttEntry.bestMove;
      if (ttEntry.flag === 'exact') {
        return { score: ttEntry.score, bestMove: ttEntry.bestMove };
      }
      if (ttEntry.flag === 'lower' && ttEntry.score >= beta) {
        return { score: ttEntry.score, bestMove: ttEntry.bestMove };
      }
      if (ttEntry.flag === 'upper' && ttEntry.score <= alpha) {
        return { score: ttEntry.score, bestMove: ttEntry.bestMove };
      }
    }

    if (d === 0) {
      const qScore = quiesce(b, alpha, beta, color, start, { count: 0 });
      return { score: qScore, bestMove: null };
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

    const ordered = orderMoves(legalMoves, b, ttBest);
    let bestMove: Move | null = null;
    let bestScore = maximizing ? -INFINITY : INFINITY;
    let flag: 'exact' | 'lower' | 'upper' = 'upper';

    if (maximizing) {
      for (const move of ordered) {
        const undo = makeMoveInt(b, move);
        const result = search(b, d - 1, alpha, beta, false);
        undoMoveInt(b, undo);

        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = result.bestMove || move;
        }
        alpha = Math.max(alpha, result.score);
        if (beta <= alpha) {
          flag = 'lower';
          break;
        }
      }
      if (bestScore > alpha) flag = 'exact';
    } else {
      for (const move of ordered) {
        const undo = makeMoveInt(b, move);
        const result = search(b, d - 1, alpha, beta, true);
        undoMoveInt(b, undo);

        if (result.score < bestScore) {
          bestScore = result.score;
          bestMove = result.bestMove || move;
        }
        beta = Math.min(beta, result.score);
        if (beta <= alpha) {
          flag = 'upper';
          break;
        }
      }
      if (bestScore < beta) flag = 'exact';
    }

    // Store in TT
    tt.set(hash, { depth: d, score: bestScore, flag, bestMove });

    return { score: bestScore, bestMove };
  }

  // Iterative Deepening: search depth 1, 2, 3, ... until time runs out
  let bestResult: { score: number; bestMove: Move | null } = { score: 0, bestMove: null };

  for (let d = 1; d <= maxDepth; d++) {
    if (performance.now() - start > MAX_SEARCH_TIME * 0.8) break;

    const result = search(board, d, -INFINITY, INFINITY, true);

    // Only accept complete searches (not timed out at root)
    if (performance.now() - start <= MAX_SEARCH_TIME) {
      bestResult = result;
    }

    // If we found a mate, no need to search deeper
    if (Math.abs(result.score) > MATE_SCORE - 100) break;
  }

  return {
    move: bestResult.bestMove,
    score: bestResult.score,
    nodes,
    depth: maxDepth,
  };
}

/**
 * Returns the top N moves for the tutor, sorted by score
 * Uses quick JS pre-filtering then WASM for top candidates
 */
export async function getTopMoves(
  uiBoard: UiBoard,
  turnColor: Player,
  count: number = 3,
  searchDepth: number = 2,
  maxTimeMs: number = 5000,
  moveNumber?: number
): Promise<SearchResult[]> {
  const board = convertBoardToInt(uiBoard);

  // --- Step 1: Check Opening Book ---
  const bookMoves: SearchResult[] = [];
  if (moveNumber !== undefined && moveNumber < 15) {
    // Note: OpeningBook.ts getMove returns a single weighted random move,
    // though the book might have multiple. Currently we just take one if available.
    const bookMove = queryOpeningBook(uiBoard, moveNumber);
    if (bookMove) {
      bookMoves.push({
        move: bookMove,
        score: 50, // High enough to be at top but not "winning"
        depth: 0,
        nodes: 0,
      });
      // If we found a book move, we reduce the count we search for
      count = Math.max(1, count - 1);
    }
  }

  const boardShape = getCurrentBoardShape();

  // Use Worker if available (Browser) - ONLY for standard board shape
  if (boardShape === 'standard' && typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    try {
      return await runWorkerTopMoves(board, turnColor, count, searchDepth, maxTimeMs);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('request cancelled')) {
        logger.debug('[AiEngine] Worker getTopMoves cancelled (new request)');
      } else {
        logger.error('[AiEngine] Worker getTopMoves failed, falling back', err);
      }
    }
  }

  const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const startTime = performance.now();

  // Get all legal moves
  const legalMoves = genLegalInt(board, turnColor);
  if (legalMoves.length === 0) return [];

  // Quick JS evaluation for pre-filtering
  function quickEval(b: IntBoard): number {
    let score = 0;
    for (let i = 0; i < SQUARE_COUNT; i++) {
      const p = b[i];
      if (p !== PIECE_NONE) {
        const type = p & TYPE_MASK;
        const pColor = p & COLOR_MASK;
        const val = EVAL_VALUES[type] || 0;
        const row = Math.floor(i / 9);
        const col = i % 9;
        const centerBonus = 4 - Math.abs(row - 4) + (4 - Math.abs(col - 4));
        if (pColor === color) score += val + centerBonus * 5;
        else score -= val + centerBonus * 5;
      }
    }
    return score;
  }

  // Step 1: Quick pre-filter all moves with simple evaluation
  const quickScores: { move: Move; score: number }[] = [];
  for (const move of legalMoves) {
    const undo = makeMoveInt(board, move);
    const score = quickEval(board);
    undoMoveInt(board, undo);
    quickScores.push({ move, score });
  }

  // Sort and take top candidates for WASM evaluation
  quickScores.sort((a, b) => b.score - a.score);
  const topCandidates = quickScores.slice(0, Math.min(8, quickScores.length));

  // Step 2: Use WASM for the top candidates
  const moveScores: { move: Move; score: number }[] = [];
  const loopDepth = Math.max(2, searchDepth - 3);

  for (const candidate of topCandidates) {
    if (performance.now() - startTime > maxTimeMs) {
      logger.debug(
        `[AiEngine] getTopMoves timeout reached after ${performance.now() - startTime}ms`
      );
      break;
    }

    const undo = makeMoveInt(board, candidate.move);

    // Get opponent's best response using WASM
    const opponentColor = turnColor === 'white' ? 'black' : 'white';
    const wasmResult = await getBestMoveWasm(board, opponentColor, loopDepth, 'NORMAL', 2500);

    let score: number;
    if (wasmResult && typeof wasmResult.score === 'number') {
      score = -wasmResult.score;
    } else {
      score = candidate.score; // Use quick score as fallback
    }

    undoMoveInt(board, undo);
    moveScores.push({ move: candidate.move, score });
  }

  // Sort by WASM score (descending)
  moveScores.sort((a, b) => b.score - a.score);

  // Take top N
  const topMoves = moveScores.slice(0, count);

  const results = topMoves.map(ms => ({
    move: convertMoveToResult(ms.move),
    score: ms.score,
    nodes: 0,
  }));

  // Merge with book moves if any
  return [...bookMoves, ...results].slice(0, count + bookMoves.length);
}

export async function evaluatePosition(
  uiBoard: UiBoard,
  forColor: Player,
  config: TimeParams = {}
): Promise<number> {
  const board = convertBoardToInt(uiBoard);

  // Use Worker if available
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    try {
      const result = await runWorkerSearch(
        board,
        forColor,
        0,
        config.personality || 'NORMAL',
        config.elo || 2500
      );
      if (result) return result.score;
    } catch (err) {
      logger.error('[AiEngine] Worker eval failed, falling back', err);
    }
  }

  // Fallback to WASM
  const wasmResult = await getBestMoveWasm(
    board,
    forColor,
    0,
    config.personality || 'NORMAL',
    config.elo || 2500
  );
  if (wasmResult) return wasmResult.score;

  // Fallback to JS Search
  const jsResult = await runJsSearch(board, forColor, 0, config.elo || 2500);
  return jsResult.score;
}

// Deprecated/Stubbed
export function computeZobristHash(_uiBoard: UiBoard, _turnColor: Player): number {
  return 0;
}

export function getAllLegalMoves(uiBoard: UiBoard, turnColor: Player): MoveResult[] {
  const board = convertBoardToInt(uiBoard);
  const intMoves = genLegalInt(board, turnColor);
  return intMoves.map((m: { from: number; to: number; promotion?: number }) => ({
    from: { r: indexToRow(m.from), c: indexToCol(m.from) },
    to: { r: indexToRow(m.to), c: indexToCol(m.to) },
    promotion: m.promotion ? TYPE_INT_TO_STR[m.promotion & TYPE_MASK] : undefined,
  }));
}

export function analyzePosition(_uiBoard: UiBoard, _turnColor: Player): null {
  return null;
}

export function extractPV(_uiBoard: UiBoard, _turnColor: Player): MoveResult[] {
  return [];
}

export function isSquareAttacked(
  uiBoard: UiBoard,
  r: number,
  c: number,
  turnColor: Player
): boolean {
  const board = convertBoardToInt(uiBoard);
  const colorInt = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return isSquareAttackedInt(board, coordsToIndex(r, c), colorInt);
}

export function findKing(uiBoard: UiBoard, turnColor: Player): Square | null {
  const board = convertBoardToInt(uiBoard);
  const colorInt = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const index = findKingInt(board, colorInt);
  if (index === -1) return null;
  return { r: indexToRow(index), c: indexToCol(index) };
}

export function see(uiBoard: UiBoard, from: Square, to: Square): number {
  const board = convertBoardToInt(uiBoard);
  const move = {
    from: coordsToIndex(from.r, from.c),
    to: coordsToIndex(to.r, to.c),
  };
  return seeInt(board, move);
}

// Helpers for tests
export function makeMove(
  uiBoard: UiBoard,
  uiMove: { from: Square; to: Square } | null
): UndoInfo | null {
  if (!uiMove) return null;
  const r1 = uiMove.from.r,
    c1 = uiMove.from.c;
  const r2 = uiMove.to.r,
    c2 = uiMove.to.c;

  const piece = uiBoard[r1][c1];
  const captured = uiBoard[r2][c2];

  uiBoard[r2][c2] = piece;
  uiBoard[r1][c1] = null;

  if (piece) (piece as Piece & { hasMoved?: boolean }).hasMoved = true;

  return {
    move: uiMove,
    captured,
    oldHasMoved: false,
  };
}

export function getNodesEvaluated(): number {
  return getWasmNodesEvaluated();
}

export function resetNodesEvaluated(): void {
  resetWasmNodesEvaluated();
}

export function undoMove(uiBoard: UiBoard, undoInfo: UndoInfo | null): void {
  if (!undoInfo) return;
  const { move, captured } = undoInfo;
  const r1 = move.from.r,
    c1 = move.from.c;
  const r2 = move.to.r,
    c2 = move.to.c;

  const piece = uiBoard[r2][c2];
  uiBoard[r1][c1] = piece;
  uiBoard[r2][c2] = captured;
}

export function isInCheck(uiBoard: UiBoard, color: Player): boolean {
  const board = convertBoardToInt(uiBoard);
  const c = color === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return checkInt(board, c);
}

// Inlined PSTs (Legacy - Stubs)
export const PST: Record<string, number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [],
  b: [],
  r: [],
  q: [],
  k: [],
};

// Export everything
export { logger, setOpeningBook, queryOpeningBook, getAllCaptureMoves };

// Stubbed TT functions
export function storeTT(): void {}
export function probeTT(): void {}
export function getTTMove(): null {
  return null;
}
export function clearTT(): void {}
export function getTTSize(): number {
  return 0;
}
export function setTTMaxSize(): void {}
export function testStoreTT(): void {}
export function testProbeTT(): void {}

export interface AIProgressData {
  depth?: number;
  nodes?: number;
  time?: number;
  score?: number;
  pv?: string;
  [key: string]: number | string | undefined;
}

export let progressCallback: ((progress: AIProgressData) => void) | null = null;
export function setProgressCallback(cb: ((progress: AIProgressData) => void) | null): void {
  progressCallback = cb || null;
}
