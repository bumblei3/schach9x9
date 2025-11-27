/**
 * Zentrale Konfiguration für Schach 9x9
 * Enthält Konstanten für Spielregeln, UI und KI
 */

/**
 * Größe des Schachbretts (9x9 Felder)
 * @type {number}
 */
export const BOARD_SIZE = 9;

/**
 * Spielphasen
 * @enum {string}
 */
export const PHASES = {
  SETUP_WHITE_KING: 'SETUP_WHITE_KING',
  SETUP_BLACK_KING: 'SETUP_BLACK_KING',
  SETUP_WHITE_PIECES: 'SETUP_WHITE_PIECES',
  SETUP_BLACK_PIECES: 'SETUP_BLACK_PIECES',
  PLAY: 'PLAY',
  ANALYSIS: 'ANALYSIS',
  GAME_OVER: 'GAME_OVER',
};

/**
 * Materialwerte für die KI-Bewertung
 * @type {Object.<string, number>}
 */
export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  a: 7, // Archbishop (Bishop + Knight)
  c: 9, // Chancellor (Rook + Knight)
  q: 9,
  k: 0, // King has no value for material count
};

/**
 * Materialwerte für die KI (skaliert für Integer-Arithmetik)
 */
export const AI_PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
  a: 650, // Archbishop (Bishop + Knight)
  c: 850, // Chancellor (Rook + Knight)
};

/**
 * Konfiguration für den Shop (Punkte, Symbole, Namen)
 * @type {Object}
 */
export const SHOP_PIECES = {
  PAWN: { points: 1, symbol: 'p', name: 'Bauer' },
  KNIGHT: { points: 3, symbol: 'n', name: 'Springer' },
  BISHOP: { points: 3, symbol: 'b', name: 'Läufer' },
  ROOK: { points: 5, symbol: 'r', name: 'Turm' },
  ARCHBISHOP: { points: 7, symbol: 'a', name: 'Erzbischof' },
  QUEEN: { points: 9, symbol: 'q', name: 'Dame' },
  CHANCELLOR: { points: 8, symbol: 'c', name: 'Kanzler' },
};

/**
 * Standard-Zeitkontrolle (in Sekunden)
 */
export const DEFAULT_TIME_CONTROL = {
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
};

export const DEFAULT_DIFFICULTY = AI_DIFFICULTIES.MEDIUM;
