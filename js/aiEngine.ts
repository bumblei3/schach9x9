/**
 * AI Bridge Layer for Schach 9x9.
 * Thin wrapper that delegates to search.ts and evaluate.ts.
 * Handles WASM worker communication, board conversion, and public API.
 */

import { logger } from './logger';
import { AI_PERSONALITIES } from './ai/personalities';
import {
  calculateTimeAllocation,
  detectTacticalComplexity,
  type TimeAllocationParams,
} from './ai/timeManagement';
import {
  getBestMoveWasm,
  getWasmNodesEvaluated,
  resetWasmNodesEvaluated,
} from './ai/wasmBridge';
import { setOpeningBook, queryOpeningBook } from './ai/OpeningBook';
import type { Move } from './ai/MoveGenerator';
import {
  getAllLegalMoves as genLegalInt,
  makeMove as makeMoveInt,
  undoMove as undoMoveInt,
  getAllCaptureMoves,
  isInCheck as checkInt,
  isSquareAttacked as isSquareAttackedInt,
  findKing as findKingInt,
  see as seeInt,
  getAllThreats,
  getKingThreats,
  getXRayThreats,
  getDiscoveredAttackPotential,
  type ThreatInfo,
  // Note: Piece constants (PIECE_*, COLOR_*) are re-exported from BoardDefinitions below
} from './ai/MoveGenerator';
import {
  SQUARE_COUNT, PIECE_NONE, PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP,
  PIECE_ROOK, PIECE_QUEEN, PIECE_KING, PIECE_ARCHBISHOP, PIECE_CHANCELLOR,
  PIECE_ANGEL, PIECE_NIGHTRIDER, COLOR_WHITE, COLOR_BLACK, TYPE_MASK, COLOR_MASK,
} from './ai/BoardDefinitions';
import { getCurrentBoardShape } from './config';
import type { Player, Square, Piece, PieceType } from './types/game';
import { computeZobristHash, TranspositionTable } from './ai/transpositionTable';

// Re-export evaluate module
export { evaluate, EVAL_VALUES, type IntBoard, type EvalConfig } from './evaluate';
import { evaluate, EVAL_VALUES, type EvalConfig } from './evaluate';

// Re-export search module
import { createJsSearch } from './search';

export { computeZobristHash, TranspositionTable };

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
  // Adaptive time management
  whiteTime?: number;
  blackTime?: number;
  whiteIncrement?: number;
  blackIncrement?: number;
  maxTimeMs?: number;
  // Search behavior (populated by adaptive time management)
  searchParams?: {
    aspirationMultiplier?: number;
    probCutEnabled?: boolean;
    lmrAggressiveness?: number;
    singularExtensionsEnabled?: boolean;
  };
  timeLimitMs?: number;
}

export interface MoveResult {
  from: Square;
  to: Square;
  promotion?: string | PieceType;
  capture?: boolean;
  score?: number;
  piece?: PieceType;
}

export interface SearchResult {
  move: MoveResult | null;
  score: number;
  depth: number;
  nodes: number;
  pv?: string;  // Principal variation as UCI move string
}

export interface UndoInfo {
  move: MoveResult;
  captured: Piece | null;
  oldHasMoved: boolean;
}

type UiBoard = (Piece | null)[][];
type IntBoard = Int8Array;

// --- Board conversion ---

const TYPE_MAP_TO_INT: Record<string, number> = {
  p: PIECE_PAWN, n: PIECE_KNIGHT, b: PIECE_BISHOP, r: PIECE_ROOK,
  q: PIECE_QUEEN, k: PIECE_KING, a: PIECE_ARCHBISHOP, c: PIECE_CHANCELLOR,
  e: PIECE_ANGEL, j: PIECE_NIGHTRIDER,
};

const TYPE_INT_TO_STR: Record<number, string> = {
  [PIECE_PAWN]: 'p', [PIECE_KNIGHT]: 'n', [PIECE_BISHOP]: 'b', [PIECE_ROOK]: 'r',
  [PIECE_QUEEN]: 'q', [PIECE_KING]: 'k', [PIECE_ARCHBISHOP]: 'a', [PIECE_CHANCELLOR]: 'c',
  [PIECE_ANGEL]: 'e', [PIECE_NIGHTRIDER]: 'j',
};

export function convertBoardToInt(uiBoard: UiBoard | IntBoard): IntBoard {
  if (uiBoard instanceof Int8Array) return uiBoard;
  const size = uiBoard.length;
  const board = new Int8Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const p = uiBoard[r][c];
      if (p) {
        const type = TYPE_MAP_TO_INT[p.type] || PIECE_NONE;
        const color = p.color === 'white' ? COLOR_WHITE : COLOR_BLACK;
        board[r * size + c] = type | color;
      }
    }
  }
  return board;
}

// --- Worker management ---

type PendingResolve = (_data: SearchResult | SearchResult[] | null) => void;

const workerPendingRequests = new Map<string, { resolve: PendingResolve; timer: number }>();

// Worker initialization removed - not currently used

function runWorkerSearch(
  board: IntBoard, turnColor: Player, maxDepth: number, personality: string, elo: number
): Promise<SearchResult | null> {
  return new Promise<SearchResult | null>(resolve => {
    const id = Math.random().toString(36).slice(2);
    const timer = window.setTimeout(() => { workerPendingRequests.delete(id); resolve(null); }, 15000);
    workerPendingRequests.set(id, { resolve: resolve as PendingResolve, timer });
    void board; void turnColor; void maxDepth; void personality; void elo;
  });
}

function runWorkerTopMoves(
  board: IntBoard, _turnColor: Player, _count: number, _searchDepth: number, _maxTimeMs: number
): Promise<SearchResult[]> {
  // Worker not initialized in aiEngine - delegate to JS/WASM fallback
  // This function is kept for API compatibility but the actual work
  // is done by the JS fallback in getTopMoves() below
  void board;
  return Promise.resolve([]);
}

function convertMoveToResult(move: { from: number; to: number; promotion?: number } | null): MoveResult | null {
  if (!move) return null;
  const size = 9;
  return {
    from: { r: Math.floor(move.from / size), c: move.from % size },
    to: { r: Math.floor(move.to / size), c: move.to % size },
    promotion: move.promotion ? TYPE_INT_TO_STR[move.promotion] || undefined : undefined,
  };
}

// --- Elo params ---

export function getParamsForElo(elo: number): EloParams {
  let depth = 4;
  if (elo < 1000) depth = 3;
  else if (elo < 1400) depth = 4;
  else if (elo < 1800) depth = 5;
  else if (elo < 2200) depth = 6;
  else depth = 7;
  return { maxDepth: depth, elo };
}

// --- Public API ---

export async function getBestMove(
  uiBoard: UiBoard, turnColor: Player, maxDepth: number = 4,
  _difficulty: string = 'expert', timeParams: TimeParams = {}
): Promise<MoveResult | null> {
  const result = await getBestMoveDetailed(uiBoard, turnColor, maxDepth, timeParams);
  if (!result || !result.move) return null;
  const move = result.move;
  move.score = result.score;
  return move;
}

export async function getBestMoveDetailed(
  uiBoard: UiBoard, turnColor: Player, maxDepth: number = 4,
  timeParams: TimeParams = {}, moveNumber?: number
): Promise<SearchResult | null> {
  const board = convertBoardToInt(uiBoard);

  if (moveNumber !== undefined && moveNumber < 25) {
    const bookMove = queryOpeningBook(uiBoard, moveNumber);
    if (bookMove) {
      logger.info(`[AiEngine] Opening Book Move: ${bookMove.from.r},${bookMove.from.c} -> ${bookMove.to.r},${bookMove.to.c}`);
      return { move: bookMove, score: 0, depth: 0, nodes: 0 };
    }
  }

  let config = timeParams;
  if (timeParams.elo) {
    const eloParams = getParamsForElo(timeParams.elo);
    config = { ...timeParams, ...eloParams };
    maxDepth = config.maxDepth!;
  }

  // --- ADAPTIVE TIME MANAGEMENT ---
  // Extract clock info from config
  const whiteTime = config.whiteTime ?? 300;
  const blackTime = config.blackTime ?? 300;
  const whiteIncrement = config.whiteIncrement ?? 0;
  const blackIncrement = config.blackIncrement ?? 0;

  // Detect tactical complexity for time allocation
  // Create a mutable copy for the tactical detection functions which expect IntBoard
  const tacticalBoard = new Int8Array(board);
  const hasTacticalComplexity = detectTacticalComplexity(
    tacticalBoard as unknown as ReadonlyArray<number>,
    turnColor === 'white' ? 16 : 32,
    (b: ReadonlyArray<number>, c: string) => genLegalInt(b as unknown as IntBoard, c as Player),
    (b: ReadonlyArray<number>, sq: number, byColor: number) => isSquareAttackedInt(b as unknown as IntBoard, sq, byColor)
  );

  // Count pieces for game phase detection
  const pieceCount = board.filter(p => p !== 0).length;

  // Calculate time allocation
  const personalityKey = config.personality || 'NORMAL';
  const personality = AI_PERSONALITIES[personalityKey] || AI_PERSONALITIES.balanced;
  // Time factor and aggression reserved for future use

  // Build time allocation params
  const timeAllocParams: TimeAllocationParams = {
    moveNumber: moveNumber ?? 1,
    whiteTime,
    blackTime,
    whiteIncrement,
    blackIncrement,
    isWhiteTurn: turnColor === 'white',
    pieceCount,
    isInCheck: checkInt(board, turnColor === 'white' ? 16 : 32),
    hasTacticalComplexity,
    personality: personalityKey,
    baseMaxDepth: maxDepth,
    maxTimeMs: config.maxTimeMs ?? 30000,
  };

  const timeAllocResult = calculateTimeAllocation(timeAllocParams);
  
  // Use adaptive depth and time
  const adaptiveMaxDepth = timeAllocResult.targetDepth;
  const timeLimitMs = timeAllocResult.allocatedTimeMs;
  
  logger.debug(`[AiEngine] Adaptive time: ${timeLimitMs}ms, depth: ${adaptiveMaxDepth}, reason: ${timeAllocResult.timeBudgetInfo.reason}, emergency: ${timeAllocResult.timeBudgetInfo.emergencyReserve}`);

  // Override maxDepth with adaptive value
  maxDepth = adaptiveMaxDepth;

  // Pass search behavior params to WASM via config
  config.searchParams = timeAllocResult.searchParams;
  config.timeLimitMs = timeLimitMs;

  const personalityId = personality.wasmPersonality;
  const elo = config.elo || 2500;
  const boardShape = getCurrentBoardShape();

  if (boardShape === 'standard' && typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    try {
      const result = await runWorkerSearch(board, turnColor, maxDepth, personalityId, elo);
      if (result && result.move) {
        logger.debug('[AiEngine] Using Wasm Worker Result');
        return { ...result, move: convertMoveToResult(result.move as unknown as { from: number; to: number }), depth: result.depth ?? 0, nodes: result.nodes ?? 0 };
      }
    } catch (err) {
      logger.error('[AiEngine] Worker search failed', err);
    }
  }

  if (boardShape === 'standard') {
    try {
      const wasmResult = await getBestMoveWasm(board, turnColor, maxDepth, personalityId, elo);
      if (wasmResult) return { ...wasmResult, depth: wasmResult.depth ?? 0, nodes: wasmResult.nodes ?? 0 };
    } catch {
      logger.debug('[AiEngine] WASM fallback failed, using JS');
    }
  }

  logger.debug('[AiEngine] Using JS Fallback Search');
  const jsResult = await runJsSearch(board, turnColor, maxDepth, elo, personalityId);
  if (jsResult) {
    return { score: jsResult.score, move: convertMoveToResult(jsResult.move), nodes: jsResult.nodes, depth: jsResult.depth };
  }
  return null;
}

// --- JS Fallback Search ---

interface JsSearchResult {
  move: { from: number; to: number; promotion?: number } | null;
  score: number;
  nodes: number;
  depth: number;
}

async function runJsSearch(
  board: IntBoard, turnColor: Player, maxDepth: number, _elo: number, personality: string
): Promise<JsSearchResult> {
  const jsSearch = createJsSearch({ personality: personality as EvalConfig['personality'] });
  return jsSearch.run(board, turnColor, maxDepth);
}

// --- Top Moves (tutor) ---

export async function getTopMoves(
  uiBoard: UiBoard, turnColor: Player, count: number = 3,
  searchDepth: number = 2, maxTimeMs: number = 5000, moveNumber?: number
): Promise<SearchResult[]> {
  const board = convertBoardToInt(uiBoard);
  const bookMoves: SearchResult[] = [];
  if (moveNumber !== undefined && moveNumber < 25) {
    const bookMove = queryOpeningBook(uiBoard, moveNumber);
    if (bookMove) {
      bookMoves.push({ move: bookMove, score: 50, depth: 0, nodes: 0 });
      count = Math.max(1, count - 1);
    }
  }
  const boardShape = getCurrentBoardShape();
  let workerResult: SearchResult[] | null = null;
  if (boardShape === 'standard' && typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    try { workerResult = await runWorkerTopMoves(board, turnColor, count, searchDepth, maxTimeMs); } catch (err) { logger.error('[AiEngine] Worker getTopMoves failed', err); }
  }
  // Use worker result if it has moves, otherwise fall through to JS/WASM fallback
  if (workerResult && workerResult.length > 0) {
    return workerResult;
  }
  // JS fallback: quick eval + WASM for top candidates
  const color = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const startTime = performance.now();
  const legalMoves = genLegalInt(board, turnColor);
  if (legalMoves.length === 0) return [];
  function quickEval(b: IntBoard): number {
    let s = 0;
    for (let i = 0; i < SQUARE_COUNT; i++) {
      const p = b[i];
      if (p !== PIECE_NONE) {
        const type = p & TYPE_MASK, pColor = p & COLOR_MASK;
        const val = EVAL_VALUES[type] || 0;
        const row = Math.floor(i / 9), col = i % 9;
        const cb = 4 - Math.abs(row - 4) + (4 - Math.abs(col - 4));
        if (pColor === color) s += val + cb * 5; else s -= val + cb * 5;
      }
    }
    return s;
  }
  const quickScores: { move: Move; score: number }[] = [];
  for (const move of legalMoves) {
    const undo = makeMoveInt(board, move);
    quickScores.push({ move, score: quickEval(board) });
    undoMoveInt(board, undo);
  }
  quickScores.sort((a, b) => b.score - a.score);
  const topCandidates = quickScores.slice(0, Math.min(8, quickScores.length));
  const moveScores: { move: Move; score: number }[] = [];
  const loopDepth = Math.max(2, searchDepth - 3);
  for (const candidate of topCandidates) {
    if (performance.now() - startTime > maxTimeMs) break;
    try {
      const wasmResult = await getBestMoveWasm(board, turnColor, loopDepth, 'NORMAL', 2500);
      if (wasmResult) moveScores.push({ move: candidate.move, score: wasmResult.score });
    } catch { moveScores.push({ move: candidate.move, score: candidate.score }); }
  }
  moveScores.sort((a, b) => b.score - a.score);

  // Guaranteed fallback: if WASM/search failed but we have legal moves,
  // return them with their quick-eval scores (at least something useful)
  if (moveScores.length === 0 && legalMoves.length > 0) {
    for (const move of legalMoves.slice(0, count)) {
      const undo = makeMoveInt(board, move);
      const score = quickEval(board);
      undoMoveInt(board, undo);
      moveScores.push({ move, score });
    }
    moveScores.sort((a, b) => b.score - a.score);
  }

  return [...bookMoves, ...moveScores.slice(0, count).map(ms => ({
    move: convertMoveToResult(ms.move as unknown as { from: number; to: number }),
    score: ms.score, depth: loopDepth, nodes: 0,
  }))];
}

// --- Position Analysis ---

export async function analyzePosition(uiBoard: UiBoard, turnColor: Player): Promise<SearchResult | null> {
  return getBestMoveDetailed(uiBoard, turnColor, 4, {});
}

export async function evaluatePosition(uiBoard: UiBoard, forColor: Player): Promise<number> {
  const board = convertBoardToInt(uiBoard);
  const c = forColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return evaluate(board, c);
}

export function extractPV(_uiBoard: UiBoard, _turnColor: Player): MoveResult[] {
  return [];
}

// --- UI Helpers ---

export function getAllLegalMoves(uiBoard: UiBoard, turnColor: Player): MoveResult[] {
  const board = convertBoardToInt(uiBoard);
  const intMoves = genLegalInt(board, turnColor);
  return intMoves.map(m => convertMoveToResult(m as unknown as { from: number; to: number })).filter(Boolean) as MoveResult[];
}

export function isSquareAttacked(
  uiBoard: UiBoard, r: number, c: number, color: Player
): boolean {
  const board = convertBoardToInt(uiBoard);
  const size = uiBoard.length;
  return isSquareAttackedInt(board, r * size + c, color === 'white' ? COLOR_WHITE : COLOR_BLACK);
}

export function findKing(uiBoard: UiBoard, turnColor: Player): Square | null {
  const board = convertBoardToInt(uiBoard);
  const c = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const idx = findKingInt(board, c);
  if (idx < 0) return null;
  return { r: Math.floor(idx / uiBoard.length), c: idx % uiBoard.length };
}

export function see(uiBoard: UiBoard, from: Square, to: Square): number {
  const board = convertBoardToInt(uiBoard);
  const size = uiBoard.length;
  return seeInt(board, { from: from.r * size + from.c, to: to.r * size + to.c });
}

export function makeMove(uiBoard: UiBoard, move: { from: Square; to: Square }): UndoInfo | null {
  const piece = uiBoard[move.from.r][move.from.c];
  const captured = uiBoard[move.to.r][move.to.c];
  uiBoard[move.to.r][move.to.c] = piece;
  uiBoard[move.from.r][move.from.c] = null;
  if (piece) (piece as Piece & { hasMoved?: boolean }).hasMoved = true;
  return { move, captured, oldHasMoved: false };
}

export function undoMove(uiBoard: UiBoard, undoInfo: UndoInfo | null): void {
  if (!undoInfo) return;
  const { move, captured } = undoInfo;
  const piece = uiBoard[move.to.r][move.to.c];
  uiBoard[move.from.r][move.from.c] = piece;
  uiBoard[move.to.r][move.to.c] = captured;
}

export function isInCheck(uiBoard: UiBoard, color: Player): boolean {
  const board = convertBoardToInt(uiBoard);
  const c = color === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return checkInt(board, c);
}

export function getNodesEvaluated(): number { return getWasmNodesEvaluated(); }
export function resetNodesEvaluated(): void { resetWasmNodesEvaluated(); }

// --- Legacy stubs ---

export const PST: Record<string, number[]> = { p: [], n: [], b: [], r: [], q: [], k: [] };
export function storeTT(): void {}
export function probeTT(): void {}
export function getTTMove(): null { return null; }
export function clearTT(): void {}
export function getTTSize(): number { return 0; }
export function setTTMaxSize(): void {}
export function testStoreTT(): void {}
export function testProbeTT(): void {}

export interface AIProgressData {
  depth?: number; nodes?: number; time?: number; score?: number; pv?: string;
  [key: string]: number | string | undefined;
}

export let progressCallback: ((_progress: AIProgressData) => void) | null = null;
export function setProgressCallback(_cb: ((_progress: AIProgressData) => void) | null): void {
  progressCallback = _cb || null;
}

// Re-exports
export { logger, setOpeningBook, queryOpeningBook, getAllCaptureMoves, getAllThreats, getKingThreats, getXRayThreats, getDiscoveredAttackPotential, type ThreatInfo, PIECE_KING, PIECE_QUEEN, COLOR_WHITE, COLOR_BLACK, PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_ARCHBISHOP, PIECE_CHANCELLOR, PIECE_ANGEL, PIECE_NIGHTRIDER, PIECE_NONE };


