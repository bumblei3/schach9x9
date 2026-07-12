/**
 * Core type definitions for Schach 9x9
 * Consolidated single source of truth for all shared interfaces
 */

import type { MoveResult } from '../aiEngine.js';
import type { TimeParams } from '../aiEngine.js';

// ============================================================================
// Basic Types
// ============================================================================

export type Player = 'white' | 'black';

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'e' | 'a' | 'c' | 'j' | null;

export type GamePhase = 'SETUP' | 'PLAY' | 'END';

export type GameMode = 'setup' | 'classic' | 'puzzle' | 'campaign' | 'standard8x8';

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

export interface GameState {
  board: Board;
  turn: Player;
  phase: GamePhase;
  mode: GameMode;
  moveHistory: Move[];
  selectedSquare: Square | null;
  validMoves: Square[];
  points: number;
  whiteKingPos: Square | null;
  blackKingPos: Square | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  halfMoveClock: number;
  fullMoveNumber: number;
}

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

export interface ShopItem {
  piece: PieceType;
  cost: number;
  available: boolean;
}

export interface CampaignLevel {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  completed: boolean;
  stars: number;
  maxStars: number;
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

export interface ModalOptions {
  title: string;
  message: string;
  buttons?: ModalButton[];
}

export interface ModalButton {
  text: string;
  class?: string;
  callback?: () => void;
}

export interface BoardRendererOptions {
  highlightLastMove?: boolean;
  highlightCheck?: boolean;
  showCoordinates?: boolean;
  animate?: boolean;
  pieceSkin?: PieceSkin;
  boardTheme?: BoardTheme;
}

export type BoardTheme = 'classic' | 'blue' | 'green' | 'wooden' | 'dark';
export type PieceSkin = 'classic' | 'modern' | 'pixel' | 'medieval';

export interface DragState {
  active: boolean;
  fromSquare: Square | null;
  element: HTMLElement | null;
}

export interface AnimationState {
  active: boolean;
  from: Square | null;
  to: Square | null;
  piece: Piece | null;
  startTime: number;
  duration: number;
}

export interface OverlayState {
  visible: boolean;
  type: OverlayType | null;
  data: unknown;
}

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

export interface SettingsState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  animationsEnabled: boolean;
  showCoordinates: boolean;
  showMoveHints: boolean;
  boardTheme: BoardTheme;
  pieceSkin: PieceSkin;
  clockFormat: 'digital' | 'analog';
  language: 'de' | 'en';
}

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

export interface AIConfig {
  depth: number;
  timeLimit: number;
  useOpeningBook: boolean;
  useTablebases: boolean;
  personality: AIPersonality;
  skillLevel?: number;
  threads?: number;
  hashSize?: number;
}

export interface SearchResult {
  bestMove: Move | null;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: Move[];
  stoppedEarly: boolean;
}

export interface EvaluationResult {
  score: number;
  details: {
    material: number;
    positional: number;
    kingSafety: number;
    pawnStructure: number;
    mobility: number;
  };
}

export interface TranspositionEntry {
  key: bigint;
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMove?: Move;
  age: number;
}

export interface OpeningBookEntry {
  moves: Array<{
    from: Square;
    to: Square;
    weight: number;
    games: number;
  }>;
  seenCount: number;
}

export interface AnalysisLine {
  moves: Move[];
  score: number;
  depth: number;
}

export interface ThreatInfo {
  square: Square;
  piece: Piece;
  attackers: Square[];
  value: number;
  type: 'direct' | 'xray' | 'discovered';
}

export interface OpportunityInfo {
  square: Square;
  target: Square;
  type: 'capture' | 'fork' | 'pin' | 'skewer' | 'mate';
  value: number;
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

export interface CampaignLevelRaw {
  id: string;
  name: string;
  description: string;
  difficulty: CampaignDifficulty;
  initialFen?: string;
  goals: CampaignGoal[];
  opponent: {
    personality: AIPersonality;
    elo?: number;
    timeLimit?: number;
  };
  rewards: {
    stars: number;
    unlocks?: string[];
  };
}

export interface LevelStats {
  attempts: number;
  wins: number;
  losses: number;
  draws: number;
  bestTime?: number;
  starsEarned: number;
}

export interface LevelProgress {
  levelId: string;
  stats: LevelStats;
  completed: boolean;
  unlocked: boolean;
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
