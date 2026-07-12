/**
 * Schach 9x9 Opening Book Trainer - Real Engine Self-Play
 * Uses the actual Schach9x9 engine (WASM/JS) for high-quality training games
 * Supports incremental training, weighted learning, and configurable depth
 */

import { logger } from '../logger.js';
import {
  getBestMoveDetailed,
  type MoveResult,
  type SearchResult,
  type TimeParams,
} from '../aiEngine.js';
import {
  getAllLegalMoves,
  isInCheck,
  COLOR_WHITE,
  COLOR_BLACK,
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
  PIECE_NIGHTRIDER,
} from '../ai/MoveGenerator.js';
import { TYPE_MASK, COLOR_MASK } from '../ai/BoardDefinitions.js';
import { OpeningBook } from '../ai/OpeningBook.js';
import type { Square, Piece } from '../gameEngine.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Local type definitions (matching OpeningBook internals)
// ============================================================================

interface BookMove {
  from: Square;
  to: Square;
  weight: number;
  games: number;
}

interface BookPosition {
  moves: BookMove[];
  seenCount: number;
}

interface BookData {
  positions: Record<string, BookPosition>;
  metadata?: {
    version: string;
    type: string;
    description: string;
    generatedAt: string;
    totalPositions: number;
    totalMoves: number;
    config: TrainerConfig;
  };
}

// ============================================================================
// Configuration
// ============================================================================

export interface TrainerConfig {
  numGames: number;
  depth: number;
  timePerMoveMs: number;
  openingMovesTracked: number;
  minPositionCount: number;
  maxMovesPerPosition: number;
  elo: number;
  personality: 'balanced' | 'aggressive' | 'solid' | 'gentle';
  inputBookPath?: string;
  outputBookPath: string;
  alternateColors: boolean;
  drawMoveLimit: number;
  quiet: boolean;
  help: boolean;
}

const DEFAULT_CONFIG: TrainerConfig = {
  numGames: 100,
  depth: 8,
  timePerMoveMs: 2000,
  openingMovesTracked: 25,
  minPositionCount: 2,
  maxMovesPerPosition: 5,
  elo: 2500,
  personality: 'balanced',
  outputBookPath: 'opening-book.json',
  alternateColors: true,
  drawMoveLimit: 200,
  quiet: false,
  help: false,
};

// ============================================================================
// Board utilities - using internal Int8Array format (same as engine)
// ============================================================================

type IntBoard = Int8Array;

const WP = PIECE_PAWN | COLOR_WHITE;
const WN = PIECE_KNIGHT | COLOR_WHITE;
const WB = PIECE_BISHOP | COLOR_WHITE;
const WR = PIECE_ROOK | COLOR_WHITE;
const WQ = PIECE_QUEEN | COLOR_WHITE;
const WK = PIECE_KING | COLOR_WHITE;
const WA = PIECE_ARCHBISHOP | COLOR_WHITE;

const BP = PIECE_PAWN | COLOR_BLACK;
const BN = PIECE_KNIGHT | COLOR_BLACK;
const BB = PIECE_BISHOP | COLOR_BLACK;
const BR = PIECE_ROOK | COLOR_BLACK;
const BQ = PIECE_QUEEN | COLOR_BLACK;
const BK = PIECE_KING | COLOR_BLACK;
const BA = PIECE_ARCHBISHOP | COLOR_BLACK;

export function createInitialBoard(): IntBoard {
  const board = new Int8Array(81).fill(PIECE_NONE);
  board[0] = BR;
  board[1] = BN;
  board[2] = BB;
  board[3] = BQ;
  board[4] = BK;
  board[5] = BB;
  board[6] = BN;
  board[7] = BR;
  board[8] = BA;
  for (let c = 0; c < 9; c++) board[9 + c] = BP;
  for (let c = 0; c < 9; c++) board[63 + c] = WP;
  board[72] = WR;
  board[73] = WN;
  board[74] = WB;
  board[75] = WQ;
  board[76] = WK;
  board[77] = WB;
  board[78] = WN;
  board[79] = WR;
  board[80] = WA;
  return board;
}

export function boardToUi(board: IntBoard): (Piece | null)[][] {
  const ui: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r * 9 + c];
      if (p !== PIECE_NONE) {
        const type = p & TYPE_MASK;
        const color = (p & COLOR_MASK) === COLOR_WHITE ? 'white' : 'black';
        let typeStr: Piece['type'];
        switch (type) {
          case PIECE_PAWN:
            typeStr = 'p';
            break;
          case PIECE_KNIGHT:
            typeStr = 'n';
            break;
          case PIECE_BISHOP:
            typeStr = 'b';
            break;
          case PIECE_ROOK:
            typeStr = 'r';
            break;
          case PIECE_QUEEN:
            typeStr = 'q';
            break;
          case PIECE_KING:
            typeStr = 'k';
            break;
          case PIECE_ARCHBISHOP:
            typeStr = 'a';
            break;
          case PIECE_CHANCELLOR:
            typeStr = 'c';
            break;
          case PIECE_ANGEL:
            typeStr = 'e';
            break;
          case PIECE_NIGHTRIDER:
            typeStr = 'j';
            break;
          default:
            typeStr = 'p';
        }
        ui[r][c] = { type: typeStr, color, hasMoved: false };
      }
    }
  }
  return ui;
}

export function applyMoveInt(board: IntBoard, move: MoveResult): void {
  const from = move.from.r * 9 + move.from.c;
  const to = move.to.r * 9 + move.to.c;
  board[to] = board[from];
  board[from] = PIECE_NONE;
}

export function isTerminalInt(
  board: IntBoard,
  color: 'white' | 'black'
): { terminal: boolean; result: 'win' | 'loss' | 'draw' | null } {
  const kingColor = color === 'white' ? COLOR_WHITE : COLOR_BLACK;
  const inCheckResult = isInCheck(board, kingColor);
  const legalMoves = getAllLegalMoves(board, color);

  if (legalMoves.length === 0) {
    return {
      terminal: true,
      result: inCheckResult ? (color === 'white' ? 'loss' : 'win') : 'draw',
    };
  }
  return { terminal: false, result: null };
}

export function getBoardHashInt(board: IntBoard, turn: 'white' | 'black'): string {
  let hash = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r * 9 + c];
      if (p !== PIECE_NONE) {
        const type = p & TYPE_MASK;
        const colorChar = (p & COLOR_MASK) === COLOR_WHITE ? 'w' : 'b';
        let typeChar: string;
        switch (type) {
          case PIECE_PAWN:
            typeChar = 'p';
            break;
          case PIECE_KNIGHT:
            typeChar = 'n';
            break;
          case PIECE_BISHOP:
            typeChar = 'b';
            break;
          case PIECE_ROOK:
            typeChar = 'r';
            break;
          case PIECE_QUEEN:
            typeChar = 'q';
            break;
          case PIECE_KING:
            typeChar = 'k';
            break;
          case PIECE_ARCHBISHOP:
            typeChar = 'a';
            break;
          case PIECE_CHANCELLOR:
            typeChar = 'c';
            break;
          case PIECE_ANGEL:
            typeChar = 'e';
            break;
          case PIECE_NIGHTRIDER:
            typeChar = 'j';
            break;
          default:
            typeChar = '?';
        }
        hash += colorChar + typeChar;
      } else {
        hash += '..';
      }
    }
  }
  hash += turn === 'white' ? 'w' : 'b';
  return hash;
}

// ============================================================================
// Engine Interface
// ============================================================================

interface EngineState {
  board: IntBoard;
  moveHistory: MoveRecord[];
  moveNumber: number;
  currentTurn: 'white' | 'black';
}

interface MoveRecord {
  from: Square;
  to: Square;
  moveNumber: number;
  color: 'white' | 'black';
  evalScore?: number;
  depth?: number;
  nodes?: number;
}

async function getEngineMove(
  board: IntBoard,
  turn: 'white' | 'black',
  depth: number,
  timeMs: number,
  elo: number,
  personality: string,
  moveNumber: number
): Promise<{ move: MoveResult | null; result: SearchResult | null }> {
  const uiBoard = boardToUi(board);
  const color = turn === 'white' ? 'white' : 'black';

  const timeParams: TimeParams = {
    elo,
    personality,
    maxTimeMs: timeMs,
    maxDepth: depth,
    timeLimitMs: timeMs,
  };

  try {
    const result = await getBestMoveDetailed(uiBoard, color, depth, timeParams, moveNumber);
    return { move: result?.move || null, result };
  } catch (err) {
    logger.error('[Trainer] Engine error:', err);
    return { move: null, result: null };
  }
}

// ============================================================================
// Trainer Class
// ============================================================================

export class OpeningBookTrainer {
  private config: TrainerConfig;
  private book: OpeningBook;
  private stats = {
    totalGames: 0,
    whiteWins: 0,
    blackWins: 0,
    draws: 0,
    totalPositions: 0,
    totalMovesTracked: 0,
  };

  constructor(config: Partial<TrainerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.book = new OpeningBook();
  }

  async loadExistingBook(): Promise<void> {
    if (this.config.inputBookPath && fs.existsSync(this.config.inputBookPath)) {
      const content = fs.readFileSync(this.config.inputBookPath, 'utf8');
      const bookData = JSON.parse(content) as BookData;
      this.book.load(bookData);
      this.stats.totalPositions = Object.keys(bookData.positions || {}).length;
      if (!this.config.quiet) {
        logger.info(`[Trainer] Loaded existing book: ${this.stats.totalPositions} positions`);
      }
    }
  }

  async runTraining(): Promise<BookData> {
    await this.loadExistingBook();

    const totalGames = this.config.alternateColors
      ? this.config.numGames * 2
      : this.config.numGames;
    const startTime = Date.now();

    if (!this.config.quiet) {
      logger.info(`[Trainer] Starting ${totalGames} training games`);
      logger.info(
        `[Trainer] Depth: ${this.config.depth}, Time/move: ${this.config.timePerMoveMs}ms`
      );
      logger.info(`[Trainer] Opening ply tracked: ${this.config.openingMovesTracked}`);
    }

    for (let i = 0; i < totalGames; i++) {
      const gameNum = i + 1;
      const swapColors = this.config.alternateColors && i % 2 === 1;

      await this.playTrainingGame(gameNum, swapColors);

      if (!this.config.quiet) {
        const elapsed = (Date.now() - startTime) / 1000;
        const avgTime = elapsed / gameNum;
        const eta = avgTime * (totalGames - gameNum);
        const etaStr = eta > 60 ? `${(eta / 60).toFixed(1)}m` : `${eta.toFixed(0)}s`;
        const pct = Math.floor((gameNum / totalGames) * 100);
        const bar =
          '\u2588'.repeat(Math.floor(pct / 2.5)) + '\u2591'.repeat(40 - Math.floor(pct / 2.5));
        process.stdout.write(`\r   [${bar}] ${pct}% (${gameNum}/${totalGames}) ETA: ${etaStr}  `);
      }
    }

    if (!this.config.quiet) {
      console.log('\n');
      this.printStats();
    }

    this.recalcWeightsFromGameResults();

    const bookData = this.finalizeBook();
    await this.saveBook(bookData);

    return bookData;
  }

  private async playTrainingGame(gameNum: number, swapColors: boolean): Promise<void> {
    const state: EngineState = {
      board: createInitialBoard(),
      moveHistory: [],
      moveNumber: 1,
      currentTurn: 'white',
    };

    try {
      while (state.moveNumber <= this.config.drawMoveLimit) {
        const { move, result } = await getEngineMove(
          state.board,
          state.currentTurn,
          this.config.depth,
          this.config.timePerMoveMs,
          this.config.elo,
          this.config.personality,
          state.moveNumber
        );

        if (!move) {
          const terminal = isTerminalInt(state.board, state.currentTurn);
          this.recordGameResult(state, terminal.result || 'draw', swapColors);
          return;
        }

        state.moveHistory.push({
          from: move.from,
          to: move.to,
          moveNumber: state.moveNumber,
          color: state.currentTurn,
          evalScore: result?.score,
          depth: result?.depth,
          nodes: result?.nodes,
        });

        applyMoveInt(state.board, move);

        if (state.moveHistory.length <= this.config.openingMovesTracked) {
          this.recordOpeningPosition(state, state.moveHistory.length - 1);
        }

        const nextTurn = state.currentTurn === 'white' ? 'black' : 'white';
        const terminal = isTerminalInt(state.board, nextTurn);
        if (terminal.terminal) {
          this.recordGameResult(state, terminal.result!, swapColors);
          return;
        }

        state.currentTurn = nextTurn;
        if (state.currentTurn === 'white') state.moveNumber++;
      }

      this.recordGameResult(state, 'draw', swapColors);
    } catch (err) {
      logger.error(`[Trainer] Game ${gameNum} crashed:`, err);
    }
  }

  private recordOpeningPosition(state: EngineState, moveIndex: number): void {
    const board = createInitialBoard();
    for (let i = 0; i <= moveIndex; i++) {
      applyMoveInt(board, {
        from: state.moveHistory[i].from,
        to: state.moveHistory[i].to,
        capture: false,
      });
    }

    const turn = state.moveHistory[moveIndex].color;
    const hash = getBoardHashInt(board, turn);
    const move = state.moveHistory[moveIndex];

    if (!this.book.data.positions[hash]) {
      this.book.data.positions[hash] = { moves: [], seenCount: 0 };
    }
    const pos = this.book.data.positions[hash];
    pos.seenCount++;

    const existing = pos.moves.find(
      (m: BookMove) =>
        m.from.r === move.from.r &&
        m.from.c === move.from.c &&
        m.to.r === move.to.r &&
        m.to.c === move.to.c
    );

    if (existing) {
      existing.games++;
    } else {
      pos.moves.push({
        from: move.from,
        to: move.to,
        weight: 1,
        games: 1,
      });
    }
  }

  private recordGameResult(
    state: EngineState,
    result: 'win' | 'loss' | 'draw',
    swapColors: boolean
  ): void {
    const gameWinner = swapColors
      ? result === 'win'
        ? 'loss'
        : result === 'loss'
          ? 'win'
          : 'draw'
      : result;

    if (gameWinner === 'win') this.stats.whiteWins++;
    else if (gameWinner === 'loss') this.stats.blackWins++;
    else this.stats.draws++;
    this.stats.totalGames++;

    const moveHistory = state.moveHistory.map(m => ({
      from: m.from,
      to: m.to,
      piece: 'p' as const,
    }));

    const initialBoard = boardToUi(createInitialBoard());
    const playerColor = swapColors ? 'black' : 'white';
    this.book.applyGameResult(moveHistory, playerColor, gameWinner, initialBoard);
  }

  private recalcWeightsFromGameResults(): void {
    for (const hash in this.book.data.positions) {
      const pos = this.book.data.positions[hash];
      if (pos.moves.length > 1) {
        const totalWeight = pos.moves.reduce((sum: number, m: BookMove) => sum + m.weight, 0);
        if (totalWeight > 0) {
          pos.moves.forEach((m: BookMove) => {
            m.weight = Math.round((m.weight / totalWeight) * 100);
          });
        }
        pos.moves.sort((a: BookMove, b: BookMove) => b.weight - a.weight);
      }
    }
  }

  private finalizeBook(): BookData {
    const filtered: Record<string, BookPosition> = {};
    let keptPositions = 0;
    let keptMoves = 0;

    for (const [hash, pos] of Object.entries(this.book.data.positions)) {
      if (pos.seenCount >= this.config.minPositionCount) {
        const moves = pos.moves.slice(0, this.config.maxMovesPerPosition);
        if (moves.length > 0) {
          filtered[hash] = { moves, seenCount: pos.seenCount };
          keptPositions++;
          keptMoves += moves.length;
        }
      }
    }

    this.stats.totalPositions = keptPositions;
    this.stats.totalMovesTracked = keptMoves;

    return {
      positions: filtered,
      metadata: {
        version: '3.0',
        type: 'self-play-engine',
        description: `Generated from ${this.stats.totalGames} engine self-play games`,
        generatedAt: new Date().toISOString(),
        totalPositions: keptPositions,
        totalMoves: keptMoves,
        config: {
          numGames: this.config.numGames,
          depth: this.config.depth,
          timePerMoveMs: this.config.timePerMoveMs,
          openingMovesTracked: this.config.openingMovesTracked,
          minPositionCount: this.config.minPositionCount,
          maxMovesPerPosition: this.config.maxMovesPerPosition,
          elo: this.config.elo,
          personality: this.config.personality,
          inputBookPath: this.config.inputBookPath,
          outputBookPath: this.config.outputBookPath,
          alternateColors: this.config.alternateColors,
          drawMoveLimit: this.config.drawMoveLimit,
          quiet: this.config.quiet,
        } as TrainerConfig,
      },
    };
  }

  private async saveBook(bookData: BookData): Promise<void> {
    const outputPath = path.resolve(this.config.outputBookPath);
    fs.writeFileSync(outputPath, JSON.stringify(bookData, null, 2));
    if (!this.config.quiet) {
      logger.info(`[Trainer] Book saved to: ${outputPath}`);
    }
  }

  private printStats(): void {
    console.log('\n\uD83D\uDCCA Training Complete:');
    console.log(`   Games: ${this.stats.totalGames}`);
    console.log(
      `   White wins: ${this.stats.whiteWins} (${((this.stats.whiteWins / this.stats.totalGames) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Black wins: ${this.stats.blackWins} (${((this.stats.blackWins / this.stats.totalGames) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Draws: ${this.stats.draws} (${((this.stats.draws / this.stats.totalGames) * 100).toFixed(1)}%)`
    );
    console.log(`   Positions in book: ${this.stats.totalPositions}`);
    console.log(`   Total moves tracked: ${this.stats.totalMovesTracked}`);
  }
}

// ============================================================================
// CLI Argument Parsing (pure, testable)
// ============================================================================

/**
 * Parse CLI arguments into a partial TrainerConfig.
 * Pure function (no I/O) so it can be unit-tested in isolation from `main`.
 */
export function parseCliArgs(args: string[]): Partial<TrainerConfig> {
  const config: Partial<TrainerConfig> = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--games':
        config.numGames = parseInt(args[++i], 10);
        break;
      case '--depth':
        config.depth = parseInt(args[++i], 10);
        break;
      case '--time':
        config.timePerMoveMs = parseInt(args[++i], 10);
        break;
      case '--opening-plies':
        config.openingMovesTracked = parseInt(args[++i], 10);
        break;
      case '--min-count':
        config.minPositionCount = parseInt(args[++i], 10);
        break;
      case '--max-moves':
        config.maxMovesPerPosition = parseInt(args[++i], 10);
        break;
      case '--elo':
        config.elo = parseInt(args[++i], 10);
        break;
      case '--personality':
        config.personality = args[++i] as TrainerConfig['personality'];
        break;
      case '--input':
        config.inputBookPath = args[++i];
        break;
      case '--output':
        config.outputBookPath = args[++i];
        break;
      case '--no-alternate':
        config.alternateColors = false;
        break;
      case '--quiet':
        config.quiet = true;
        break;
      case '--help':
        config.help = true;
        break;
    }
  }

  return config;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log('\n🤖 Schach 9x9 Opening Book Trainer (Real Engine)');
  console.log('===================================================\n');

  const args = process.argv.slice(2);
  const config = parseCliArgs(args);

  if (config.help) {
    console.log('\nUsage: npx tsx js/utils/OpeningBookTrainer.ts [options]\n');
    console.log('Options:');
    console.log('  --games <n>              Number of games per color (default: 100)');
    console.log('  --depth <n>              Search depth (default: 8)');
    console.log('  --time <ms>              Time per move in ms (default: 2000)');
    console.log('  --opening-plies <n>      Ply to track in opening (default: 25)');
    console.log('  --min-count <n>          Min games per position (default: 2)');
    console.log('  --max-moves <n>          Max moves per position (default: 5)');
    console.log('  --elo <n>                Engine Elo (default: 2500)');
    console.log('  --personality <name>     balanced|aggressive|solid|gentle (default: balanced)');
    console.log('  --input <file>           Existing book to extend');
    console.log('  --output <file>          Output book path (default: opening-book.json)');
    console.log("  --no-alternate           Don't swap colors");
    console.log('  --quiet                  Suppress progress output');
    console.log('  --help                   Show this help\n');
    process.exit(0);
  }

  const trainer = new OpeningBookTrainer(config);
  await trainer.runTraining();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('[Trainer] Fatal error:', err);
    process.exit(1);
  });
}
