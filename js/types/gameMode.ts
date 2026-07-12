/**
 * Game mode identifiers for Schach 9x9.
 * Single source of truth for the GameMode union. Keep this list in sync with
 * GAME_MODES in config.ts (which holds the runtime string values).
 */
export type GameMode =
  | 'setup'
  | 'classic'
  | 'standard8x8'
  | 'puzzle'
  | 'campaign'
  | 'upgrade'
  | 'upgrade8x8'
  | 'cross'
  | 'opening-trainer'
  | 'daily-puzzle';
