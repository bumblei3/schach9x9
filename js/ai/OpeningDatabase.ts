/**
 * Database of board hashes mapped to opening names.
 */

export const OPENING_NAMES: Record<string, string> = {
  // Opening Patterns for 9x9 (Using specific piece layouts)
  '9x9_SYMMETRIC': 'Symmetrische Aufstellung',
  '9x9_OFFENSIVE': 'Offensive Formation',
  '9x9_DEFENSIVE': 'Defensive Formation',
  '9x9_WINGS': 'Flügel-Angriff',

  // Standard 8x8 Hashes (Placeholder for actual hashes)
  // These hashes would be generated using game.getBoardHash()
  // Example for Standard 8x8 starting position (White to move):
  'brbnbbbqbkbbbbnbbrbpbpbpbpbpbpbpbpbp................................................................................wpwpwpwpwpwpwpwpwrwnwbwqwkwbwnwrww':
    'Grundstellung',

  // Sicilian Defense (1. e4 c5)
  'brbnbbbqbkbbbbnbbrbpbpbpbpbp..bpbpbp....................wp..................wpwpwp..wpwpwpwpwrwnwbwqwkwbwnwrwb':
    'Sizilianische Verteidigung',

  // French Defense (1. e4 e6)
  'brbnbbbqbkbbbbnbbrbpbpbp..bpbpbpbpbp....................wp..................wpwpwp..wpwpwpwpwrwnwbwqwkwbwnwrwb':
    'Französische Verteidigung',

  // Italian Game (1. e4 e5 2. Nf3 Nc6 3. Bc4)
  'br.bqbkbbbbnbbrbpbpbp..bpbpbpbpbp....bn..................wb......wp..........wpwpwp..wpwpwpwpwr.n.wqwkwbwnwrww':
    'Italienische Partie',
};

/**
 * Gets the name of the opening for the current board hash.
 * @param {string} hash - The board hash
 * @returns {string|null} The opening name or null if unknown
 */
export function getOpeningName(hash: string): string | null {
  // Check for direct matches
  if (OPENING_NAMES[hash]) return OPENING_NAMES[hash];

  // Basic pattern matching for 9x9 could be added here

  return null;
}
