/**
 * Core AI Logic for Schach 9x9
 * Re-exports functionality from modularized components in js/ai/
 */

import { logger } from './logger.js';
import {
  getBestMove,
  analyzePosition,
  setProgressCallback,
  getNodesEvaluated,
  resetNodesEvaluated,
} from './ai/Search.js';
import { evaluatePosition, PST, PST_EG } from './ai/Evaluation.js';
import { setOpeningBook, queryOpeningBook } from './ai/OpeningBook.js';
import {
  getAllLegalMoves,
  makeMove,
  undoMove,
  getAllCaptureMoves,
  isInCheck,
  isSquareAttacked,
  findKing,
} from './ai/MoveGenerator.js';
import {
  computeZobristHash,
  storeTT,
  probeTT,
  clearTT,
  getTTSize,
  setTTMaxSize,
  testStoreTT,
  testProbeTT,
} from './ai/TranspositionTable.js';

// Export everything needed by ai-worker.js and tests
export {
  logger,
  getBestMove,
  analyzePosition,
  evaluatePosition,
  setOpeningBook,
  queryOpeningBook,
  setProgressCallback,
  getNodesEvaluated,
  resetNodesEvaluated,
  getAllLegalMoves,
  makeMove,
  undoMove,
  getAllCaptureMoves,
  isInCheck,
  isSquareAttacked,
  findKing,
  computeZobristHash,
  storeTT,
  probeTT,
  clearTT,
  getTTSize,
  setTTMaxSize,
  testStoreTT,
  testProbeTT,
  PST,
  PST_EG,
};
