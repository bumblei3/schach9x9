/**
 * Engine Match Runner for Schach 9x9
 * Runs headless games between two AI engines for testing and benchmarking.
 * Usage: npx tsx js/engineMatch.ts
 */

import { logger } from './logger.js';
import {
  getBestMoveDetailed,
  convertBoardToInt,
  type MoveResult,
  type SearchResult,
} from './aiEngine.js';
import { isInCheck, COLOR_WHITE, COLOR_BLACK } from './ai/MoveGenerator.js';
import { AI_PERSONALITIES } from './ai/personalities.js';
import type { Piece } from './types/game.js';

interface MoveRecord {
  moveNumber: number;
  color: string;
  from: { r: number; c: number };
  to: { r: number; c: number };
  evalScore?: number;
  depth?: number;
  nodes?: number;
  personality: string;
}

// ============================================================================
// Helper: Convert internal number[][] board to UiBoard format
// ============================================================================

/**
 * Converts a piece code to Piece object
 * Code mapping: +1..+10 = white pieces, -1..-10 = black pieces, 0 = empty
 */
function pieceCodeToPiece(code: number): Piece | null {
  switch (code) {
    // White pieces
    case 1:
      return { type: 'p', color: 'white', hasMoved: false };
    case 2:
      return { type: 'n', color: 'white', hasMoved: false };
    case 3:
      return { type: 'b', color: 'white', hasMoved: false };
    case 4:
      return { type: 'r', color: 'white', hasMoved: false };
    case 5:
      return { type: 'q', color: 'white', hasMoved: false };
    case 6:
      return { type: 'k', color: 'white', hasMoved: false };
    case 7:
      return { type: 'a', color: 'white', hasMoved: false };
    case 8:
      return { type: 'c', color: 'white', hasMoved: false };
    case 9:
      return { type: 'e', color: 'white', hasMoved: false };
    case 10:
      return { type: 'j', color: 'white', hasMoved: false };
    // Black pieces
    case -1:
      return { type: 'p', color: 'black', hasMoved: false };
    case -2:
      return { type: 'n', color: 'black', hasMoved: false };
    case -3:
      return { type: 'b', color: 'black', hasMoved: false };
    case -4:
      return { type: 'r', color: 'black', hasMoved: false };
    case -5:
      return { type: 'q', color: 'black', hasMoved: false };
    case -6:
      return { type: 'k', color: 'black', hasMoved: false };
    case -7:
      return { type: 'a', color: 'black', hasMoved: false };
    case -8:
      return { type: 'c', color: 'black', hasMoved: false };
    case -9:
      return { type: 'e', color: 'black', hasMoved: false };
    case -10:
      return { type: 'j', color: 'black', hasMoved: false };
    default:
      return null;
  }
}

/**
 * Converts internal number[][] board to UiBoard format expected by convertBoardToInt
 */
function convertToUiBoard(board: number[][]): (Piece | null)[][] {
  return board.map(row => row.map(code => pieceCodeToPiece(code)));
}

// ============================================================================
// Types
// ============================================================================

export interface EngineConfig {
  name: string;
  personality: keyof typeof AI_PERSONALITIES;
  elo?: number;
  depth?: number;
  timeControl?: TimeControl;
  color: 'white' | 'black';
}

export interface TimeControl {
  type: 'fixed-depth' | 'fixed-time' | 'increment';
  baseTimeMs?: number;
  incrementMs?: number;
  maxTimeMs?: number;
  fixedDepth?: number;
}

export interface EngineMatchConfig {
  engineWhite: EngineConfig;
  engineBlack: EngineConfig;
  numGames: number;
  alternateColors: boolean;
  timeControl: TimeControl;
  openingBook?: boolean;
  maxMoves?: number;
  outputDir?: string;
  savePgns: boolean;
  quiet?: boolean;
}

export interface GameResult {
  gameNumber: number;
  whiteEngine: string;
  blackEngine: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  winner: 'white' | 'black' | 'draw' | 'ongoing';
  moves: number;
  durationMs: number;
  pgn: string;
  whiteStats: EngineGameStats;
  blackStats: EngineGameStats;
  terminationReason: TerminationReason;
}

export interface EngineGameStats {
  avgDepth: number;
  maxDepth: number;
  totalNodes: number;
  totalTimeMs: number;
  nps: number;
  avgTimePerMoveMs: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  bestMoves: number;
}

export type TerminationReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | '50-move-rule'
  | 'threefold-repetition'
  | 'max-moves-reached'
  | 'time-forfeit'
  | 'illegal-move'
  | 'engine-error';

// ============================================================================
// Engine Match Runner Class
// ============================================================================

export class EngineMatchRunner {
  private config: EngineMatchConfig;
  private results: GameResult[] = [];

  constructor(config: EngineMatchConfig) {
    // Create config with defaults, overriding with provided config
    const defaults: EngineMatchConfig = {
      engineWhite: config.engineWhite,
      engineBlack: config.engineBlack,
      numGames: config.numGames,
      alternateColors: true,
      timeControl: { type: 'fixed-time', baseTimeMs: 2000, incrementMs: 100 },
      openingBook: false,
      maxMoves: 300,
      outputDir: undefined,
      savePgns: true,
      quiet: false,
    };
    this.config = { ...defaults, ...config };
  }

  async runAll(): Promise<GameResult[]> {
    this.results = [];

    const totalGames = this.config.alternateColors
      ? this.config.numGames * 2
      : this.config.numGames;

    if (!this.config.quiet) {
      logger.info(`[EngineMatch] Starting ${totalGames} games`);
      logger.info(
        `[EngineMatch] White: ${this.config.engineWhite.name} (${this.config.engineWhite.personality})`
      );
      logger.info(
        `[EngineMatch] Black: ${this.config.engineBlack.name} (${this.config.engineBlack.personality})`
      );
    }

    for (let i = 0; i < totalGames; i++) {
      const gameNum = i + 1;

      let gameResult: GameResult;
      if (this.config.alternateColors && i % 2 === 1) {
        gameResult = await this.runSingleGame(this.config.engineBlack, this.config.engineWhite, gameNum);
      } else {
        gameResult = await this.runSingleGame(this.config.engineWhite, this.config.engineBlack, gameNum);
      }
      this.results.push(gameResult);
    }

    if (!this.config.quiet) this.printSummary();
    return this.results;
  }

  private async runSingleGame(
    whiteConfig: EngineConfig,
    blackConfig: EngineConfig,
    gameNumber: number
  ): Promise<GameResult> {
    const startTime = Date.now();
    const gameState = this.createInitialGameState();

    const baseTime = this.config.timeControl.baseTimeMs || 10000;
    const increment = this.config.timeControl.incrementMs || 0;
    const maxTimePerMove = this.config.timeControl.maxTimeMs || 10000;

    let whiteTime = baseTime;
    let blackTime = baseTime;

    const whiteStats = this.createEmptyStats();
    const blackStats = this.createEmptyStats();
    const moveHistory: Array<{
      from: { r: number; c: number };
      to: { r: number; c: number };
      promotion?: string;
    }> = [];
    let moveNumber = 1;
    let currentTurn: 'white' | 'black' = 'white';

    try {
      while (moveNumber <= (this.config.maxMoves || 300)) {
        const moveStartTime = Date.now();
        const isWhiteTurn = currentTurn === 'white';
        const engineConfig = isWhiteTurn ? whiteConfig : blackConfig;
        const timeRemaining = isWhiteTurn ? whiteTime : blackTime;

        if (timeRemaining <= 0) {
          return this.createResult(
            gameNumber,
            whiteConfig,
            blackConfig,
            isWhiteTurn ? '0-1' : '1-0',
            isWhiteTurn ? 'black' : 'white',
            'time-forfeit',
            moveNumber - 1,
            whiteStats,
            blackStats,
            moveHistory,
            Date.now() - startTime
          );
        }

        const timeAlloc = this.calculateAllocation({
          currentTurn,
          moveNumber,
          whiteTime,
          blackTime,
          increment,
          maxTimePerMove,
          hasOpeningBook: this.config.openingBook && moveNumber <= 20,
        });

        // Get move from engine
        const uiBoard = convertToUiBoard(gameState);
        const boardInt = convertBoardToInt(uiBoard);
        const color = currentTurn === 'white' ? 'white' : 'black';
        const personality = AI_PERSONALITIES[engineConfig.personality]?.wasmPersonality || 'NORMAL';
        const elo = engineConfig.elo || 2500;

        let engineResult: SearchResult | null = null;
        let move: MoveResult | null = null;

        try {
          // Use WASM for speed
          const result = await getBestMoveDetailed(
            uiBoard,
            color as 'white' | 'black',
            engineConfig.depth || 6,
            { elo, personality, maxTimeMs: timeAlloc.allocatedTimeMs, maxDepth: engineConfig.depth },
            moveNumber
          );
          engineResult = result;
          move = result?.move || null;
        } catch (engineErr) {
          logger.error('[EngineMatch] Engine error:', engineErr);
          return this.createResult(
            gameNumber,
            whiteConfig,
            blackConfig,
            isWhiteTurn ? '0-1' : '1-0',
            isWhiteTurn ? 'black' : 'white',
            'engine-error',
            moveNumber - 1,
            whiteStats,
            blackStats,
            moveHistory,
            Date.now() - startTime
          );
        }

        if (!move) {
          // No legal moves
          const inCheck = isInCheck(
            boardInt as number[] | Int8Array,
            isWhiteTurn ? COLOR_WHITE : COLOR_BLACK
          ) as boolean;
          if (inCheck) {
            return this.createResult(
              gameNumber,
              whiteConfig,
              blackConfig,
              isWhiteTurn ? '0-1' : '1-0',
              isWhiteTurn ? 'black' : 'white',
              'checkmate',
              moveNumber - 1,
              whiteStats,
              blackStats,
              moveHistory,
              Date.now() - startTime
            );
          } else {
            return this.createResult(
              gameNumber,
              whiteConfig,
              blackConfig,
              '1/2-1/2',
              'draw',
              'stalemate',
              moveNumber - 1,
              whiteStats,
              blackStats,
              moveHistory,
              Date.now() - startTime
            );
          }
        }

        // Apply move
        this.applyMove(gameState, move, currentTurn);

        // Record move
        moveHistory.push(
          this.createMoveRecord(
            move,
            currentTurn,
            moveNumber,
            engineResult,
            engineConfig.personality
          )
        );

        // Update stats
        const moveTime = Date.now() - moveStartTime;
        if (currentTurn === 'white') {
          this.updateStats(whiteStats, engineResult, moveTime);
          whiteTime -= moveTime;
          if (increment > 0) whiteTime += increment;
        } else {
          this.updateStats(blackStats, engineResult, moveTime);
          blackTime -= moveTime;
          if (increment > 0) blackTime += increment;
        }

        // Check draw
        if (moveHistory.length >= 100) {
          return this.createResult(
            gameNumber,
            whiteConfig,
            blackConfig,
            '1/2-1/2',
            'draw',
            '50-move-rule',
            moveNumber,
            whiteStats,
            blackStats,
            moveHistory,
            Date.now() - startTime
          );
        }

        // Switch turns
        currentTurn = currentTurn === 'white' ? 'black' : 'white';
        if (currentTurn === 'white') moveNumber++;
      }

      // Max moves reached
      return this.createResult(
        gameNumber,
        whiteConfig,
        blackConfig,
        '1/2-1/2',
        'draw',
        'max-moves-reached',
        moveNumber - 1,
        whiteStats,
        blackStats,
        moveHistory,
        Date.now() - startTime
      );
    } catch (err) {
      logger.error(`[EngineMatch] Game ${gameNumber} crashed:`, err);
      return this.createResult(
        gameNumber,
        whiteConfig,
        blackConfig,
        currentTurn === 'white' ? '0-1' : '1-0',
        currentTurn === 'white' ? 'black' : 'white',
        'engine-error',
        moveNumber - 1,
        whiteStats,
        blackStats,
        [],
        Date.now() - startTime
      );
    }
  }

  private createEmptyStats(): EngineGameStats {
    return {
      avgDepth: 0,
      maxDepth: 0,
      totalNodes: 0,
      totalTimeMs: 0,
      nps: 0,
      avgTimePerMoveMs: 0,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      bestMoves: 0,
    };
  }

  private createInitialGameState(): number[][] {
    const board: number[][] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    // 9x9 starting position (Capablanca chess): R N B Q K B N R A
    // Black pieces (negative values) on row 0
    // White pieces (positive values) on row 8
    const backRankPieces = [
      -4,
      -2,
      -3,
      -5,
      -6,
      -3,
      -2,
      -4,
      -7, // Black: rook, knight, bishop, queen, king, bishop, knight, rook, archbishop
      4,
      2,
      3,
      5,
      6,
      3,
      2,
      4,
      7, // White: rook, knight, bishop, queen, king, bishop, knight, rook, archbishop
    ];
    for (let c = 0; c < 9; c++) {
      board[0][c] = backRankPieces[c];
      board[1][c] = -1; // Black pawn
      board[7][c] = 1; // White pawn
      board[8][c] = backRankPieces[c + 9];
    }
    return board;
  }

  private calculateAllocation(params: {
    maxTimePerMove: number;
    hasOpeningBook?: boolean;
    currentTurn?: 'white' | 'black';
    moveNumber?: number;
    whiteTime?: number;
    blackTime?: number;
    increment?: number;
  }): { allocatedTimeMs: number } {
    // Simplified allocation
    const maxTime = Math.min(params.maxTimePerMove, params.hasOpeningBook ? 500 : 3000);
    return { allocatedTimeMs: Math.min(maxTime, params.maxTimePerMove) };
  }

  private applyMove(board: number[][], move: MoveResult, _turn: string): void {
    // Simplified - just for functionality
    if (move && move.from && move.to) {
      board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
      board[move.from.r][move.from.c] = 0;
    }
  }

  private createMoveRecord(
    move: MoveResult,
    turn: string,
    moveNumber: number,
    result: SearchResult | null,
    personality: string
  ): MoveRecord {
    return {
      moveNumber,
      color: turn,
      from: move.from,
      to: move.to,
      evalScore: result?.score,
      depth: result?.depth,
      nodes: result?.nodes,
      personality,
    };
  }

  private updateStats(
    stats: EngineGameStats,
    result: SearchResult | null,
    moveTimeMs: number
  ): void {
    if (!result) return;
    stats.totalNodes += result.nodes || 0;
    stats.totalTimeMs += moveTimeMs;
    stats.maxDepth = Math.max(stats.maxDepth, result.depth || 0);
    stats.avgDepth = (stats.avgDepth + (result.depth || 0)) / 2;
    stats.nps =
      stats.totalTimeMs > 0 ? Math.round(stats.totalNodes / (stats.totalTimeMs / 1000)) : 0;
  }

  private createResult(
    gameNumber: number,
    whiteConfig: EngineConfig,
    blackConfig: EngineConfig,
    result: string,
    winner: GameResult['winner'],
    terminationReason: TerminationReason,
    moves: number,
    whiteStats: EngineGameStats,
    blackStats: EngineGameStats,
    _moveHistory: Array<{
      from: { r: number; c: number };
      to: { r: number; c: number };
      promotion?: string;
    }>,
    durationMs: number
  ): GameResult {
    return {
      gameNumber,
      whiteEngine: whiteConfig.name,
      blackEngine: blackConfig.name,
      result: result as '1-0' | '0-1' | '1/2-1/2' | '*',
      winner,
      moves,
      durationMs,
      pgn: 'PGN placeholder',
      whiteStats,
      blackStats,
      terminationReason,
    };
  }

  private printSummary(): void {
    console.log('\n=== ENGINE MATCH SUMMARY ===');
    console.log(`Total games: ${this.results.length}`);
    const whiteWins = this.results.filter(r => r.winner === 'white').length;
    const blackWins = this.results.filter(r => r.winner === 'black').length;
    const draws = this.results.filter(r => r.winner === 'draw').length;
    console.log(`White wins: ${whiteWins} | Black wins: ${blackWins} | Draws: ${draws}`);
    const avgMoves = this.results.reduce((sum, r) => sum + r.moves, 0) / this.results.length;
    console.log(`Avg moves: ${avgMoves.toFixed(1)}`);
    const avgNps = this.results.reduce((s, r) => s + r.whiteStats.nps, 0) / this.results.length;
    console.log(`Avg NPS: ${(avgNps / 1000).toFixed(1)}k`);
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

export async function runEngineMatch(config: EngineMatchConfig): Promise<GameResult[]> {
  const runner = new EngineMatchRunner(config);
  return runner.runAll();
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: EngineMatchConfig = {
    engineWhite: { name: 'Engine-A', personality: 'balanced', elo: 2500, color: 'white' },
    engineBlack: { name: 'Engine-B', personality: 'aggressive', elo: 2400, color: 'black' },
    numGames: 2,
    alternateColors: true,
    timeControl: { type: 'fixed-time', baseTimeMs: 3000, incrementMs: 100, maxTimeMs: 5000 },
    savePgns: true,
    quiet: false,
  };

  await runEngineMatch(config);
}
