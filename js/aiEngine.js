/**
 * Core AI Logic for Schach 9x9 (Bridge Layer)
 * Converts UI Objects to Integer Board for the optimized AI Engine.
 */

import { logger } from './logger.js';
import {
  getBestMoveWasm,
  getWasmNodesEvaluated,
  resetWasmNodesEvaluated,
} from './ai/wasmBridge.js';

import { setOpeningBook, queryOpeningBook } from './ai/OpeningBook.js';

import {
  getAllLegalMoves as genLegalInt,
  getAllCaptureMoves, // Int
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
} from './ai/BoardDefinitions.js';

// --- Conversion Helpers ---

const TYPE_MAP_TO_INT = {
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

const TYPE_INT_TO_STR = {
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

function convertBoardToInt(uiBoard) {
  const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  const size = uiBoard.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const p = uiBoard[r][c];
      if (p) {
        const type = TYPE_MAP_TO_INT[p.type] || PIECE_NONE;
        const color = p.color === 'white' ? COLOR_WHITE : COLOR_BLACK;
        board[r * 9 + c] = type | color;
      }
    }
  }
  return board;
}

// --- Worker Management ---

let aiWorker = null;
const workerPendingRequests = new Map();
let workerReqId = 0;

function initAiWorker() {
  if (aiWorker || typeof Worker === 'undefined') return;

  try {
    aiWorker = new Worker(new URL('./ai/aiWorker.js', import.meta.url), { type: 'module' });
    aiWorker.onmessage = e => {
      const { type, id, payload, error } = e.data;
      if (workerPendingRequests.has(id)) {
        const { resolve, reject } = workerPendingRequests.get(id);
        workerPendingRequests.delete(id);

        if (type === 'SEARCH_ERROR') reject(error);
        else resolve(payload);
      }
    };
    logger.info('[AiEngine] AI Worker initialized');
  } catch (err) {
    logger.error('[AiEngine] Failed to init AI Worker', err);
  }
}

function runWorkerSearch(board, turnColor, depth, personality, elo) {
  if (!aiWorker) initAiWorker();
  if (!aiWorker) throw new Error('Worker not available');

  return new Promise((resolve, reject) => {
    const id = workerReqId++;
    workerPendingRequests.set(id, { resolve, reject });
    aiWorker.postMessage({
      type: 'SEARCH',
      id,
      payload: { board, turnColor, depth, personality, elo },
    });
  });
}

function convertMoveToResult(move) {
  if (!move) return null;
  return {
    from: { r: indexToRow(move.from), c: indexToCol(move.from) },
    to: { r: indexToRow(move.to), c: indexToCol(move.to) },
    promotion: move.promotion,
  };
}

// --- Bridge Functions ---

/**
 * Maps Elo rating to search parameters
 * @param {number} elo
 * @returns {object} { maxDepth, elo, personality }
 */
export function getParamsForElo(elo) {
  let depth = 4;
  if (elo < 1000) depth = 3;
  else if (elo < 1400) depth = 4;
  else if (elo < 1800) depth = 5;
  else if (elo < 2200) depth = 6;
  else depth = 8;

  return {
    maxDepth: depth,
    elo: elo,
  };
}

export async function getBestMove(
  uiBoard,
  turnColor,
  maxDepth = 4,
  difficulty = 'expert',
  timeParams = {}
) {
  const result = await getBestMoveDetailed(uiBoard, turnColor, maxDepth, difficulty, timeParams);
  if (!result || !result.move) return null;
  // Flatten result to match legacy API (Move object with extra props)
  const move = result.move;
  move.score = result.score;
  return move;
}

export async function getBestMoveDetailed(uiBoard, turnColor, maxDepth = 4, timeParams = {}) {
  const board = convertBoardToInt(uiBoard);
  let config = timeParams;
  if (timeParams.elo) {
    const eloParams = getParamsForElo(timeParams.elo);
    config = { ...timeParams, ...eloParams };
    maxDepth = config.maxDepth;
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
          move: convertMoveToResult(result.move),
        };
      }
    } catch (err) {
      logger.error('[AiEngine] Worker search failed, falling back to main thread', err);
    }
  }

  // Fallback or Node.js environment
  const wasmResult = await getBestMoveWasm(board, turnColor, maxDepth, personality, elo);
  if (wasmResult) {
    logger.debug('[AiEngine] Using Wasm Engine Result (Main Thread)');
    return {
      ...wasmResult,
      move: convertMoveToResult(wasmResult.move),
    };
  }

  return null;
}

export async function evaluatePosition(uiBoard, forColor, config = {}) {
  const board = convertBoardToInt(uiBoard);
  // Use depth 0 search to get static evaluation
  // Note: This is now ASYNC. Tests must be updated.
  const wasmResult = await getBestMoveWasm(
    board,
    forColor,
    0,
    config.personality || 'NORMAL',
    config.elo || 2500
  );
  return wasmResult ? wasmResult.score : 0;
}

// Deprecated/Stubbed
export function computeZobristHash(_uiBoard, _turnColor) {
  return 0; // Wasm handles this internally now
}

export function getAllLegalMoves(uiBoard, turnColor) {
  const board = convertBoardToInt(uiBoard);
  const intMoves = genLegalInt(board, turnColor);
  return intMoves.map(m => ({
    from: { r: indexToRow(m.from), c: indexToCol(m.from) },
    to: { r: indexToRow(m.to), c: indexToCol(m.to) },
    promotion: m.promotion ? TYPE_INT_TO_STR[m.promotion & TYPE_MASK] : undefined,
  }));
}

export function analyzePosition(_uiBoard, _turnColor) {
  return null; // Analysis mode temporarily disabled in Wasm port
}

export function extractPV(_uiBoard, _turnColor) {
  return []; // PV extraction temporarily disabled
}

export function isSquareAttacked(uiBoard, r, c, turnColor) {
  const board = convertBoardToInt(uiBoard);
  const colorInt = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return isSquareAttackedInt(board, coordsToIndex(r, c), colorInt);
}

export function findKing(uiBoard, turnColor) {
  const board = convertBoardToInt(uiBoard);
  const colorInt = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const index = findKingInt(board, colorInt);
  if (index === -1) return null;
  return { r: indexToRow(index), c: indexToCol(index) };
}

export function see(uiBoard, from, to) {
  const board = convertBoardToInt(uiBoard);
  const move = {
    from: coordsToIndex(from),
    to: coordsToIndex(to),
  };
  return seeInt(board, move);
}

// Helpers for tests that expect these functions (Mocking legacy behavior)
export function makeMove(uiBoard, uiMove) {
  if (!uiMove) return null;
  const r1 = uiMove.from.r,
    c1 = uiMove.from.c;
  const r2 = uiMove.to.r,
    c2 = uiMove.to.c;

  const piece = uiBoard[r1][c1];
  const captured = uiBoard[r2][c2];

  uiBoard[r2][c2] = piece;
  uiBoard[r1][c1] = null;

  if (piece) piece.hasMoved = true;

  return {
    move: uiMove,
    captured,
    oldHasMoved: false,
  };
}

export function getNodesEvaluated() {
  return getWasmNodesEvaluated();
}

export function resetNodesEvaluated() {
  resetWasmNodesEvaluated();
}

export function undoMove(uiBoard, undoInfo) {
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

export function isInCheck(uiBoard, color) {
  const board = convertBoardToInt(uiBoard);
  const c = color === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return checkInt(board, c);
}

// Inlined PSTs (Legacy - Stubs)
export const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [],
  b: [],
  r: [],
  q: [],
  k: [],
};

// Export everything
export {
  logger,
  setOpeningBook,
  queryOpeningBook,
  setProgressCallback,
  getAllCaptureMoves,
  convertBoardToInt, // Internal testing
};

// Stubbed TT functions
export function storeTT() {}
export function probeTT() {}
export function getTTMove() {
  return null;
}
export function clearTT() {}
export function getTTSize() {
  return 0;
}
export function setTTMaxSize() {}
export function testStoreTT() {}
export function testProbeTT() {}

function setProgressCallback() {}
