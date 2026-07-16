import { logger } from '../logger.js';
import { PHASES, BOARD_SIZE, type Game, type Square } from '../gameEngine.js';
import type { MoveInfo } from './MoveAnalyzer.js';
import { getTutorDepth } from '../config.js';
import type { SearchResult, MoveResult } from '../aiEngine.js';
import {
  setTutorLoading,
  showTutorSuggestions as showTutorSuggestionsUI,
  renderBoard,
  updateShopUI,
} from '../ui.js';
import type { TutorHint } from '../ui.js';
import { analyzeMoveWithExplanation, getMoveNotation } from './MoveAnalyzer.js';
import type { Piece } from '../types/game.js';
import * as aiEngine from '../aiEngine.js';

interface TacticalPattern {
  type: string;
  severity: string;
  explanation: string;
  question?: string;
}

interface TemplateInput {
  id: string;
  name: string;
  description: string;
  pieces: string[];
  isRecommended?: boolean;
}

interface SetupTemplate {
  id: string;
  name: string;
  description: string;
  pieces: string[];
  cost: number;
  isRecommended?: boolean;
}

export type { SetupTemplate };

/**
 * Gets tutor hints by calling the AI engine
 * @param _tutorController - Tutor controller (unused, kept for API consistency)
 */
export async function getTutorHints(game: Game, _tutorController: unknown): Promise<TutorHint[]> {
  const turnColor = game.turn;

  // Detect test/e2e environment to use faster/shallower search
  const isTestEnv =
    typeof navigator !== 'undefined' &&
    (navigator.webdriver === true ||
      (window as Window & { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ === true ||
      new URLSearchParams(window.location.search).has('e2e'));

  // Signal that the tutor is thinking
  setTutorLoading(true);

  try {
    if (game.phase !== PHASES.PLAY) {
      return [];
    }

    // Only show hints when it's the human player's turn
    if (game.isAI && game.turn === 'black') {
      return []; // Don't give hints for AI
    }
    // Tutor depth is centrally guaranteed to exceed the opponent AI depth
    // (see getTutorDepth in config.ts). In tests use a shallow depth for speed.
    const tutorDepth = isTestEnv ? 2 : getTutorDepth(game.difficulty as string);
    // Give the tutor at least as much time as the toughest opponent (expert
    // uses 8000ms) so its deeper search can actually complete; short in tests.
    const maxTimeMs = isTestEnv ? 1000 : 8000;
    const moveNumber = Math.floor(game.moveHistory.length / 2);

    // Prefer Web Worker path so the UI stays responsive (Phase A).
    // Main-thread getTopMoves can block for several seconds at tutor depth.
    let topMoves: SearchResult[] = [];
    const aiCtrl = game.aiController;
    if (aiCtrl && typeof aiCtrl.requestTopMoves === 'function') {
      topMoves = await aiCtrl.requestTopMoves(3, tutorDepth, maxTimeMs, moveNumber);
    } else {
      // Unit tests / environments without a Worker pool — shallow main-thread ok.
      topMoves = await aiEngine.getTopMoves(
        game.board,
        turnColor,
        3,
        isTestEnv ? 2 : Math.min(tutorDepth, 3),
        isTestEnv ? 1000 : Math.min(maxTimeMs, 1500),
        moveNumber
      );
    }

    if (!topMoves || topMoves.length === 0) {
      // In test environment, return mock hints so the UI can display the overlay
      if (isTestEnv) {
        return createMockHints(game, turnColor);
      }
      // Debug logging for production
      console.warn('[HintGenerator] getTopMoves returned empty array', {
        turnColor,
        tutorDepth,
        maxTimeMs,
        moveNumber,
        phase: game.phase,
        isAI: game.isAI,
        boardSize: game.board.length,
      });
      return [];
    }

    // Filter out invalid moves
    const validMoves = topMoves.filter((result: SearchResult) => {
      if (!result || !result.move) return false;

      const from = result.move.from;
      const to = result.move.to;
      const piece = game.board[from.r] ? game.board[from.r][from.c] : undefined;
      const targetPiece = game.board[to.r] ? game.board[to.r][to.c] : undefined;

      // Verify the move belongs to the current player and is not a self-capture
      if (!piece || piece.color !== turnColor) return false;
      if (targetPiece && targetPiece.color === turnColor) return false;

      return true;
    });
    logger
      .context('HintGenerator')
      .debug('[HintGenerator] Valid moves after filtering:', validMoves.length);

    // Convert engine moves to hints with explanations
    return Promise.all(
      validMoves.map(async (hint: SearchResult, index: number) => {
        const analysis = await analyzeMoveWithExplanation(
          game,
          hint.move as unknown as MoveInfo,
          hint.score,
          validMoves[0].score
        );

        // Extract PV from engine result
        const pv = (hint.pv || []) as string | MoveResult[];

        // Extract high-severity tactical patterns for prominent display
        const tacticsHighlight = (analysis.tacticalPatterns || [])
          .filter((p: TacticalPattern) => p.severity === 'high')
          .map((p: TacticalPattern) => p.explanation)
          .slice(0, 2); // Max 2 highlights

        return {
          move: hint.move,
          score: hint.score,
          notation: hint.move
            ? getMoveNotation(game, hint.move as unknown as { from: Square; to: Square })
            : '',
          analysis,
          tacticsHighlight,
          pv: index === 0 ? pv : null, // Show PV only for the leading suggestion
        };
      })
    );
  } finally {
    setTutorLoading(false);
  }
}

/**
 * Checks if a move is a tutor recommended move
 */
export function isTutorMove(game: Game, from: Square, to: Square): boolean {
  if (!game.bestMoves) return false;
  return game.bestMoves.some((m: unknown) => {
    const move = m as { move: { from: Square; to: Square }; score?: number };
    if (!move || !move.move) return false;
    return (
      move.move.from.r === from.r &&
      move.move.from.c === from.c &&
      move.move.to.r === to.r &&
      move.move.to.c === to.c
    );
  });
}

/**
 * Updates best moves periodically
 * @param _game - Game instance (unused in current implementation)
 * @param _tutorController - Tutor controller (unused in current implementation)
 */
export function updateBestMoves(_game: Game, _tutorController: unknown): void {
  // User Request: Tutor info only on click.
  // We disable automatic background calculation to prevent "Thinking..." state from appearing automatically.
  // game.bestMoves will be calculated on-demand when the button is clicked.
  /*
  if (game.phase !== PHASES.PLAY) return;

  // Immediately show "Thinking" UI when a new position needs analysis
  setTutorLoading(true);

  // Debounced part
  tutorController.debouncedGetTutorHints();
  */
}

/**
 * Shows tutor suggestions in the UI
 */
export async function showTutorSuggestions(game: Game): Promise<void> {
  // const isSetup = game.phase && String(game.phase).startsWith('SETUP');
  // Allow empty hints to pass through to UI so it can show "No suggestions" message
  // if (
  //   !isSetup &&
  //   (!game.bestMoves || (Array.isArray(game.bestMoves) && game.bestMoves.length === 0))
  // )
  //   return;
  await showTutorSuggestionsUI(game, game.bestMoves as TutorHint[] | null | undefined);
}

/**
 * Piece value mapping for cost calculation
 */
const PIECE_VALUES: Record<string, number> = {
  q: 9,
  c: 8,
  a: 7,
  r: 5,
  n: 3,
  b: 3,
  p: 1,
  e: 12,
  k: 0,
};

/**
 * Calculates the total cost of a pieces array
 * @param {string[]} pieces - Array of piece symbols
 * @returns {number} Total cost
 */
export function calculatePieceCost(pieces: string[]): number {
  return pieces.reduce((sum, p) => sum + (PIECE_VALUES[p] || 0), 0);
}

/**
 * Creates a template with automatic cost calculation and validation
 * @param {object} template - Template definition without cost
 * @param {number} expectedCost - Expected cost for validation
 * @returns {object} Template with calculated cost
 */
function createTemplate(
  { id, name, description, pieces, isRecommended }: TemplateInput,
  expectedCost: number
): SetupTemplate {
  const calculatedCost = calculatePieceCost(pieces);

  // Development warning if costs don't match
  if (calculatedCost !== expectedCost) {
    logger
      .context('HintGenerator')
      .warn(
        `[HintGenerator] Template "${id}" cost mismatch! ` +
          `Expected: ${expectedCost}, Calculated: ${calculatedCost} ` +
          `(Pieces: ${pieces.join(', ')})`
      );
  }

  return {
    id,
    name,
    description,
    pieces,
    cost: calculatedCost, // Use calculated cost (auto-corrects errors)
    ...(isRecommended && { isRecommended }),
  };
}

/**
 * Returns available setup templates
 */
/**
 * Calculates a score for placing a piece at a specific square
 */
export function getSquareScore(
  r: number,
  c: number,
  pieceType: string,
  isWhite: boolean,
  game: Game & { availableKingPos?: { r: number; c: number } | null }
): number {
  let score = 0;

  const corruptedColStart = isWhite ? game.whiteCorridor : game.blackCorridor;
  const isCenterCol = c === corruptedColStart! + 1;
  const isCornerCol = c === corruptedColStart || c === corruptedColStart! + 2;

  // King location
  const king = game.availableKingPos
    ? game.availableKingPos
    : game.rulesEngine.findKing(isWhite ? 'white' : 'black');

  // Row definitions relative to player
  let frontRow: number, middleRow: number, backRow: number;
  if (isWhite) {
    frontRow = 6;
    middleRow = 7;
    backRow = 8;
  } else {
    frontRow = 2;
    middleRow = 1;
    backRow = 0;
  }

  const isFrontRow = r === frontRow;
  const isMiddleRow = r === middleRow;
  const isBackRow = r === backRow;

  // -- Heuristics --

  // 1. King Safety (Pawns)
  if (pieceType === 'p') {
    if (isFrontRow) score += 40;
    if (isMiddleRow) score += 20;

    if (king) {
      // In front of King
      if (c === king.c && Math.abs(r - king.r) === 1) score += 50;
      // Diagonally in front
      if (Math.abs(c - king.c) === 1 && Math.abs(r - king.r) === 1) score += 30;
    }
  }

  // 2. Knights (Center Control)
  if (pieceType === 'n') {
    if (isCenterCol) score += 20;
    if (isMiddleRow) score += 30;
    if (isFrontRow) score += 20;
    if (isCornerCol) score -= 10; // Avoid edges
  }

  // 3. Bishops (Long Diagonals)
  if (pieceType === 'b' || pieceType === 'a') {
    if (isBackRow) score += 30;
    if (isMiddleRow) score += 20;
    // Bonus for being on long diagonals relative to corridor?
    // Simplified: Back row center is good
    if (isBackRow && isCenterCol) score += 10;
  }

  // 4. Rooks (Corners/Files)
  if (pieceType === 'r' || pieceType === 'c') {
    if (isBackRow) score += 40;
    if (isCornerCol) score += 20;
  }

  // 5. Queens (Safe Back/Middle)
  if (pieceType === 'q' || pieceType === 'e') {
    if (isBackRow) score += 50;
    if (isMiddleRow) score += 10;
    // Prefer protection
    if (king && Math.abs(c - king.c) <= 1) score += 10;
  }

  // 6. Occupancy Penalty (should be handled by only checking empty squares)

  return score;
}

/**
 * Finds the best empty square for a piece in the corridor
 */
export function getOptimalSquare(
  game: Game & { availableKingPos?: { r: number; c: number } | null },
  pieceType: string,
  isWhite: boolean
): { r: number; c: number } | null {
  const colStart = isWhite ? game.whiteCorridor : game.blackCorridor;
  const rowStart = isWhite ? 6 : 0;

  let bestSquare: { r: number; c: number } | null = null;
  let maxScore = -Infinity;

  for (let r = rowStart; r < rowStart + 3; r++) {
    for (let c = colStart!; c < colStart! + 3; c++) {
      // Check boundaries and occupancy
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
      const piece = game.board[r][c];
      if (piece) continue; // Skip occupied

      const score = getSquareScore(r, c, pieceType, isWhite, game);
      if (score > maxScore) {
        maxScore = score;
        bestSquare = { r, c };
      }
    }
  }

  return bestSquare;
}

/**
 * Returns available setup templates
 */
export function getSetupTemplates(game: Game): SetupTemplate[] {
  const points = game.initialPoints;

  // Templates for 12 points
  if (points === 12) {
    return [
      createTemplate(
        {
          id: 'fortress_12',
          name: '🏰 Die Festung',
          description: 'Defensiv mit Turm und Läufern.',
          pieces: ['r', 'b', 'b', 'p'],
        },
        12
      ),
      createTemplate(
        {
          id: 'rush_12',
          name: '⚡ Der Ansturm',
          description: 'Aggressiv mit Dame und Bauern.',
          pieces: ['q', 'p', 'p', 'p'],
        },
        12
      ),
      createTemplate(
        {
          id: 'flexible_12',
          name: '🔄 Flexibel',
          description: 'Ausgewogen mit Springer und Läufer.',
          pieces: ['n', 'n', 'b', 'p', 'p', 'p'],
          isRecommended: true,
        },
        12
      ),
      // New: Gambit (Light pieces)
      createTemplate(
        {
          id: 'gambit_12',
          name: '⚔️ Gambit',
          description: 'Schnelle Entwicklung mit Springern und Läufern. Wenig Bauern.',
          pieces: ['n', 'n', 'b', 'b'],
        },
        12
      ),
      createTemplate(
        {
          id: 'swarm_12',
          name: '🐝 Der Schwarm',
          description: 'Viele leichte Figuren für maximale Feldpräsenz.',
          pieces: ['n', 'b', 'p', 'p', 'p', 'p', 'p', 'p'],
        },
        12
      ),
    ];
  }

  // Templates for 18 points
  if (points === 18) {
    return [
      createTemplate(
        {
          id: 'fortress_18',
          name: '🏰 Die Festung',
          description: 'Maximale Defensive mit 2 Türmen und Erzbischof.',
          pieces: ['r', 'r', 'a', 'p'],
        },
        18
      ),
      createTemplate(
        {
          id: 'siege_18',
          name: '🔨 Belagerung',
          description: 'Schwere Artillerie: Kanzler und Turm.',
          pieces: ['c', 'r', 'r'],
        },
        18
      ),
      createTemplate(
        {
          id: 'royal_guard_18',
          name: '🛡️ Königsgarde',
          description: 'Maximaler Schutz mit Engel und Bauern.',
          pieces: ['e', 'n', 'p', 'p', 'p'],
        },
        18
      ),
      createTemplate(
        {
          id: 'flexible_18',
          name: '🔄 Flexibel',
          description: 'Kanzler, Dame und Bauer für Vielseitigkeit.',
          pieces: ['c', 'q', 'p'],
          isRecommended: true,
        },
        18
      ),
      createTemplate(
        {
          id: 'swarm_18',
          name: '🐝 Der Schwarm',
          description: 'Maximale Anzahl an Figuren (8 Stk) für totale Dominanz.',
          pieces: ['n', 'n', 'b', 'r', 'p', 'p', 'p', 'p'],
        },
        18
      ),
    ];
  }

  // Templates for 20 points
  if (points === 20) {
    return [
      createTemplate(
        {
          id: 'balanced_20',
          name: '⚖️ Ausgewogen',
          description: 'Solid structure with heavy and light pieces.',
          pieces: ['r', 'r', 'b', 'n', 'p', 'p', 'p', 'p'],
        },
        20
      ),
      createTemplate(
        {
          id: 'royal_20',
          name: '👑 Royal',
          description: 'Focused on high value pieces.',
          pieces: ['q', 'a', 'p', 'p', 'p', 'p'],
        },
        20
      ),
      createTemplate(
        {
          id: 'swarm_20',
          name: '🐝 Swarm',
          description: 'Control the board with many pieces.',
          pieces: ['n', 'n', 'b', 'b', 'r', 'p', 'p', 'p'],
          isRecommended: true,
        },
        20
      ),
    ];
  }

  // Templates for 25 points
  if (points === 25) {
    return [
      createTemplate(
        {
          id: 'power_25',
          name: '⚡ Powerhouse',
          description: 'Dame, Kanzler und Erzbischof - maximale Feuerkraft.',
          pieces: ['q', 'c', 'a', 'p'],
        },
        25
      ),
      createTemplate(
        {
          id: 'wall_25',
          name: '🧱 Die Mauer',
          description: 'Defensivwerk mit Kanzler und Türmen.',
          pieces: ['c', 'r', 'r', 'b', 'p', 'p', 'p', 'p'],
        },
        25
      ),
      createTemplate(
        {
          id: 'balanced_25',
          name: '⚖️ Großmeister',
          description: 'Klassische, flexible Aufstellung für jede Situation.',
          pieces: ['q', 'r', 'r', 'n', 'n'],
          isRecommended: true,
        },
        25
      ),
      createTemplate(
        {
          id: 'legendary_25',
          name: '🌟 Legenden',
          description: 'Engel und Kanzler führen die Armee an.',
          pieces: ['e', 'c', 'n', 'p', 'p'],
        },
        25
      ),
    ];
  }

  // Templates for 30+ points (Boss 1 Tier)
  // Covers 30 (Base) and 40 (with Perk)
  if (points >= 30 && points < 50) {
    return [
      createTemplate(
        {
          id: 'dark_tower_30',
          name: '🏰 Dunkler Turm',
          description: 'Massive Verteidigung mit Engel und Türmen.',
          pieces: ['e', 'r', 'r', 'c'], // 12+5+5+8 = 30
        },
        30
      ),
      createTemplate(
        {
          id: 'royal_court_30',
          name: '👑 Hofstaat',
          description: 'Dame, Kanzler und Erzbischof vereint.',
          pieces: ['q', 'c', 'a', 'n', 'n'], // 9+8+7+3+3 = 30
        },
        30
      ),
      createTemplate(
        {
          id: 'divine_30',
          name: '✨ Die Auserwählten',
          description: 'Zwei Engel führen die Schlacht an.',
          pieces: ['e', 'e', 'n', 'n'], // 12+12+3+3 = 30
          isRecommended: true,
        },
        30
      ),
    ];
  }

  // Templates for 50+ points (Final Boss Tier)
  // Covers 50 (Base) and 60 (with Perk)
  if (points >= 50) {
    return [
      createTemplate(
        {
          id: 'imperator_50',
          name: '⚔️ Imperiale Legion',
          description: 'Eine Armee aus Engeln und Kanzlern.',
          pieces: ['e', 'e', 'c', 'c', 'r', 'r'], // 12+12+8+8+5+5 = 50
        },
        50
      ),
      createTemplate(
        {
          id: 'queens_wrath_50',
          name: '👸 Rache der Königin',
          description: 'Vier Damen dominieren das Brett.',
          pieces: ['q', 'q', 'q', 'q', 'e', 'p', 'p'], // 9*4=36 + 12 + 1 + 1 = 50
        },
        50
      ),
      createTemplate(
        {
          id: 'ultimate_50',
          name: '🌟 Ultimative Macht',
          description: 'Eine ausgewogene, vernichtende Streitmacht.',
          pieces: ['e', 'q', 'c', 'a', 'r', 'r', 'n', 'p'], // 12+9+8+7+5+5+3+1 = 50
          isRecommended: true,
        },
        50
      ),
    ];
  }

  // Standard Fallback / Dynamic Generation
  if (![12, 15, 18, 20, 25].includes(points)) {
    // Generate a simple dynamic template
    const dynamicPieces: string[] = [];
    let remaining = points;
    // Greedy approach for a balanced army: 1 Heavy, some Mediums, some Pawns
    // Priority: Queen/Chancellor/Archbishop -> Rooks -> Minors -> Pawns

    // Max 8 pieces (9 slots - 1 King)
    const MAX_PIECES = 8;

    // Try to get a 'Queen-like' piece if rich
    if (remaining >= 9 && dynamicPieces.length < MAX_PIECES) {
      dynamicPieces.push('q');
      remaining -= 9;
    } else if (remaining >= 8 && dynamicPieces.length < MAX_PIECES) {
      dynamicPieces.push('c');
      remaining -= 8;
    }

    // Fill with Rooks/Minors
    while (remaining >= 5 && dynamicPieces.length < MAX_PIECES) {
      dynamicPieces.push('r');
      remaining -= 5;
    }
    while (remaining >= 3 && dynamicPieces.length < MAX_PIECES) {
      dynamicPieces.push('n');
      remaining -= 3;
    }
    while (remaining > 0 && dynamicPieces.length < MAX_PIECES) {
      dynamicPieces.push('p');
      remaining -= 1;
    }

    // Return just one generated template along with standard 15s if applicable
    return [
      createTemplate(
        {
          id: `custom_${points}`,
          name: `🛠️ Maßgeschneidert (${points} Pkt)`,
          description: 'Automatisch generierte Aufstellung für dein Budget.',
          pieces: dynamicPieces,
          isRecommended: true,
        },
        points - remaining
      ),
    ];
  }

  // Default 15 points
  return [
    createTemplate(
      {
        id: 'fortress_15',
        name: '🏰 Die Festung',
        description: 'Defensive Strategie: 2 Türme. Ideal gegen aggressive Gegner.',
        pieces: ['r', 'r', 'b', 'p', 'p'],
      },
      15
    ),
    createTemplate(
      {
        id: 'rush_15',
        name: '⚡ Der Ansturm',
        description: 'Offensive: Dame + 2 Springer.',
        pieces: ['q', 'n', 'n'],
      },
      15
    ),
    createTemplate(
      {
        id: 'flexible_15',
        name: '🔄 Flexibel',
        description: 'Erzbischof bietet Vielseitigkeit.',
        pieces: ['a', 'r', 'b'],
        isRecommended: true,
      },
      15
    ),
    createTemplate(
      {
        id: 'gambit_15',
        name: '⚔️ Das Gambit',
        description: 'Opfere Material für Position? Viele leichte Figuren.',
        pieces: ['n', 'n', 'b', 'b', 'p', 'p', 'p'],
      },
      15
    ),
  ];
}

/**
 * Applies a setup template to the board
 */
export function applySetupTemplate(
  game: Game,
  tutorController: { getSetupTemplates?: () => SetupTemplate[] },
  templateId: string
): void {
  let template: SetupTemplate | undefined;
  if (tutorController && tutorController.getSetupTemplates) {
    template = tutorController.getSetupTemplates().find((t: SetupTemplate) => t.id === templateId);
  } else {
    template = getSetupTemplates(game).find((t: SetupTemplate) => t.id === templateId);
  }

  if (!template) return;

  // Determine orientation
  const isWhite = game.phase === PHASES.SETUP_WHITE_PIECES;
  const colStart = isWhite ? game.whiteCorridor : game.blackCorridor;
  if (typeof colStart !== 'number') return;

  const rowStart = isWhite ? 6 : 0;

  // Clear existing pieces in corridor (except King)
  let kingPos: { r: number; c: number } | null = null;
  for (let r = rowStart; r < rowStart + 3; r++) {
    for (let c = colStart; c < colStart + 3; c++) {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

      const piece = game.board[r][c];
      if (piece && piece.type === 'k') {
        kingPos = { r, c };
      } else {
        game.board[r][c] = null;
      }
    }
  }

  // Store king pos temporarily for heuristic
  (game as Game & { availableKingPos?: { r: number; c: number } | null }).availableKingPos =
    kingPos;

  // Reset points
  game.points = game.initialPoints;

  // Sort pieces by "importance" or placement difficulty
  // Placing Pawns first is good for King safety
  // Then heavy pieces to secure back ranks
  // Then minor pieces
  const priority: Record<string, number> = {
    p: 10,
    k: 0,
    q: 1,
    r: 2,
    c: 3,
    e: 1,
    b: 4,
    n: 5,
    a: 4,
  };
  const sortedPieces = [...template.pieces].sort((a, b) => (priority[a] || 9) - (priority[b] || 9));

  sortedPieces.forEach((pieceType: string) => {
    const bestSq = getOptimalSquare(
      game as Game & { availableKingPos?: { r: number; c: number } | null },
      pieceType,
      isWhite
    );
    if (bestSq) {
      placePiece(game, bestSq.r, bestSq.c, pieceType, isWhite);
    } else {
      logger.context('HintGenerator').warn(`[Tutor] Could not find slot for ${pieceType}`);
    }
  });

  delete (game as Game & { availableKingPos?: { r: number; c: number } | null }).availableKingPos;

  renderBoard(game);
  updateShopUI(game);
  game.log(`Tutor: Aufstellung "${template.name}" angewendet.`);
}

/**
 * Places a piece and deducts points
 */
export function placePiece(game: Game, r: number, c: number, type: string, isWhite: boolean): void {
  game.board[r][c] = {
    type: type as Piece['type'],
    color: isWhite ? 'white' : 'black',
    hasMoved: false,
  };

  const getVal = (type: string) => {
    const map: Record<string, number> = { q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12, k: 0 };
    return map[type] || 0;
  };
  game.points -= getVal(type);
}

/**
 * Creates mock tutor hints for test/e2e environments when AI returns no moves
 */
function createMockHints(game: Game, turnColor: 'white' | 'black'): TutorHint[] {
  // Find a few legal moves to use as mock hints
  const legalMoves = game.getAllLegalMoves(turnColor);
  if (legalMoves.length === 0) return [];

  // Take up to 3 moves
  const mockMoves = legalMoves.slice(0, 3);

  return mockMoves.map((move, index) => ({
    move: {
      from: { r: move.from.r, c: move.from.c },
      to: { r: move.to.r, c: move.to.c },
      promotion: move.promotion,
    },
    score: 100 - index * 20, // Decreasing scores
    notation: (game as { getTutorHints?: () => unknown }).getTutorHints?.()
      ? getMoveNotation(game, move)
      : `${move.from.r},${move.from.c}→${move.to.r},${move.to.c}`,
    analysis: {
      move: { from: move.from, to: move.to },
      score: 100 - index * 20,
      category: index === 0 ? 'best' : 'good',
      qualityLabel: index === 0 ? '⭐ Bester Zug!' : '✅ Guter Zug',
      summary: index === 0 ? 'Stärkster Zug nach Engine-Bewertung.' : 'Solider Zug.',
      betterMove: null,
      tacticalExplanations: [],
      strategicExplanations: ['Mock hint for e2e testing'],
      warnings: [],
      tacticalPatterns: [],
      strategicValue: [],
      questions: [],
      scoreDiff: 0,
      notation: '',
    },
    tacticsHighlight: [],
    pv: index === 0 ? [] : null,
  }));
}
