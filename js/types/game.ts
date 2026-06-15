/**
 * Core game type definitions for Schach 9x9
 */
import type { MoveResult } from './aiEngine';

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'e' | 'a' | 'c' | 'j' | null;

export type Player = 'white' | 'black';
export type GamePhase = 'SETUP' | 'PLAY' | 'END';
export type Board = (Piece | null)[][];
export type GameMode = 'setup' | 'classic' | 'puzzle' | 'campaign' | 'standard8x8';

export interface Square {
  r: number;
  c: number;
}

export interface Piece {
  type: Exclude<PieceType, null>;
  color: Player;
  hasMoved?: boolean;
}

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

export interface GameState {
  board: (Piece | null)[][];
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

/**
 * Dynamically added properties on Game instance
 * These are set at runtime by various controllers
 */
export interface GameExtensions {
  tutorController?: {
    handlePlayerMove?: (_from: Square, _to: Square) => void;
    analyzePlayerMovePreExecution?: (_move: { from: Square; to: Square }) => Promise<unknown>;
    showBlunderWarning?: (_analysis: unknown, _callback: () => void) => void;
  };
  isTutorMove?: (_move: Square) => boolean;
  currentTheme?: string;
  log?: (_message: string) => void;
  getValidMoves?: (_r: number, _c: number, _piece: unknown) => Square[];
  calculateMaterialAdvantage?: (_color: Player) => number;
}

/**
 * Subset of Game properties consumed by UI/rendering/tutor modules.
 * Avoids `any` while not requiring the full Game class import.
 * All optional — modules only need a subset.
 */
/** Move record for promotion UI */
export interface MoveRecord {
  from: Square;
  to: Square;
  piece?: PieceType | Piece;
  captured?: PieceType | Piece | null;
  promotion?: PieceType | string;
}

/** Puzzle interface */
export interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  fen?: string;
  solution: Array<Move | MoveResult | { from: { r: number; c: number }; to: { r: number; c: number }; promotion?: string | PieceType; piece: PieceType }>;
}

/** Action button for modals */
export interface ModalAction {
  text: string;
  class?: string;
  callback?: () => void;
}

/** Game interface used by UI components (avoids circular deps) */
export interface GameLike {
  board: (Piece | null)[][];
  boardSize: number;
  boardShape: unknown;
  phase: string;
  turn: Player;
  isAI: boolean;
  isAnimating: boolean;
  replayMode: boolean;
  selectedSquare: Square | null;
  validMoves: Square[] | null;
  mode: string;
  lastMoveHighlight: { from: Square; to: Square; piece?: Piece } | null;
  isInCheck?(_color: Player): boolean;
  isSquareUnderAttack?: (_r: number, _c: number, _color: Player) => boolean;
  isTutorMove?: (_move: Square) => boolean;
  playerColor?: Player;
  whiteCorridor?: number | null;
  blackCorridor?: number | null;
  handleCellClick?: (_r: number, _c: number) => void;
  getValidMoves: (_r: number, _c: number, _piece: Piece) => Square[];
  log?: (_message: string) => void;
  points: number;
  tutorPoints?: number;
  moveHistory: Array<{ from: Square; to: Square; piece?: PieceType | Piece; captured?: PieceType | Piece | null; promotion?: PieceType | string; isCheck?: boolean; isCheckmate?: boolean; isCastling?: boolean; isEnPassant?: boolean; specialMove?: { type: string; rookFrom?: Square; rookTo?: Square; rookHadMoved?: boolean; capturedPawnPos?: Square } }>;
  // Tutor-specific (used by MoveAnalyzer)
  kiMentorEnabled?: boolean;
  mentorLevel?: string;
  lastEval?: number;
  bestMoves?: unknown[];
  tutorMode?: string;
  stats?: { accuracies: number[] };
  // Puzzle-specific
  capturedPieces?: { white: Piece[]; black: Piece[] };
  puzzleState?: PuzzleState | null;
  getAllLegalMoves?: (_color: Player) => { from: Square; to: Square }[];
  // Internal rendering state (added by renderBoard)
  _previousBoardState?: (Piece | null)[][];
  _forceFullRender?: boolean;
  // Allow additional properties for dynamic extensions
}
