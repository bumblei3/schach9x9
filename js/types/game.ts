/**
 * Core game type definitions for Schach 9x9
 */

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
  fen: string;
  solution: Move[];
  currentMoveIndex: number;
  solved: boolean;
  failed: boolean;
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
}

/**
 * Dynamically added properties on Game instance
 * These are set at runtime by various controllers
 */
export interface GameExtensions {
  tutorController?: {
    handlePlayerMove?: (from: Square, to: Square) => void;
    analyzePlayerMovePreExecution?: (move: { from: Square; to: Square }) => Promise<unknown>;
    showBlunderWarning?: (analysis: unknown, callback: () => void) => void;
  };
  isTutorMove?: (move: Square) => boolean;
  currentTheme?: string;
  log?: (message: string) => void;
  getValidMoves?: (r: number, c: number, piece: unknown) => Square[];
  calculateMaterialAdvantage?: (color: Player) => number;
}

/**
 * Subset of Game properties consumed by UI/rendering/tutor modules.
 * Avoids `any` while not requiring the full Game class import.
 */
export interface GameLike {
  board: ({ type: string; color: Player; hasMoved?: boolean } | null)[][];
  boardSize: number;
  boardShape?: unknown;
  phase: string;
  turn: Player;
  isAI: boolean;
  isAnimating: boolean;
  replayMode: boolean;
  selectedSquare: Square | null;
  validMoves: Square[] | null;
  mode: string;
  lastMoveHighlight: { from: Square; to: Square } | null;
  isSquareUnderAttack?: (r: number, c: number, color: Player) => boolean;
  isTutorMove?: (move: Square) => boolean;
  playerColor?: Player;
  whiteCorridor?: number | null;
  blackCorridor?: number | null;
  handleCellClick?: (r: number, c: number) => void;
  getValidMoves: (r: number, c: number, piece: Piece) => Square[];
  log?: (message: string) => void;
}
