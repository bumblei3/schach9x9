/**
 * Zentrale Konfiguration für Schach 9x9
 * Enthält Konstanten für Spielregeln, UI und KI
 */

/**
 * Board Variants
 */
export const BOARD_VARIANTS = {
  SCHACH9X9: '9x9',
  STANDARD_8X8: '8x8',
} as const;

export type BoardVariant = (typeof BOARD_VARIANTS)[keyof typeof BOARD_VARIANTS];

/**
 * Board size for each variant
 */
const BOARD_SIZES: Record<BoardVariant, number> = {
  [BOARD_VARIANTS.SCHACH9X9]: 9,
  [BOARD_VARIANTS.STANDARD_8X8]: 8,
};

/**
 * Current active board variant (default: 9x9)
 */
let currentBoardVariant: BoardVariant = BOARD_VARIANTS.SCHACH9X9;

/**
 * Größe des Schachbretts (dynamisch basierend auf Variante)
 */
export let BOARD_SIZE = 9;

/**
 * Set the active board variant and update BOARD_SIZE
 */
export function setBoardVariant(variant: BoardVariant): void {
  if (BOARD_SIZES[variant]) {
    currentBoardVariant = variant;
    BOARD_SIZE = BOARD_SIZES[variant];
  }
}

/**
 * Get current board size
 */
export function getCurrentBoardSize(): number {
  return BOARD_SIZE;
}

/**
 * Board Shape Types
 */
export const BOARD_SHAPES = {
  STANDARD: 'standard',
  CROSS: 'cross',
} as const;

export type BoardShape = (typeof BOARD_SHAPES)[keyof typeof BOARD_SHAPES];

/**
 * Blocked squares for cross-shaped board (corners)
 * On a 9x9 board, the cross shape blocks the 3x3 corners
 *
 * Visual:
 *   ⬛ ⬛ ⬛ ✅ ✅ ✅ ⬛ ⬛ ⬛   (row 0)
 *   ⬛ ⬛ ⬛ ✅ ✅ ✅ ⬛ ⬛ ⬛   (row 1)
 *   ⬛ ⬛ ⬛ ✅ ✅ ✅ ⬛ ⬛ ⬛   (row 2)
 *   ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅   (row 3)
 *   ...
 */
const CROSS_BLOCKED_INDICES: number[] = [
  // Top-left corner (rows 0-2, cols 0-2)
  0, 1, 2, 9, 10, 11, 18, 19, 20,
  // Top-right corner (rows 0-2, cols 6-8)
  6, 7, 8, 15, 16, 17, 24, 25, 26,
  // Bottom-left corner (rows 6-8, cols 0-2)
  54, 55, 56, 63, 64, 65, 72, 73, 74,
  // Bottom-right corner (rows 6-8, cols 6-8)
  60, 61, 62, 69, 70, 71, 78, 79, 80,
];

export const CROSS_BLOCKED_SQUARES: Set<number> = new Set(CROSS_BLOCKED_INDICES);

/**
 * Check if a square index is blocked for current board shape
 * @param index - Square index (0-80 for 9x9)
 * @param shape - Board shape
 */
export function isBlockedSquare(index: number, shape: BoardShape = 'standard'): boolean {
  if (shape === BOARD_SHAPES.CROSS) {
    return CROSS_BLOCKED_SQUARES.has(index);
  }
  return false;
}

/**
 * Check if row/col is blocked for current board shape
 */
export function isBlockedCell(r: number, c: number, shape: BoardShape = 'standard'): boolean {
  if (shape === BOARD_SHAPES.CROSS) {
    const index = r * 9 + c;
    return CROSS_BLOCKED_SQUARES.has(index);
  }
  return false;
}

/**
 * Global board shape for AI access
 */
let currentBoardShape: BoardShape = BOARD_SHAPES.STANDARD;

export function getCurrentBoardShape(): BoardShape {
  return currentBoardShape;
}

export function setCurrentBoardShape(shape: BoardShape): void {
  currentBoardShape = shape;
}

/**
 * Get current board variant
 */
export function getCurrentBoardVariant(): BoardVariant {
  return currentBoardVariant;
}

/**
 * Spielphasen
 */
export const PHASES = {
  SETUP_WHITE_KING: 'SETUP_WHITE_KING',
  SETUP_BLACK_KING: 'SETUP_BLACK_KING',
  SETUP_WHITE_PIECES: 'SETUP_WHITE_PIECES',
  SETUP_BLACK_PIECES: 'SETUP_BLACK_PIECES',
  SETUP_WHITE_UPGRADES: 'SETUP_WHITE_UPGRADES',
  SETUP_BLACK_UPGRADES: 'SETUP_BLACK_UPGRADES',
  PLAY: 'PLAY',
  ANALYSIS: 'ANALYSIS',
  GAME_OVER: 'GAME_OVER',
} as const;

export type Phase = (typeof PHASES)[keyof typeof PHASES];

/**
 * Spielmodi
 */
export const GAME_MODES = {
  SETUP: 'setup', // Original mode with points and shop (9x9)
  CLASSIC: 'classic', // Fixed 9x9 setup
  STANDARD_8X8: 'standard8x8', // Standard 8x8 chess
  CAMPAIGN: 'campaign', // Story Mode
  UPGRADE: 'upgrade', // Troop Upgrade Mode
  UPGRADE_8X8: 'upgrade8x8', // 8x8 Upgrade Mode
} as const;

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

/**
 * Materialwerte für die KI-Bewertung
 */
export const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  j: 6, // Nightrider (Sliding Knight)
  a: 7, // Archbishop (Bishop + Knight)
  c: 8, // Chancellor (Rook + Knight) - Fixed from 9 to 8
  q: 9,
  e: 12, // Angel (Queen + Knight)
  k: 0, // King has no value for material count
};

/**
 * Materialwerte für die KI (skaliert für Integer-Arithmetik)
 */
export const AI_PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  j: 600, // Nightrider (Sliding Knight)
  q: 900,
  k: 20000,
  a: 650, // Archbishop (Bishop + Knight)
  c: 850, // Chancellor (Rook + Knight)
  e: 1220, // Angel (Queen + Knight)
};

/**
 * Shop piece configuration
 */
export interface ShopPieceConfig {
  points: number;
  symbol: string;
  name: string;
}

/**
 * Konfiguration für den Shop (Punkte, Symbole, Namen)
 */
export const SHOP_PIECES: Record<string, ShopPieceConfig> = {
  PAWN: { points: 1, symbol: 'p', name: 'Bauer' },
  KNIGHT: { points: 3, symbol: 'n', name: 'Springer' },
  BISHOP: { points: 3, symbol: 'b', name: 'Läufer' },
  ROOK: { points: 5, symbol: 'r', name: 'Turm' },
  ARCHBISHOP: { points: 7, symbol: 'a', name: 'Erzbischof' },
  QUEEN: { points: 9, symbol: 'q', name: 'Dame' },
  CHANCELLOR: { points: 8, symbol: 'c', name: 'Kanzler' },
  ANGEL: { points: 12, symbol: 'e', name: 'Engel' },
  NIGHTRIDER: { points: 6, symbol: 'j', name: 'Nachtreiter' },
};

/**
 * Time control configuration
 */
export interface TimeControl {
  base: number;
  increment: number;
}

/**
 * Standard-Zeitkontrolle (in Sekunden)
 */
export const DEFAULT_TIME_CONTROL: TimeControl = {
  base: 300, // 5 Minuten
  increment: 3, // 3 Sekunden Inkrement
};

/**
 * KI-Schwierigkeitsgrade
 */
export const AI_DIFFICULTIES = {
  BEGINNER: 'beginner',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert',
} as const;

export type AIDifficulty = (typeof AI_DIFFICULTIES)[keyof typeof AI_DIFFICULTIES];

export const DEFAULT_DIFFICULTY: AIDifficulty = AI_DIFFICULTIES.BEGINNER;

/**
 * Global search depth configuration for AI and Tutor
 */
export const AI_DEPTH_CONFIG = {
  [AI_DIFFICULTIES.BEGINNER]: 1,
  [AI_DIFFICULTIES.EASY]: 2,
  [AI_DIFFICULTIES.MEDIUM]: 3,
  [AI_DIFFICULTIES.HARD]: 4,
  [AI_DIFFICULTIES.EXPERT]: 5,
  // Note: Tutor depth is now dynamic (AI depth + 2)
} as const;

/**
 * Timing constants for game flow
 */
export const AI_DELAY_MS = 1000; // Delay before AI makes a move
export const AUTO_SAVE_INTERVAL = 5; // Auto-save every N moves

/**
 * Mentor level configuration
 */
export interface MentorLevelConfig {
  id: string;
  threshold: number;
  name: string;
}

/**
 * KI-Mentor Settings
 */
export const MENTOR_LEVELS: Record<string, MentorLevelConfig> = {
  STRICT: { id: 'STRICT', threshold: 50, name: 'Streng (Fehler & Patzer)' },
  STANDARD: { id: 'STANDARD', threshold: 200, name: 'Standard (Nur Patzer)' },
  OFF: { id: 'OFF', threshold: Infinity, name: 'Aus' },
};

export const MENTOR_SETTINGS = {
  FAST_DEPTH: 6, // Depth for quick pre-move analysis
} as const;

export const DEFAULT_MENTOR_LEVEL = 'STANDARD';
