/**
 * Core type definitions for Schach 9x9
 * Consolidated single source of truth for all shared interfaces
 */

import type { MoveResult } from '../aiEngine.js';
import type { TimeParams } from '../aiEngine.js';
import type { GameMode } from './gameMode.js';
export type { GameMode };

export type Player = 'white' | 'black';

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'e' | 'a' | 'c' | 'j' | null;

export type GamePhase = 'SETUP' | 'PLAY' | 'END';

export type BoardShape = 'standard' | 'cross';

export interface Square {
  r: number;
  c: number;
}

export interface Piece {
  type: Exclude<PieceType, null>;
  color: Player;
  hasMoved?: boolean;
}

export type Board = (Piece | null)[][];

// ============================================================================
// Move Definitions
// ============================================================================

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastling?: boolean;
  isEnPassant?: boolean;
}

/** Special move details for castling, promotion, en passant */
export interface SpecialMove {
  type: 'castling' | 'promotion' | 'enPassant' | string;
  // Castling
  rookFrom?: Square;
  rookTo?: Square;
  rookHadMoved?: boolean;
  isKingside?: boolean;
  rookType?: string;
  // Promotion
  promotedTo?: PieceType | string;
  // En passant
  capturedPawnPos?: Square;
  capturedPawn?: Piece | { color: string } | null;
  capturedPawnAfterMove?: Piece | null;
}

/** Move record used by UI/history (extends Move with optional fields) */
export interface MoveRecord {
  from: Square;
  to: Square;
  piece?: PieceType | Piece;
  captured?: PieceType | Piece | null;
  promotion?: PieceType | string;
  evalScore?: number;
  score?: number;
  timeUsed?: number;
  specialMove?: SpecialMove;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastling?: boolean;
  isEnPassant?: boolean;
}

// ============================================================================
// Game State & Extensions
// ============================================================================

export interface CapturedPieces {
  white: Piece[];
  black: Piece[];
}

export interface GameStats {
  whitePoints: number;
  blackPoints: number;
  whiteMaterial: number;
  blackMaterial: number;
  moveCount: number;
  whiteTime: number;
  blackTime: number;
  clockEnabled: boolean;
  timeControl: { base: number; increment: number };
}

export interface PuzzleState {
  id: string;
  fen?: string;
  solution: Move[];
  currentMoveIndex: number;
  solved: boolean;
  failed: boolean;
  active: boolean;
  puzzleId?: string;
}

export interface Statistics {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  totalMoves: number;
  averageGameLength: number;
  puzzlesSolved: number;
  bestWinStreak: number;
  currentWinStreak: number;
  playerMoves?: number;
  playerBestMoves?: number;
  promotions?: number;
  captures?: { white: number; black: number };
}

/** Extension methods dynamically added to Game instance */
export interface GameExtensions {
  tutorController?: {
    handlePlayerMove?: (_from: Square, _to: Square) => void;
    analyzePlayerMovePreExecution?: (_move: { from: Square; to: Square }) => Promise<unknown>;
    showBlunderWarning?: (_analysis: unknown, _callback: () => void) => void;
  };
  isTutorMove?: (_from: Square, _to: Square) => boolean;
  currentTheme?: string;
  log?: (_message: string) => void;
  getValidMoves?: (_r: number, _c: number, _piece: unknown) => Square[];
  calculateMaterialAdvantage?: (_color: Player) => number;
}

// ============================================================================
// UI Types
// ============================================================================

export interface ToastOptions {
  message: string;
  duration?: number;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface ModalButton {
  text: string;
  class?: string;
  callback?: () => void;
}

export type BoardTheme = 'classic' | 'blue' | 'green' | 'wooden' | 'dark';
export type PieceSkin = 'classic' | 'modern' | 'pixel' | 'medieval';

export type OverlayType =
  | 'promotion'
  | 'puzzle'
  | 'tutor'
  | 'gameOver'
  | 'drawOffer'
  | 'settings'
  | 'shop'
  | 'campaign'
  | 'analysis'
  | 'talentTree'
  | 'openingBook';

// ============================================================================
// GameLike Interface (for UI/rendering modules - avoids circular deps)
// ============================================================================

/**
 * Subset of Game properties consumed by UI/rendering/tutor modules.
 * Avoids `any` while not requiring the full Game class import.
 * All optional — modules only need a subset.
 */
export interface GameLike {
  // Board
  board: Board;
  boardSize: number;
  boardShape: BoardShape | undefined;
  // Phase & Turn
  phase: string;
  turn: Player;
  // AI & Animation
  isAI: boolean;
  isAnimating: boolean;
  replayMode: boolean;
  // Selection & Moves
  selectedSquare: Square | null;
  validMoves: Square[] | null;
  mode: string;
  // Last move
  lastMoveHighlight: { from: Square; to: Square; piece?: Piece } | null;
  // Check detection
  isInCheck?: (_color: Player) => boolean;
  isSquareUnderAttack?: (_r: number, _c: number, _color: Player) => boolean;
  // Tutor
  isTutorMove?: (_from: Square, _to: Square) => boolean;
  playerColor?: Player;
  // Setup corridors
  whiteCorridor?: number | null;
  blackCorridor?: number | null;
  // Core handlers
  handleCellClick?: (_r: number, _c: number) => void;
  getValidMoves: (_r: number, _c: number, _piece: Piece) => Square[];
  log?: (_message: string) => void;
  // Points & History
  points: number;
  tutorPoints?: number;
  moveHistory: MoveRecord[];
  // Tutor-specific
  kiMentorEnabled?: boolean;
  mentorLevel?: string;
  lastEval?: number;
  bestMoves?: unknown[];
  tutorMode?: string;
  stats?: { accuracies: number[] };
  // Puzzle-specific
  capturedPieces?: CapturedPieces;
  puzzleState?: PuzzleState | null;
  getAllLegalMoves?: (_color: Player) => { from: Square; to: Square }[];
  // Shop
  selectedShopPiece?: string | null;
  // Campaign
  startCampaignLevel?: (_levelId: string) => void;
  // Internal rendering state
  _previousBoardState?: Board;
  _forceFullRender?: boolean;
  // Extensions
}

// ============================================================================
// GameController Interface (for TimeManager, PuzzleMenu, etc.)
// ============================================================================

export interface GameControllerInterface {
  saveGameToStatistics?: (_result: string, _color: Player) => void;
  startPuzzleMode?: (_index?: number) => void;
  loadPuzzle?: (_index: number) => void;
  startCampaignLevel?: (_levelId: string) => void;
  offerDraw?: () => void;
  acceptDraw?: () => void;
  resign?: (_color: Player) => void;
  handleCellClick?: (_r: number, _c: number) => void;
  getValidMoves?: (_r: number, _c: number, _piece: Piece) => Square[];
  log?: (_message: string) => void;
}

// ============================================================================
// AI Types
// ============================================================================

export type AIPersonality = 'balanced' | 'aggressive' | 'defensive' | 'tactical' | 'positional';

export interface SearchResult {
  bestMove: Move | null;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: Move[];
  stoppedEarly: boolean;
}

export interface ThreatInfo {
  square: Square;
  piece: Piece;
  attackers: Square[];
  value: number;
  type: 'direct' | 'xray' | 'discovered';
}

// ============================================================================
// Campaign Types
// ============================================================================

export type CampaignDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface CampaignGoal {
  type: 'win' | 'draw' | 'survive' | 'capture' | 'promote' | 'checkmate';
  target?: unknown;
  description: string;
}

export interface LevelStats {
  attempts: number;
  wins: number;
  losses: number;
  draws: number;
  bestTime?: number;
  starsEarned: number;
}

// ============================================================================
// Puzzle Types
// ============================================================================

export interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  fen?: string;
  solution: Array<
    | Move
    | MoveResult
    | {
        from: { r: number; c: number };
        to: { r: number; c: number };
        promotion?: PieceType;
        piece: PieceType;
      }
  >;
}

// ============================================================================
// Opening Book Trainer Types
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
}

export interface BookMove {
  from: Square;
  to: Square;
  weight: number;
  games: number;
}

export interface BookPosition {
  moves: BookMove[];
  seenCount: number;
}

export interface BookData {
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
// Modal Action
// ============================================================================

export interface ModalAction {
  text: string;
  class?: string;
  callback?: () => void;
}

// Re-export commonly used types
export type { MoveResult, TimeParams };

// Global Window extensions
declare global {
  interface Window {
    updateTutorRecommendations?: (_game: unknown) => void;
  }
}
