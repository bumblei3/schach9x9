/**
 * Database of board hashes mapped to opening names with ECO codes and statistics.
 * 
 * ECO Codes (Encyclopaedia of Chess Openings):
 * A00-A99: Flank Openings (English, Reti, etc.)
 * B00-B99: Semi-Open Games (Sicilian, Caro-Kann, etc.)
 * C00-C99: Open Games (Italian, Ruy Lopez, etc.)
 * D00-D99: Closed Games (Queen's Gambit, etc.)
 * E00-E99: Indian Systems (King's Indian, Nimzo, etc.)
 * 
 * For 9x9: Extended with custom opening patterns
 */

export interface OpeningEntry {
  name: string;
  eco: string;
  category: string;
  popularity: number;    // 0-100 relative popularity
  whiteWinRate: number;  // 0-100
  blackWinRate: number;  // 0-100
  drawRate: number;      // 0-100
  avgElo: number;        // Average Elo of players using this
  moves: string[];       // First few moves in algebraic notation
  description: string;   // Short description
}

export const OPENING_DATABASE: Record<string, OpeningEntry> = {
  // ==========================================
  // STARTING POSITION
  // ==========================================
  'brbnbbbqbkbbbbnbbrbpbpbpbpbpbpbpbpbp................................................................................wpwpwpwpwpwpwpwpwrwnwbwqwkwbwnwrww': {
    name: 'Grundstellung',
    eco: 'A00',
    category: 'Starting Position',
    popularity: 100,
    whiteWinRate: 38,
    blackWinRate: 32,
    drawRate: 30,
    avgElo: 2500,
    moves: ['1. e4', '1. d4', '1. Nf3', '1. c4'],
    description: 'Ausgangsposition. Weiß hat die Initiative.',
  },

  // ==========================================
  // OPEN GAMES (C00-C99) - 1. e4 e5
  // ==========================================
  // Italian Game (1. e4 e5 2. Nf3 Nc6 3. Bc4) - C50-C59
  'br.bqbkbbbbnbbrbpbpbp..bpbpbpbpbp....bn..................wb......wp..........wpwpwp..wpwpwpwpwr.n.wqwkwbwnwrww': {
    name: 'Italienische Partie',
    eco: 'C50',
    category: 'Open Game',
    popularity: 85,
    whiteWinRate: 36,
    blackWinRate: 34,
    drawRate: 30,
    avgElo: 2400,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bc4'],
    description: 'Klassisch und prinzipientreu. Weiß entwickelt schnell und zielt auf f7.',
  },

  // Giuoco Piano (1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5) - C50
  // Using placeholder hash for position after 3...Bc5
  'br.bqbkbbbbnbbrbpbpbp..bpbpbpbpbp....bn..................wb......wp..........wpwpwp..wpwpwpwpwr.n.wqwkwbwnwrwwBc5': {
    name: 'Giuoco Piano',
    eco: 'C50',
    category: 'Open Game',
    popularity: 45,
    whiteWinRate: 35,
    blackWinRate: 35,
    drawRate: 30,
    avgElo: 2300,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bc4 Bc5'],
    description: 'Friedliche Entwicklung. Harmonie und Strategie über Taktik.',
  },

  // Evans Gambit (1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4) - C51-C52
  '...': {
    name: 'Evans-Gambit',
    eco: 'C51',
    category: 'Gambit',
    popularity: 15,
    whiteWinRate: 42,
    blackWinRate: 38,
    drawRate: 20,
    avgElo: 2450,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bc4 Bc5', '4. b4'],
    description: 'Aggressives Gambit. Weiß opfert einen Bauern für Entwicklung und Initiative.',
  },

  // Two Knights Defense (1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6) - C55-C59
  '...': {
    name: 'Zweispringerspiel',
    eco: 'C57',
    category: 'Open Game',
    popularity: 60,
    whiteWinRate: 34,
    blackWinRate: 37,
    drawRate: 28,
    avgElo: 2400,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bc4 Nf6'],
    description: 'Schwarz greift sofort e4 an. Scharf und taktisch.',
  },

  // Ruy Lopez (Spanish Game) - C60-C99
  '...': {
    name: 'Spanische Partie (Ruy Lopez)',
    eco: 'C70',
    category: 'Open Game',
    popularity: 90,
    whiteWinRate: 38,
    blackWinRate: 32,
    drawRate: 30,
    avgElo: 2600,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bb5'],
    description: 'Meisteröffnung. Weiß drückt auf c6 und kontrolliert d5.',
  },

  // Berlin Defense (1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6) - C67
  '...': {
    name: 'Berliner Verteidigung',
    eco: 'C67',
    category: 'Open Game',
    popularity: 40,
    whiteWinRate: 30,
    blackWinRate: 25,
    drawRate: 45,
    avgElo: 2700,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bb5 Nf6'],
    description: 'Solide und remisreich. Populär auf höchstem Niveau.',
  },

  // Scotch Game (1. e4 e5 2. Nf3 Nc6 3. d4) - C45
  '...': {
    name: 'Schottische Partie',
    eco: 'C45',
    category: 'Open Game',
    popularity: 40,
    whiteWinRate: 37,
    blackWinRate: 33,
    drawRate: 30,
    avgElo: 2400,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. d4'],
    description: 'Direkter Zentrumsangriff. Offen und taktisch.',
  },

  // Four Knights Game (1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6) - C47-C49
  '...': {
    name: 'Vierspringerspiel',
    eco: 'C47',
    category: 'Open Game',
    popularity: 25,
    whiteWinRate: 34,
    blackWinRate: 34,
    drawRate: 32,
    avgElo: 2300,
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Nc3 Nf6'],
    description: 'Symmetrisch und solide. Weniger Theorie, mehr Strategie.',
  },

  // King's Gambit (1. e4 e5 2. f4) - C30-C39
  '...': {
    name: 'Königsgambit',
    eco: 'C33',
    category: 'Gambit',
    popularity: 10,
    whiteWinRate: 40,
    blackWinRate: 42,
    drawRate: 18,
    avgElo: 2200,
    moves: ['1. e4 e5', '2. f4'],
    description: 'Romantisches Gambit. Weiß opfert f4 für schnelle Entwicklung.',
  },

  // Vienna Game (1. e4 e5 2. Nc3) - C25-C29
  '...': {
    name: 'Wiener Partie',
    eco: 'C25',
    category: 'Open Game',
    popularity: 20,
    whiteWinRate: 36,
    blackWinRate: 35,
    drawRate: 29,
    avgElo: 2300,
    moves: ['1. e4 e5', '2. Nc3'],
    description: 'Flexibel und unorthodox. Weiß reserviert f4/f3.',
  },

  // ==========================================
  // SEMI-OPEN GAMES (B00-B99) - 1. e4 without 1... e5
  // ==========================================
  // Sicilian Defense (1. e4 c5) - B20-B99
  'brbnbbbqbkbbbbnbbrbpbpbpbpbp..bpbpbp....................wp..................wpwpwp..wpwpwpwpwrwnwbwqwkwbwnwrwb': {
    name: 'Sizilianische Verteidigung',
    eco: 'B20',
    category: 'Semi-Open Game',
    popularity: 95,
    whiteWinRate: 36,
    blackWinRate: 38,
    drawRate: 26,
    avgElo: 2650,
    moves: ['1. e4 c5'],
    description: 'Beste Gewinnchancen für Schwarz. Asymmetrisch und konterreich.',
  },

  // Najdorf Variation (1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nf3 Nf6 5. Nc3 a6) - B90-B99
  '...': {
    name: 'Najdorf-Variante',
    eco: 'B90',
    category: 'Sicilian Defense',
    popularity: 35,
    whiteWinRate: 34,
    blackWinRate: 40,
    drawRate: 26,
    avgElo: 2750,
    moves: ['1. e4 c5', '2. Nf3 d6', '3. d4 cxd4', '4. Nf3 Nf6', '5. Nc3 a6'],
    description: 'Königin der Eröffnungen. Flexibel und konterreich.',
  },

  // Dragon Variation (1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nf3 Nf6 5. Nc3 g6) - B70-B79
  '...': {
    name: 'Drachenvariante',
    eco: 'B70',
    category: 'Sicilian Defense',
    popularity: 20,
    whiteWinRate: 38,
    blackWinRate: 42,
    drawRate: 20,
    avgElo: 2650,
    moves: ['1. e4 c5', '2. Nf3 d6', '3. d4 cxd4', '4. Nf3 Nf6', '5. Nc3 g6'],
    description: 'Fianchetto mit g6. Scharf und theoretisch reich.',
  },

  // French Defense (1. e4 e6) - C00-C19
  'brbnbbbqbkbbbbnbbrbpbpbp..bpbpbpbpbp....................wp..................wpwpwp..wpwpwpwpwrwnwbwqwkwbwnwrwb': {
    name: 'Französische Verteidigung',
    eco: 'C00',
    category: 'Semi-Open Game',
    popularity: 80,
    whiteWinRate: 34,
    blackWinRate: 36,
    drawRate: 30,
    avgElo: 2500,
    moves: ['1. e4 e6'],
    description: 'Solide mit …d5-Brecher. Strukturell reich.',
  },

  // Winawer Variation (1. e4 e6 2. d4 d5 3. Nc3 Bb4) - C15-C19
  '...': {
    name: 'Winawer-Variante',
    eco: 'C18',
    category: 'French Defense',
    popularity: 25,
    whiteWinRate: 33,
    blackWinRate: 40,
    drawRate: 27,
    avgElo: 2600,
    moves: ['1. e4 e6', '2. d4 d5', '3. Nc3 Bb4'],
    description: 'Schwarz pinnt c3. Scharf und theoretisch.',
  },

  // Caro-Kann Defense (1. e4 c6) - B10-B19
  '...': {
    name: 'Caro-Kann-Verteidigung',
    eco: 'B10',
    category: 'Semi-Open Game',
    popularity: 75,
    whiteWinRate: 33,
    blackWinRate: 35,
    drawRate: 32,
    avgElo: 2500,
    moves: ['1. e4 c6'],
    description: 'Extrem solide. …c6 unterstützt …d5 ohne Bauernschwäche.',
  },

  // Pirc/Modern Defense (1. e4 d6/g6) - B06-B09
  '...': {
    name: 'Pirc-Verteidigung',
    eco: 'B07',
    category: 'Semi-Open Game',
    popularity: 30,
    whiteWinRate: 38,
    blackWinRate: 38,
    drawRate: 24,
    avgElo: 2400,
    moves: ['1. e4 d6', '2. d4 Nf6', '3. Nc3 g6'],
    description: 'Hypermodern. Schwarz überlässt Zentrum, greift es an.',
  },

  // ==========================================
  // CLOSED GAMES (D00-D99) - 1. d4 d5
  // ==========================================
  // Queen's Gambit Declined (1. d4 d5 2. c4 e6) - D30-D69
  '...': {
    name: 'Abgelehntes Damengambit',
    eco: 'D30',
    category: 'Closed Game',
    popularity: 85,
    whiteWinRate: 37,
    blackWinRate: 31,
    drawRate: 32,
    avgElo: 2550,
    moves: ['1. d4 d5', '2. c4 e6'],
    description: 'Klassisch und solide. Schwarz hält Zentrum.',
  },

  // Queen's Gambit Accepted (1. d4 d5 2. c4 dxc4) - D20-D29
  '...': {
    name: 'Angenommenes Damengambit',
    eco: 'D20',
    category: 'Closed Game',
    popularity: 30,
    whiteWinRate: 38,
    blackWinRate: 35,
    drawRate: 27,
    avgElo: 2500,
    moves: ['1. d4 d5', '2. c4 dxc4'],
    description: 'Schwarz nimmt c4. Aktiv, aber riskant.',
  },

  // Slav Defense (1. d4 d5 2. c4 c6) - D10-D19
  '...': {
    name: 'Slawische Verteidigung',
    eco: 'D10',
    category: 'Closed Game',
    popularity: 80,
    whiteWinRate: 35,
    blackWinRate: 33,
    drawRate: 32,
    avgElo: 2600,
    moves: ['1. d4 d5', '2. c4 c6'],
    description: 'Solide mit …c6. Unterstützt d5 ohne Läufer zu blockieren.',
  },

  // Semi-Slav (1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6) - D43-D49
  '...': {
    name: 'Halbslawisch',
    eco: 'D45',
    category: 'Closed Game',
    popularity: 45,
    whiteWinRate: 36,
    blackWinRate: 34,
    drawRate: 30,
    avgElo: 2650,
    moves: ['1. d4 d5', '2. c4 c6', '3. Nf3 Nf6', '4. Nc3 e6'],
    description: 'Kombination aus Slawisch und QGD. Sehr beliebt auf Top-Niveau.',
  },

  // Nimzo-Indian (1. d4 Nf6 2. c4 e6 3. Nc3 Bb4) - E20-E59
  '...': {
    name: 'Nimzo-Indisch',
    eco: 'E20',
    category: 'Indian System',
    popularity: 85,
    whiteWinRate: 34,
    blackWinRate: 38,
    drawRate: 28,
    avgElo: 2700,
    moves: ['1. d4 Nf6', '2. c4 e6', '3. Nc3 Bb4'],
    description: 'Meisterhaft. Schwarz pinnt c3 und kontrolliert e4.',
  },

  // King's Indian Defense (1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6) - E60-E99
  '...': {
    name: 'Königsindisch',
    eco: 'E60',
    category: 'Indian System',
    popularity: 80,
    whiteWinRate: 36,
    blackWinRate: 40,
    drawRate: 24,
    avgElo: 2650,
    moves: ['1. d4 Nf6', '2. c4 g6', '3. Nc3 Bg7', '4. e4 d6'],
    description: 'Aggressiv hypermodern. Schwarz baut Königsangriff auf.',
  },

  // Grünfeld Defense (1. d4 Nf6 2. c4 g6 3. Nc3 d5) - D70-D99
  '...': {
    name: 'Grünfeld-Verteidigung',
    eco: 'D85',
    category: 'Indian System',
    popularity: 60,
    whiteWinRate: 35,
    blackWinRate: 39,
    drawRate: 26,
    avgElo: 2700,
    moves: ['1. d4 Nf6', '2. c4 g6', '3. Nc3 d5'],
    description: 'Schwarz schlägt sofort d5. Dynamisch und konterreich.',
  },

  // English Opening (1. c4) - A10-A39
  '...': {
    name: 'Englische Eröffnung',
    eco: 'A10',
    category: 'Flank Opening',
    popularity: 70,
    whiteWinRate: 38,
    blackWinRate: 32,
    drawRate: 30,
    avgElo: 2500,
    moves: ['1. c4'],
    description: 'Flexibel und positionell. Transponiert oft.',
  },

  // Reti Opening (1. Nf3) - A04-A09
  '...': {
    name: 'Retieröffnung',
    eco: 'A04',
    category: 'Flank Opening',
    popularity: 40,
    whiteWinRate: 37,
    blackWinRate: 33,
    drawRate: 30,
    avgElo: 2400,
    moves: ['1. Nf3'],
    description: 'Hypermodern. Weiß kontrolliert Zentrum von der Flanke.',
  },

  // ==========================================
  // 9x9 SPECIFIC OPENINGS
  // ==========================================
  '9x9_SYMMETRIC': {
    name: 'Symmetrische Aufstellung (9x9)',
    eco: '9x9-A00',
    category: '9x9 Opening',
    popularity: 100,
    whiteWinRate: 35,
    blackWinRate: 35,
    drawRate: 30,
    avgElo: 2000,
    moves: ['Symmetrisch'],
    description: 'Spiegelung. Reine Strategie ohne Eröffnungstheorie.',
  },

  '9x9_OFFENSIVE': {
    name: 'Offensive Formation (9x9)',
    eco: '9x9-A10',
    category: '9x9 Opening',
    popularity: 60,
    whiteWinRate: 38,
    blackWinRate: 32,
    drawRate: 30,
    avgElo: 2100,
    moves: ['Offensiv'],
    description: 'Weiß drückt früh. Figuren zentral platziert.',
  },

  '9x9_DEFENSIVE': {
    name: 'Defensive Formation (9x9)',
    eco: '9x9-B00',
    category: '9x9 Opening',
    popularity: 50,
    whiteWinRate: 32,
    blackWinRate: 38,
    drawRate: 30,
    avgElo: 2100,
    moves: ['Defensiv'],
    description: 'Schwarz überlässt Initiative, kontert.',
  },

  '9x9_WINGS': {
    name: 'Flügel-Angriff (9x9)',
    eco: '9x9-C00',
    category: '9x9 Opening',
    popularity: 40,
    whiteWinRate: 36,
    blackWinRate: 34,
    drawRate: 30,
    avgElo: 2150,
    moves: ['Flügel'],
    description: 'Angriff über die Flügel. Nutzt 9x9-Breite.',
  },
};

/**
 * Gets the opening entry for the current board hash.
 * @param {string} hash - The board hash
 * @returns {OpeningEntry|null} The opening entry or null if unknown
 */
export function getOpeningEntry(hash: string): OpeningEntry | null {
  // Check for direct matches
  if (OPENING_DATABASE[hash]) return OPENING_DATABASE[hash];

  // Check for partial hash matches (first N characters)
  for (const [dbHash, entry] of Object.entries(OPENING_DATABASE)) {
    if (hash.startsWith(dbHash.slice(0, 50)) && dbHash.length > 50) {
      return entry;
    }
  }

  return null;
}

/**
 * Gets just the opening name for the current board hash (legacy compatibility).
 * @param {string} hash - The board hash
 * @returns {string|null} The opening name or null if unknown
 */
export function getOpeningName(hash: string): string | null {
  const entry = getOpeningEntry(hash);
  return entry?.name || null;
}

/**
 * Search openings by name, ECO code, or category.
 * @param {string} query - Search query
 * @returns {OpeningEntry[]} Matching entries
 */
export function searchOpenings(query: string): OpeningEntry[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(OPENING_DATABASE).filter(entry =>
    entry.name.toLowerCase().includes(lowerQuery) ||
    entry.eco.toLowerCase().includes(lowerQuery) ||
    entry.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get openings by category.
 * @param {string} category - Category name
 * @returns {OpeningEntry[]} Entries in that category
 */
export function getOpeningsByCategory(category: string): OpeningEntry[] {
  return Object.values(OPENING_DATABASE).filter(entry =>
    entry.category === category
  );
}

/**
 * Get top N most popular openings.
 * @param {number} n - Number of openings to return
 * @returns {OpeningEntry[]} Top openings by popularity
 */
export function getTopOpenings(n: number = 10): OpeningEntry[] {
  return Object.values(OPENING_DATABASE)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, n);
}

/**
 * Export to JSON for external use.
 * @returns {string} JSON string of the database
 */
export function exportDatabase(): string {
  return JSON.stringify(OPENING_DATABASE, null, 2);
}
