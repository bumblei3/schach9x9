/**
 * Core AI Logic for Schach 9x9 (Bridge Layer)
 * Converts UI Objects to Integer Board for the optimized AI Engine.
 */

import { logger } from './logger.js';
import {
  getBestMove as searchBestMove,
  analyzePosition as searchAnalyze,
  extractPV as searchExtractPV,
  setProgressCallback,
  getNodesEvaluated,
  resetNodesEvaluated
} from './ai/Search.js';

import {
  evaluatePosition as evalInt
} from './ai/Evaluation.js';

import {
  setOpeningBook,
  queryOpeningBook
} from './ai/OpeningBook.js';

import {
  getAllLegalMoves as genLegalInt,
  makeMove as makeMoveInt, // Not used by UI directly usually
  undoMove as undoMoveInt,
  getAllCaptureMoves, // Int
  isInCheck as checkInt,
  isSquareAttacked,
  findKing,
  see as seeInt,
} from './ai/MoveGenerator.js';

import {
  computeZobristHash as searchComputeHash,
  storeTT,
  probeTT,
  clearTT,
  getTTSize,
  setTTMaxSize,
  testStoreTT,
  testProbeTT,
  getTTMove
} from './ai/TranspositionTable.js';

import {
  BOARD_SIZE,
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
  COLOR_MASK,
  indexToRow,
  indexToCol,
  coordsToIndex
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
  e: PIECE_ANGEL
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
  [PIECE_ANGEL]: 'e'
};

function convertBoardToInt(uiBoard) {
  const board = new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
  const size = uiBoard.length;
  // if (size !== BOARD_SIZE) console.warn('Board Size Mismatch in conversion!');

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

// --- Bridge Functions ---

export function getBestMove(uiBoard, turnColor, maxDepth = 4, difficulty = 'expert', timeParams = {}) {
  const board = convertBoardToInt(uiBoard);
  return searchBestMove(board, turnColor, maxDepth, difficulty, timeParams);
}

export function evaluatePosition(uiBoard, forColor) {
  const board = convertBoardToInt(uiBoard);
  return evalInt(board, forColor); // evalInt expects string? 'white'/'black'
  // Evaluation.js: export function evaluatePosition(board, turnColor)
  // It handles 'white'/'black' strings or Ints?
  // Evaluation.js: const color = turnColor === 'white' ? COLOR_WHITE : ...
  // So it expects string.
}

export function computeZobristHash(uiBoard, turnColor) {
  const board = convertBoardToInt(uiBoard);
  const colorInt = turnColor === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return searchComputeHash(board, colorInt);
}

export function getAllLegalMoves(uiBoard, turnColor) {
  const board = convertBoardToInt(uiBoard);
  const intMoves = genLegalInt(board, turnColor); // expects string too?
  // MoveGenerator.js: getAllLegalMoves(board, turnColor) -> internal conversion.

  // Convert intMoves to UI Moves
  return intMoves.map(m => ({
    from: { r: indexToRow(m.from), c: indexToCol(m.from) },
    to: { r: indexToRow(m.to), c: indexToCol(m.to) },
    promotion: m.promotion ? TYPE_INT_TO_STR[m.promotion & TYPE_MASK] : undefined
  }));
}

export function analyzePosition(uiBoard, turnColor) {
  const board = convertBoardToInt(uiBoard);
  return searchAnalyze(board, turnColor); // Pass string
}

export function extractPV(uiBoard, turnColor) {
  const board = convertBoardToInt(uiBoard);
  return searchExtractPV(board, turnColor); // Pass string
}

export function see(uiBoard, from, to) {
  const board = convertBoardToInt(uiBoard);
  const move = {
    from: coordsToIndex(from),
    to: coordsToIndex(to)
  };
  return seeInt(board, move);
}

// Helpers for tests that expect these functions (Mocking legacy behavior)
export function makeMove(uiBoard, uiMove) {
  if (!uiMove) return null;
  const r1 = uiMove.from.r, c1 = uiMove.from.c;
  const r2 = uiMove.to.r, c2 = uiMove.to.c;

  const piece = uiBoard[r1][c1];
  const captured = uiBoard[r2][c2];

  uiBoard[r2][c2] = piece;
  uiBoard[r1][c1] = null;

  if (piece) piece.hasMoved = true;

  return {
    move: uiMove,
    captured,
    oldHasMoved: false
  };
}

export function undoMove(uiBoard, undoInfo) {
  if (!undoInfo) return;
  const { move, captured } = undoInfo;
  const r1 = move.from.r, c1 = move.from.c;
  const r2 = move.to.r, c2 = move.to.c;

  const piece = uiBoard[r2][c2];
  uiBoard[r1][c1] = piece;
  uiBoard[r2][c2] = captured;
}

export function isInCheck(uiBoard, color) {
  const board = convertBoardToInt(uiBoard);
  const c = color === 'white' ? COLOR_WHITE : COLOR_BLACK;
  return checkInt(board, c);
}

// PST Legacy Export
import {
  PST_PAWN, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, PST_KING_MG
} from './ai/Evaluation.js';

const PST = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
  k: PST_KING_MG
};

// Export everything
export {
  logger,
  setOpeningBook,
  queryOpeningBook,
  // extractPV, // Explicitly exported above
  setProgressCallback,
  getNodesEvaluated,
  resetNodesEvaluated,
  getAllCaptureMoves,
  isSquareAttacked,
  findKing,
  storeTT,
  probeTT,
  getTTMove,
  clearTT,
  getTTSize,
  setTTMaxSize,
  testStoreTT,
  testProbeTT,
  PST,
  convertBoardToInt // Internal testing
};
