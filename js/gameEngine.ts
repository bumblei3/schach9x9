/**
 * gameEngine.ts
 *
 * Enthält die Spiellogik und Game-Klasse für Schach9x9
 * @module gameEngine
 */

import {
  BOARD_SIZE,
  PHASES,
  PIECE_VALUES,
  DEFAULT_TIME_CONTROL,
  DEFAULT_DIFFICULTY,
  AI_DELAY_MS,
  setBoardVariant,
  BOARD_VARIANTS,
  getCurrentBoardSize,
  BOARD_SHAPES,
  isBlockedCell,
  setCurrentBoardShape,
  type BoardShape,
  type TimeControl,
  type AIDifficulty,
  type Phase,
} from './config.js';
import { RulesEngine } from './RulesEngine.js';
// import { makeMove } from './ai/MoveGenerator.js';
import type { Player, Square, Piece } from './types/game.js';
export type { Player, Square, Piece };

export { BOARD_SIZE, PHASES, PIECE_VALUES, AI_DELAY_MS };

export type GameMode =
  | 'setup'
  | 'classic'
  | 'standard8x8'
  | 'puzzle'
  | 'campaign'
  | 'upgrade'
  | 'upgrade8x8'
  | 'cross';

export interface PieceWithMoved extends Piece {
  hasMoved: boolean;
}

export interface GameStats {
  totalMoves: number;
  playerMoves: number;
  playerBestMoves: number;
  captures: number;
  promotions: number;
  accuracies: number[];
}

export interface CapturedPieces {
  white: Piece[];
  black: Piece[];
}

export interface MoveHistoryEntry {
  from: Square;
  to: Square;
  piece?: Piece;
  captured?: Piece | null;
  promotion?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastling?: boolean;
  isEnPassant?: boolean;
  halfMoveClock?: number;
}

export interface LastMoveInfo {
  from: Square;
  to: Square;
  piece: Piece;
  isDoublePawnPush?: boolean;
}

export interface PuzzleState {
  id: string;
  solution: MoveHistoryEntry[];
  currentMoveIndex: number;
  solved: boolean;
  failed: boolean;
}

export interface AnalysisVariation {
  moves: MoveHistoryEntry[];
  score: number;
}

/**
 * Hauptklasse für die Spiellogik und den Spielzustand von Schach9x9
 */
export class Game {
  mode: GameMode;
  boardSize: number;
  boardShape: BoardShape;
  board: (PieceWithMoved | null)[][];
  phase: Phase;
  turn: Player;
  points: number;
  initialPoints: number;
  selectedShopPiece: string | null;
  whiteCorridor: number | null;
  blackCorridor: number | null;
  isAI: boolean;
  difficulty: AIDifficulty;
  moveHistory: MoveHistoryEntry[];
  redoStack: MoveHistoryEntry[];
  halfMoveClock: number;
  positionHistory: string[];
  capturedPieces: CapturedPieces;
  selectedSquare: Square | null;
  validMoves: Square[] | null;
  lastMoveHighlight: { from: Square; to: Square } | null;
  lastMove: LastMoveInfo | null;
  stats: GameStats;
  clockEnabled: boolean;
  timeControl: TimeControl;
  whiteTime: number;
  blackTime: number;
  clockInterval: ReturnType<typeof setInterval> | null;
  lastMoveTime: number;
  replayMode: boolean;
  replayPosition: number;
  savedGameState: unknown;
  isAnimating: boolean;
  bestMoves: MoveHistoryEntry[];
  drawOffered: boolean;
  drawOfferedBy: Player | null;
  analysisMode: boolean;
  analysisBasePosition: unknown;
  analysisVariations: AnalysisVariation[];
  continuousAnalysis: boolean;
  puzzleState: PuzzleState | null;
  rulesEngine: RulesEngine;
  mentorLevel: string;
  kiMentorEnabled: boolean;
  aiPersonality: string;

  constructor(initialPoints: number = 15, mode: GameMode = 'setup') {
    this.mode = mode;

    // Set board variant based on mode
    if (mode === 'standard8x8' || mode === 'upgrade8x8') {
      setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
    } else {
      setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
    }

    // Store board size as instance property
    this.boardSize = getCurrentBoardSize();
    this.boardShape = BOARD_SHAPES.STANDARD; // Default, may be overridden below
    setCurrentBoardShape(this.boardShape); // Sync to global for AI access

    this.board = Array(this.boardSize)
      .fill(null)
      .map(() => Array(this.boardSize).fill(null));

    if (this.mode === 'classic') {
      this.phase = PHASES.PLAY;
      this.setupClassicBoard();
    } else if (this.mode === 'standard8x8') {
      this.setupStandard8x8Board();
      this.phase = initialPoints > 0 ? PHASES.SETUP_WHITE_UPGRADES : PHASES.PLAY;
    } else if (this.mode === 'upgrade') {
      this.points = 25;
      this.initialPoints = 25;
      this.phase = PHASES.SETUP_WHITE_UPGRADES;
      this.setupClassicBoard();
    } else if (this.mode === 'upgrade8x8') {
      this.points = 15;
      this.initialPoints = 15;
      this.phase = PHASES.SETUP_WHITE_UPGRADES;
      this.setupStandard8x8Board();
    } else if (this.mode === 'cross') {
      // Cross-shaped board mode with setup phase
      this.phase = PHASES.SETUP_WHITE_KING;
      this.boardShape = BOARD_SHAPES.CROSS;
      setCurrentBoardShape(this.boardShape); // Sync to global for AI access
    } else {
      this.phase = PHASES.SETUP_WHITE_KING;
    }

    this.turn = 'white';
    this.points = initialPoints;
    this.initialPoints = initialPoints;
    this.selectedShopPiece = null;
    this.whiteCorridor = null;
    this.blackCorridor = null;
    this.isAI = true;
    this.difficulty = DEFAULT_DIFFICULTY;
    this.moveHistory = [];
    this.redoStack = [];
    this.halfMoveClock = 0;
    this.positionHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.selectedSquare = null;
    this.validMoves = null;
    this.lastMoveHighlight = null;
    this.lastMove = null;
    this.stats = {
      totalMoves: 0,
      playerMoves: 0,
      playerBestMoves: 0,
      captures: 0,
      promotions: 0,
      accuracies: [],
    };
    this.clockEnabled = false;
    this.timeControl = { ...DEFAULT_TIME_CONTROL };
    this.whiteTime = DEFAULT_TIME_CONTROL.base;
    this.blackTime = DEFAULT_TIME_CONTROL.base;
    this.clockInterval = null;
    this.lastMoveTime = Date.now();
    this.replayMode = false;
    this.replayPosition = -1;
    this.savedGameState = null;
    this.isAnimating = false;
    this.bestMoves = [];
    this.drawOffered = false;
    this.drawOfferedBy = null;
    this.analysisMode = false;
    this.analysisBasePosition = null;
    this.analysisVariations = [];
    this.continuousAnalysis = false;
    this.puzzleState = null;

    this.rulesEngine = new RulesEngine(this);

    // KI-Mentor (Coach)
    const savedMentorLevel =
      typeof localStorage !== 'undefined' ? localStorage.getItem('ki_mentor_level') : null;
    this.mentorLevel = savedMentorLevel || 'STANDARD';
    this.kiMentorEnabled = this.mentorLevel !== 'OFF';

    // AI Personality
    this.aiPersonality = 'balanced';
  }

  /**
   * Setup for 9x9 "Classic" mode (with extra queen columns)
   */
  setupClassicBoard(): void {
    const size = this.boardSize;
    // Setup Pawns
    for (let c = 0; c < size; c++) {
      this.board[1][c] = { type: 'p', color: 'black', hasMoved: false };
      this.board[size - 2][c] = { type: 'p', color: 'white', hasMoved: false };
    }

    // Setup Pieces: R N B A K C B N R (9 pieces for 9x9)
    const pieces: Piece['type'][] = ['r', 'n', 'b', 'a', 'k', 'c', 'b', 'n', 'r'];
    for (let c = 0; c < size; c++) {
      this.board[0][c] = { type: pieces[c], color: 'black', hasMoved: false };
      this.board[size - 1][c] = { type: pieces[c], color: 'white', hasMoved: false };
    }
  }

  /**
   * Setup for standard 8x8 chess
   */
  setupStandard8x8Board(): void {
    // Setup Pawns
    for (let c = 0; c < 8; c++) {
      this.board[1][c] = { type: 'p', color: 'black', hasMoved: false };
      this.board[6][c] = { type: 'p', color: 'white', hasMoved: false };
    }

    // Setup Pieces: R N B Q K B N R (standard chess)
    const pieces: Piece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { type: pieces[c], color: 'black', hasMoved: false };
      this.board[7][c] = { type: pieces[c], color: 'white', hasMoved: false };
    }
  }

  log(message: string): void {
    const logPanel = document.getElementById('log-panel');
    if (!logPanel) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  /**
   * Returns all LEGAL moves (handling check)
   */
  getValidMoves(r: number, c: number, piece: Piece): Square[] {
    const moves = this.rulesEngine.getValidMoves(r, c, piece);
    // Filter out blocked squares for cross-shaped board
    if (this.boardShape && this.boardShape !== BOARD_SHAPES.STANDARD) {
      return moves.filter(move => !isBlockedCell(move.r, move.c, this.boardShape));
    }
    return moves;
  }

  getPseudoLegalMoves(r: number, c: number, piece: Piece): Square[] {
    return this.rulesEngine.getPseudoLegalMoves(r, c, piece);
  }

  isSquareUnderAttack(r: number, c: number, attackerColor: Player): boolean {
    return this.rulesEngine.isSquareUnderAttack(r, c, attackerColor);
  }

  /**
   * Find the position of the king for a given color
   */
  findKing(color: Player): Square | null {
    return this.rulesEngine.findKing(color);
  }

  isInCheck(color: Player): boolean {
    return this.rulesEngine.isInCheck(color);
  }

  isCheckmate(color: Player): boolean {
    return this.rulesEngine.isCheckmate(color);
  }

  getAllLegalMoves(color: Player): { from: Square; to: Square }[] {
    const moves = this.rulesEngine.getAllLegalMoves(color);
    if (this.boardShape && this.boardShape !== BOARD_SHAPES.STANDARD) {
      return moves.filter(move => !isBlockedCell(move.to.r, move.to.c, this.boardShape));
    }
    return moves;
  }

  isStalemate(color: Player): boolean {
    return this.rulesEngine.isStalemate(color);
  }

  /**
   * Calculates estimated Elo based on move accuracy
   */
  getEstimatedElo(): number {
    if (this.stats.accuracies.length === 0) return 600;

    const midgameAccuracies = this.stats.accuracies.slice(5);
    const evaluationList = midgameAccuracies.length > 0 ? midgameAccuracies : this.stats.accuracies;

    const avgAccuracy = evaluationList.reduce((a, b) => a + b, 0) / evaluationList.length;

    const elo = 800 + (avgAccuracy - 50) * 32;
    return Math.max(400, Math.min(2800, Math.round(elo)));
  }

  /**
   * Generates a string hash for the current board state
   */
  getBoardHash(): string {
    let hash = '';
    const size = this.boardSize;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const piece = this.board[r][c];
        hash += piece ? `${piece.color[0]}${piece.type}` : '..';
      }
    }
    hash += this.turn[0];
    return hash;
  }

  /**
   * Execute a move on the board
   */
  executeMove(from: Square, to: Square): unknown {
    const piece = this.board[from.r][from.c];
    const captured = this.board[to.r][to.c];

    if (piece) {
      // Handle En Passant
      if (
        piece.type === 'p' &&
        from.c !== to.c &&
        !captured &&
        this.lastMove &&
        this.lastMove.isDoublePawnPush &&
        this.lastMove.to.c === to.c
      ) {
        // Remove the captured pawn
        const capturedPawnRow = from.r;
        this.board[capturedPawnRow][to.c] = null;
      }

      this.board[to.r][to.c] = piece;
      this.board[from.r][from.c] = null;
      (piece as PieceWithMoved).hasMoved = true;

      // Track last move for En Passant
      this.lastMove = {
        from: { r: from.r, c: from.c },
        to: { r: to.r, c: to.c },
        piece: piece,
        isDoublePawnPush: piece.type === 'p' && Math.abs(to.r - from.r) === 2,
      };
    }

    const undoInfo = {
      from,
      to,
      captured,
      piece,
    };

    this.moveHistory.push(undoInfo as unknown as MoveHistoryEntry);
    this.turn = this.turn === 'white' ? 'black' : 'white';

    return undoInfo;
  }
}

/**
 * Erstellt ein leeres 9x9-Schachbrett
 */
export function createEmptyBoard(): (Piece | null)[][] {
  const size = getCurrentBoardSize();
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
}
