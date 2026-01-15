import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as MoveAnalyzer from './MoveAnalyzer.js';
import * as aiEngine from '../aiEngine.js';

/**
 * Gets tutor hints by calling the AI engine
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTutorHints(game: any, tutorController: any): Promise<any[]> {
  if (game.phase !== PHASES.PLAY) {
    return [];
  }

  // Only show hints when it's the human player's turn
  if (game.isAI && game.turn === 'black') {
    return []; // Don't give hints for AI
  }

  // Use the high-performance engine to get top 3 moves
  const turnColor = game.turn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topMoves: any[] = await (aiEngine as any).getTopMoves(
    game.board,
    turnColor,
    3, // Get top 3 moves
    6, // Search depth
    1500 // Max time in ms
  );

  if (!topMoves || topMoves.length === 0) return [];

  // Filter out invalid moves
  const validMoves = topMoves.filter((result: any) => {
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

  // Convert engine moves to hints with explanations
  return Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validMoves.map(async (hint: any, index: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analysis = await (MoveAnalyzer as any).analyzeMoveWithExplanation.call(
        tutorController,
        game,
        hint.move,
        hint.score,
        validMoves[0].score
      );

      // Extract PV from engine result
      const pv = hint.pv || [];

      return {
        move: hint.move,
        score: hint.score,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notation: (MoveAnalyzer as any).getMoveNotation(game, hint.move),
        analysis,
        pv: index === 0 ? pv : null, // Show PV only for the leading suggestion
      };
    })
  );
}

/**
 * Checks if a move is a tutor recommended move
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTutorMove(game: any, from: any, to: any): boolean {
  if (!game.bestMoves) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return game.bestMoves.some(
    (m: any) =>
      m.move.from.r === from.r &&
      m.move.from.c === from.c &&
      m.move.to.r === to.r &&
      m.move.to.c === to.c
  );
}

/**
 * Updates the best moves and triggers UI update
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateBestMoves(game: any, tutorController: any): void {
  if (game.phase !== PHASES.PLAY) return;

  // Debounced part
  tutorController.debouncedGetTutorHints();
}

/**
 * Shows tutor suggestions in the UI
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function showTutorSuggestions(game: any): Promise<void> {
  const isSetup = game.phase && String(game.phase).startsWith('SETUP');
  if (
    !isSetup &&
    (!game.bestMoves || (Array.isArray(game.bestMoves) && game.bestMoves.length === 0))
  )
    return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (UI as any).showTutorSuggestions(game, game.bestMoves);
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
function calculatePieceCost(pieces: string[]): number {
  return pieces.reduce((sum, p) => sum + (PIECE_VALUES[p] || 0), 0);
}

/**
 * Creates a template with automatic cost calculation and validation
 * @param {object} template - Template definition without cost
 * @param {number} expectedCost - Expected cost for validation
 * @returns {object} Template with calculated cost
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTemplate(
  { id, name, description, pieces, isRecommended }: any,
  expectedCost: number
): any {
  const calculatedCost = calculatePieceCost(pieces);

  // Development warning if costs don't match
  if (calculatedCost !== expectedCost) {
    console.warn(
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Calculates a score for placing a piece at a specific square
 */
function getSquareScore(
  r: number,
  c: number,
  pieceType: string,
  isWhite: boolean,
  game: any
): number {
  let score = 0;

  const corruptedColStart = isWhite ? game.whiteCorridor : game.blackCorridor;
  const isCenterCol = c === corruptedColStart + 1;
  const isCornerCol = c === corruptedColStart || c === corruptedColStart + 2;

  // King location
  const king = game.availableKingPos
    ? game.availableKingPos
    : game.rulesEngine.findKing(isWhite ? 'white' : 'black');

  // Row definitions relative to player
  let frontRow, middleRow, backRow;
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
function getOptimalSquare(
  game: any,
  pieceType: string,
  isWhite: boolean
): { r: number; c: number } | null {
  const colStart = isWhite ? game.whiteCorridor : game.blackCorridor;
  const rowStart = isWhite ? 6 : 0;

  let bestSquare = null;
  let maxScore = -Infinity;

  for (let r = rowStart; r < rowStart + 3; r++) {
    for (let c = colStart; c < colStart + 3; c++) {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSetupTemplates(game: any): any[] {
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

  // Default: 15 points
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applySetupTemplate(game: any, tutorController: any, templateId: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let template;
  if (tutorController && tutorController.getSetupTemplates) {
    template = tutorController.getSetupTemplates().find((t: any) => t.id === templateId);
  } else {
    template = getSetupTemplates(game).find((t: any) => t.id === templateId);
  }

  if (!template) return;

  // Determine orientation
  const isWhite = game.phase === PHASES.SETUP_WHITE_PIECES;
  const colStart = isWhite ? game.whiteCorridor : game.blackCorridor;
  if (typeof colStart !== 'number') return;

  const rowStart = isWhite ? 6 : 0;

  // Clear existing pieces in corridor (except King)
  let kingPos = null;
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
  game.availableKingPos = kingPos;

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
    const bestSq = getOptimalSquare(game, pieceType, isWhite);
    if (bestSq) {
      placePiece(game, bestSq.r, bestSq.c, pieceType, isWhite);
    } else {
      console.warn(`[Tutor] Could not find slot for ${pieceType}`);
    }
  });

  delete game.availableKingPos;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (UI as any).renderBoard(game);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (UI as any).updateShopUI(game);
  game.log(`Tutor: Aufstellung "${template.name}" angewendet.`);
}

/**
 * Places a piece and deducts points
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function placePiece(game: any, r: number, c: number, type: string, isWhite: boolean): void {
  game.board[r][c] = {
    type: type,
    color: isWhite ? 'white' : 'black',
    hasMoved: false,
  };

  const getVal = (type: string) => {
    const map: Record<string, number> = { q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12, k: 0 };
    return map[type] || 0;
  };
  game.points -= getVal(type);
}
