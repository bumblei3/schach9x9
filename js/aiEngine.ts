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
        board[r * 9 + c] = (type | color) as any;
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
    aiWorker = new Worker(new URL('./ai/aiWorker.ts', import.meta.url), { type: 'module' });
    aiWorker.onmessage = (e: MessageEvent) => {
      const { type, id, data, payload, error } = e.data;
      logger.debug(`[AiEngine] Received worker message: type=${type} id=${id}`);
      if (workerPendingRequests.has(id)) {
        const { resolve, reject } = workerPendingRequests.get(id)!;
        workerPendingRequests.delete(id);

        if (type === 'SEARCH_ERROR') reject(error);
        else if (type === 'bestMove') resolve(data);
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

function convertMoveToResult(
  move: { from: any; to: any; promotion?: any } | null
): MoveResult | null {
  if (!move) return null;

  // If already converted (e.g. from worker result which was already processed)
  if (typeof move.from === 'object' && move.from !== null && 'r' in move.from) {
    return move as unknown as MoveResult;
  }

  return {
    from: { r: indexToRow(move.from), c: indexToCol(move.from) },
    to: { r: indexToRow(move.to), c: indexToCol(move.to) },
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
  // Reduced depths to prevent worker timeouts (was 3-8, now 2-4)
  let depth = 3;
  if (elo < 1000) depth = 2;
  else if (elo < 1400) depth = 3;
  else if (elo < 1800) depth = 3;
  else if (elo < 2200) depth = 4;
  else depth = 4;

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
  timeParams: TimeParams = {}
): Promise<SearchResult | null> {
  const board = convertBoardToInt(uiBoard);
  let config = timeParams;
  if (timeParams.elo) {
    const eloParams = getParamsForElo(timeParams.elo);
    config = { ...timeParams, ...eloParams };
    maxDepth = config.maxDepth!;
  }

  const personality = config.personality || 'NORMAL';
  const elo = config.elo || 2500;

  // Use Worker if available (Browser)
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
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

  // Fallback or Node.js environment
  // WASM is disabled, so we use the JS engine
  // const wasmResult = await (getBestMoveWasm as any)(board, turnColor, maxDepth, personality, elo);

  logger.debug('[AiEngine] Using JS Fallback Search');
  // Run JS Search
  const jsResult = await runJsSearch(board, turnColor, maxDepth, elo);
  if (jsResult) {
    return {
      score: jsResult.score,
      move: convertMoveToResult(jsResult.move)
    };
  }

  return null;
}

// --- JS Fallback Search (Mini-Max with Alpha-Beta) ---

const MATE_SCORE = 20000;
const INFINITY = 30000;

interface JsSearchResult {
  move: any;
  score: number;
  nodes: number;
}

// Simple material evaluation tables
const PIECE_VALUES: Record<number, number> = {
  [PIECE_PAWN]: 100,
  [PIECE_KNIGHT]: 320,
  [PIECE_BISHOP]: 330,
  [PIECE_ROOK]: 500,
  [PIECE_QUEEN]: 900,
  [PIECE_KING]: 20000,
  [PIECE_ARCHBISHOP]: 600,
  [PIECE_CHANCELLOR]: 700,
  [PIECE_ANGEL]: 1000,
};

async function runJsSearch(
  board: IntBoard,
  turnColor: Player,
  depth: number,
  _elo: number
): Promise<JsSearchResult> {
  const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const start = performance.now();
  let nodes = 0;

  function evaluate(b: IntBoard, c: number): number {
    let score = 0;
    for (let i = 0; i < SQUARE_COUNT; i++) {
      const p = b[i];
      if (p !== PIECE_NONE) {
        const type = p & TYPE_MASK;
        const pColor = p & COLOR_MASK;
        const val = PIECE_VALUES[type] || 0;
        if (pColor === c) score += val;
        else score -= val;
      }
    }
    return score;
  }

  function alphabeta(
    b: IntBoard,
    d: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    c: number
  ): { score: number; bestMove: any } {
    nodes++;

    // Check timeout every 2000 nodes
    if (nodes % 2000 === 0) {
      if (performance.now() - start > 5000) { // Hard 5s timeout
        return { score: evaluate(b, c), bestMove: null };
      }
      // Yield to main thread (optional, complex in sync logic)
    }

    if (d === 0) {
      return { score: evaluate(b, c), bestMove: null };
    }


    const currentMovingColor = maximizingPlayer ? c : (c ^ COLOR_MASK);
    // Wait, genLegalInt takes (board, turnColor: string)
    const activeColorStr = currentMovingColor === COLOR_WHITE ? 'white' : 'black';

    const legalMoves = genLegalInt(b, activeColorStr);

    if (legalMoves.length === 0) {
      if (checkInt(b, currentMovingColor)) {
        // Checkmate: return score from perspective of root color 'c'
        const score = (currentMovingColor === c) ? (-MATE_SCORE + (depth - d)) : (MATE_SCORE - (depth - d));
        return { score, bestMove: null };
      }
      // Stalemate
      return { score: 0, bestMove: null };
    }

    let bestMove = null;

    if (maximizingPlayer) {
      let maxEval = -INFINITY;
      for (const move of legalMoves) {
        const undo = makeMoveInt(b, move);
        const result = alphabeta(b, d - 1, alpha, beta, false, c);
        const evalScore = result.score;
        undoMoveInt(b, undo); // We need undoMove from MoveGenerator or internal helper
        // undoMove from aiEngine.ts works on UI Board, not IntBoard?
        // aiEngine.ts imports makeMove/undoMove from MoveGenerator... no it doesn't exports them helpers.
        // checks imports:
        // import { getAllLegalMoves as genLegalInt ... } from './ai/MoveGenerator.js'
        // We need makeMove/undoMove for INT board.
        // MoveGenerator.ts has export makeMove(board: BoardStorage, move: any): any
        // So we need to import them or copy simple logic.
        // Let's implement simple int make/undo here to be safe and fast.

        if (evalScore > maxEval) {
          maxEval = evalScore;
          bestMove = move;
        }
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return { score: maxEval, bestMove };
    } else {
      let minEval = INFINITY;
      for (const move of legalMoves) {
        const undo = makeMoveInt(b, move);
        const result = alphabeta(b, d - 1, alpha, beta, true, c);
        const evalScore = result.score;
        undoMoveInt(b, undo); // Need to define this local undo or use import

        if (evalScore < minEval) {
          minEval = evalScore;
          bestMove = move;
        }
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return { score: minEval, bestMove };
    }
  }

  // Import checks: I need makeMove/undoMove from MoveGenerator (Int version)
  // Current imports:
  /*
  import {
    getAllLegalMoves as genLegalInt,
    getAllCaptureMoves,
    isInCheck as checkInt,
    ...
  } from './ai/MoveGenerator.js';
  */
  // I should update imports first?
  // Easier to use genLegalInt which is exported.
  // makeMove/undoMove logic is simple array swap.

  const result = alphabeta(board, depth, -INFINITY, INFINITY, true, color);

  return {
    move: result.bestMove,
    score: result.score,
    nodes
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
  maxTimeMs: number = 5000
): Promise<SearchResult[]> {
  const board = convertBoardToInt(uiBoard);
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
        const val = PIECE_VALUES[type] || 0;
        const row = Math.floor(i / 9);
        const col = i % 9;
        const centerBonus = (4 - Math.abs(row - 4)) + (4 - Math.abs(col - 4));
        if (pColor === color) score += val + centerBonus * 5;
        else score -= val + centerBonus * 5;
      }
    }
    return score;
  }

  // Step 1: Quick pre-filter all moves with simple evaluation
  const quickScores: { move: any; score: number }[] = [];
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
  const moveScores: { move: any; score: number }[] = [];

  for (const candidate of topCandidates) {
    if (performance.now() - startTime > maxTimeMs) break;

    const undo = makeMoveInt(board, candidate.move);

    // Get opponent's best response using WASM
    const opponentColor = turnColor === 'white' ? 'black' : 'white';
    const wasmResult = await getBestMoveWasm(board, opponentColor, searchDepth, 'NORMAL', 2500);

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

  return topMoves.map((ms) => ({
    move: convertMoveToResult(ms.move),
    score: ms.score,
    nodes: 0,
  }));
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
export function storeTT(): void { }
export function probeTT(): void { }
export function getTTMove(): null {
  return null;
}
export function clearTT(): void { }
export function getTTSize(): number {
  return 0;
}
export function setTTMaxSize(): void { }
export function testStoreTT(): void { }
export function testProbeTT(): void { }

export let progressCallback: ((progress: any) => void) | null = null;
export function setProgressCallback(cb: (progress: any) => void | null): void {
  progressCallback = cb || null;
}
