/**
 * Adaptive Time Management for Schach 9x9 AI
 * Dynamically allocates thinking time based on position complexity,
 * game phase, remaining time, and AI personality.
 */

import { AI_PERSONALITIES } from './personalities.js';

export interface TimeAllocationParams {
  // Game state
  moveNumber: number;           // 1-based move number
  whiteTime: number;            // White time remaining in seconds
  blackTime: number;            // Black time remaining in seconds
  whiteIncrement: number;       // Increment per move (seconds)
  blackIncrement: number;       // Increment per move (seconds)
  isWhiteTurn: boolean;         // Whose turn it is
  
  // Position complexity indicators
  pieceCount: number;           // Total pieces on board
  isInCheck: boolean;           // Currently in check
  hasTacticalComplexity: boolean; // Multiple captures/threats detected
  
  // AI config
  personality: string;          // Personality key from AI_PERSONALITIES
  baseMaxDepth: number;         // Base max depth from difficulty
  maxTimeMs: number;            // Hard ceiling (ms)
}

export interface TimeAllocationResult {
  allocatedTimeMs: number;      // Time to spend on this move
  targetDepth: number;          // Target search depth
  searchParams: {
    aspirationMultiplier: number; // 0.5=then, 2.0=wide
    probCutEnabled: boolean;
    lmrAggressiveness: number;    // 0.5-1.5
    singularExtensionsEnabled: boolean;
  };
  timeBudgetInfo: {
    reason: string;
    emergencyReserve: boolean;
  };
}

// Game phase thresholds
const OPENING_MOVE_LIMIT = 20;
const MIDDLEGAME_PIECE_LIMIT = 16;  // Below this = simplified = endgame-ish

/**
 * Estimate position complexity for time allocation
 */
export function estimatePositionComplexity(params: {
  pieceCount: number;
  isInCheck: boolean;
  hasTacticalComplexity: boolean;
  moveNumber: number;
}): { score: number; // 0-1, higher = more complex
  reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Midgame is most complex
  if (params.pieceCount > MIDDLEGAME_PIECE_LIMIT) {
    score += 0.3;
    reasons.push('midgame');
  }
  
  // Opening has theory, less search needed
  if (params.moveNumber <= OPENING_MOVE_LIMIT) {
    score -= 0.2;
    reasons.push('opening');
  }
  
  // Endgame can be very complex (king activity, pawn races)
  if (params.pieceCount < 12) {
    score += 0.2;
    reasons.push('endgame');
  }

  // In check = must respond
  if (params.isInCheck) {
    score += 0.25;
    reasons.push('in-check');
  }
  
  // Tactical complexity
  if (params.hasTacticalComplexity) {
    score += 0.2;
    reasons.push('tactical');
  }

  // Clamp
  score = Math.max(0, Math.min(1, score));
  
  return { score, reason: reasons.join(', ') || 'standard' };
}

/**
 * Calculate adaptive time allocation
 */
export function calculateTimeAllocation(params: TimeAllocationParams): TimeAllocationResult {
  const personality = AI_PERSONALITIES[params.personality] || AI_PERSONALITIES.balanced;
  const timeFactor = personality.timeManagementFactor || 1.0;
  const aggression = personality.aggressionLevel || 1.0;
  const _riskTolerance = personality.riskTolerance || 0.5;
  const myTime = params.isWhiteTurn ? params.whiteTime : params.blackTime;
  const myIncrement = params.isWhiteTurn ? params.whiteIncrement : params.blackIncrement;
  
  // Get opponent's time for comparison
  const oppTime = params.isWhiteTurn ? params.blackTime : params.whiteTime;

  // --- Base time calculation ---
  // Start with increment as guaranteed time
  let baseTime = myIncrement * 1000; // ms
  
  // Time budget: fraction of remaining time
  // Use 1/30 for normal, 1/20 for aggressive, 1/40 for defensive
  const timeFraction = 0.033 * (0.8 + aggression * 0.6); // ~2.6% to 4.7%
  const remainingBudget = myTime * 1000 * timeFraction;
  baseTime += remainingBudget;

  // Position complexity adjustment
  const complexity = estimatePositionComplexity({
    pieceCount: params.pieceCount,
    isInCheck: params.isInCheck,
    hasTacticalComplexity: params.hasTacticalComplexity,
    moveNumber: params.moveNumber,
  });
  
  // Complexity multiplier: 0.5x (simple) to 2.0x (very complex)
  const complexityMult = 0.5 + complexity.score * 1.5;
  let allocatedTime = baseTime * complexityMult;

  // Personality time factor
  allocatedTime *= timeFactor;

  // Critical time situations
  let emergencyReserve = false;
  if (myTime < 10) { // Less than 10 seconds
    // Panic mode: use max 2s, keep 1s reserve
    allocatedTime = Math.min(allocatedTime, Math.max(500, myTime * 1000 * 0.3));
    emergencyReserve = true;
  } else if (myTime < 30) { // Less than 30 seconds
    // Time trouble: be more conservative
    allocatedTime = Math.min(allocatedTime, myTime * 1000 * 0.2);
  }

  // Opponent time pressure: if opp has very little time, can play faster
  if (oppTime < 30 && myTime > 60) {
    allocatedTime *= 0.7; // Compete on time
  }

  // Opening book phase: minimal search
  if (params.moveNumber <= OPENING_MOVE_LIMIT) {
    allocatedTime = Math.min(allocatedTime, 2000 * timeFactor);
  }

  // Hard ceiling
  allocatedTime = Math.min(allocatedTime, params.maxTimeMs);
  
  // Minimum useful time
  allocatedTime = Math.max(allocatedTime, 500);

  // --- Target depth from time ---
  // Rough heuristic: 500ms ≈ depth 4, 2000ms ≈ depth 6, 5000ms ≈ depth 8
  // log2 scaling
  const depthFromTime = Math.floor(4 + 2 * Math.log2(allocatedTime / 500));
  const targetDepth = Math.min(Math.max(depthFromTime, 3), params.baseMaxDepth);

  // --- Search behavior parameters ---
  // Aspiration window: tight for stable positions, wide for complex
  const aspirationMult = aggression > 1 ? 0.7 : (aggression < 0.8 ? 1.5 : 1.0);
  
  // ProbCut: aggressive likes it, defensive avoids it
  const probCutEnabled = aggression >= 1.0 && !emergencyReserve;
  
  // LMR: aggressive reduces more, defensive reduces less
  const lmrAgg = 0.7 + aggression * 0.5; // 0.7 to 1.5
  
  // Singular extensions: always on except emergency
  const singularExt = !emergencyReserve;

  return {
    allocatedTimeMs: Math.round(allocatedTime),
    targetDepth,
    searchParams: {
      aspirationMultiplier: aspirationMult,
      probCutEnabled,
      lmrAggressiveness: lmrAgg,
      singularExtensionsEnabled: singularExt,
    },
    timeBudgetInfo: {
      reason: complexity.reason,
      emergencyReserve,
    },
  };
}

/**
 * Helper: detect tactical complexity from position
 * Returns true if there are multiple captures, threats, or forcing moves
 */
export function detectTacticalComplexity(
  board: ReadonlyArray<number>,
  color: number,
  getAllLegalMoves: (b: ReadonlyArray<number>, c: string) => Array<{ from: number; to: number; promotion?: number }>,
  isSquareAttacked: (b: ReadonlyArray<number>, sq: number, byColor: number) => boolean
): boolean {
  const moves = getAllLegalMoves(board, color === 16 ? 'white' : 'black');
  let captureCount = 0;
  let checkCount = 0;

  for (const m of moves) {
    if (board[m.to] !== 0) captureCount++;
    
    // Simulate move and check for check/threats
    const tempBoard = [...board] as number[];
    tempBoard[m.to] = tempBoard[m.from];
    tempBoard[m.from] = 0;
    
    const enemyColor = color === 16 ? 32 : 16;
    const enemyKing = tempBoard.findIndex(p => p !== 0 && (p & 48) === enemyColor && (p & 15) === 6);
    if (enemyKing >= 0 && isSquareAttacked(tempBoard, enemyKing, color)) {
      checkCount++;
    }
  }
  
  // Complex if multiple captures or checks, or many forcing moves
  return captureCount >= 3 || checkCount >= 2 || moves.length > 40;
}


