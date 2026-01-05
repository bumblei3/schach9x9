import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as MoveAnalyzer from './MoveAnalyzer.js';
import * as aiEngine from '../aiEngine.js';

/**
 * Gets tutor hints by calling the AI engine
 */
export async function getTutorHints(game, tutorController) {
  if (game.phase !== PHASES.PLAY) {
    return [];
  }

  // Only show hints when it's the human player's turn
  if (game.isAI && game.turn === 'black') {
    return []; // Don't give hints for AI
  }

  // Use the high-performance engine to get best moves
  // We search at a moderate depth (6) for high-quality hints
  const turnColor = game.turn;
  const result = await aiEngine.getBestMoveDetailed(game.board, turnColor, 6, 'expert', {
    maxTime: 1500, // Limit search time to 1.5s for responsiveness
  });

  if (!result || !result.move) return [];

  // Verify the move belongs to the current player and is not a self-capture
  const from = result.move.from;
  const to = result.move.to;
  const piece = game.board[from.r][from.c];
  const targetPiece = game.board[to.r][to.c];

  if (!piece || piece.color !== turnColor) {
    return [];
  }

  if (targetPiece && targetPiece.color === turnColor) {
    return [];
  }

  // Currently our search returns 1 best move. Wrap it in array for compatibility with UI.
  const bestMoves = [result];

  // Convert engine moves to hints with explanations
  return bestMoves.map((hint, index) => {
    const analysis = MoveAnalyzer.analyzeMoveWithExplanation.call(
      tutorController,
      game,
      hint.move,
      hint.score,
      bestMoves[0].score
    );

    // Extract PV from engine
    const pv = aiEngine.extractPV(game.board, turnColor);

    return {
      move: hint.move,
      score: hint.score,
      notation: MoveAnalyzer.getMoveNotation(game, hint.move),
      analysis,
      pv: index === 0 ? pv : null, // Show PV only for the leading suggestion
    };
  });
}

/**
 * Checks if a move is a tutor recommended move
 */
export function isTutorMove(game, from, to) {
  if (!game.bestMoves) return false;
  return game.bestMoves.some(
    m =>
      m.move.from.r === from.r &&
      m.move.from.c === from.c &&
      m.move.to.r === to.r &&
      m.move.to.c === to.c
  );
}

/**
 * Updates the best moves and triggers UI update
 */
export function updateBestMoves(game, tutorController) {
  if (game.phase !== PHASES.PLAY) return;

  // Debounced part
  tutorController.debouncedGetTutorHints();
}

/**
 * Shows tutor suggestions in the UI
 */
export function showTutorSuggestions(game) {
  if (!game.bestMoves || game.bestMoves.length === 0) return;
  UI.showTutorSuggestions(game, game.bestMoves);
}

/**
 * Piece value mapping for cost calculation
 */
const PIECE_VALUES = { q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12, k: 0 };

/**
 * Calculates the total cost of a pieces array
 * @param {string[]} pieces - Array of piece symbols
 * @returns {number} Total cost
 */
function calculatePieceCost(pieces) {
  return pieces.reduce((sum, p) => sum + (PIECE_VALUES[p] || 0), 0);
}

/**
 * Creates a template with automatic cost calculation and validation
 * @param {object} template - Template definition without cost
 * @param {number} expectedCost - Expected cost for validation
 * @returns {object} Template with calculated cost
 */
function createTemplate({ id, name, description, pieces, isRecommended }, expectedCost) {
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
export function getSetupTemplates(game) {
  const points = game.initialPoints;

  // Templates for 12 points
  const templates12 = [
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

  // Templates for 15 points
  const templates15 = [
    createTemplate(
      {
        id: 'fortress_15',
        name: '🏰 Die Festung',
        description:
          'Defensive Strategie: 2 Türme kontrollieren wichtige Linien, Läufer unterstützt. Ideal gegen aggressive Gegner.',
        pieces: ['r', 'r', 'b', 'p', 'p'],
      },
      15
    ),
    createTemplate(
      {
        id: 'rush_15',
        name: '⚡ Der Ansturm',
        description:
          'Offensive Strategie: Dame + 2 Springer für frühen Angriffsdruck. Für erfahrene Spieler, die schnell zuschlagen wollen.',
        pieces: ['q', 'n', 'n'],
      },
      15
    ),
    createTemplate(
      {
        id: 'flexible_15',
        name: '🔄 Flexibel',
        description:
          'Ausgewogene Strategie: Erzbischof (Läufer+Springer-Hybrid) bietet Vielseitigkeit. Anpassbar an jede Situation.',
        pieces: ['a', 'r', 'b'],
        isRecommended: true,
      },
      15
    ),
    createTemplate(
      {
        id: 'swarm_15',
        name: '🐝 Der Schwarm',
        description:
          'Zahlenüberlegenheit: Viele leichte Figuren für Feldkontrolle und Flexibilität. Schwer für Gegner zu verteidigen.',
        pieces: ['n', 'n', 'b', 'b', 'p', 'p', 'p'],
      },
      15
    ),
  ];

  // Templates for 18 points
  const templates18 = [
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
        id: 'rush_18',
        name: '⚡ Der Ansturm',
        description: 'Doppelte Damen für maximalen Druck.',
        pieces: ['q', 'q'],
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

  // Return templates matching the current game's point budget
  if (points === 12) return templates12;
  if (points === 18) return templates18;
  return templates15; // Default to 15 points
}

/**
 * Applies a setup template to the board
 */
export function applySetupTemplate(game, tutorController, templateId) {
  const template = tutorController.getSetupTemplates().find(t => t.id === templateId);
  if (!template) return;

  // Determine current corridor
  const isWhite = game.phase === PHASES.SETUP_WHITE_PIECES;
  const corridor = isWhite ? game.whiteCorridor : game.blackCorridor;
  if (!corridor) return;

  // Clear existing pieces in corridor (except King)
  // And refund points
  for (let r = corridor.rowStart; r < Math.min(corridor.rowStart + 3, BOARD_SIZE); r++) {
    for (let c = corridor.colStart; c < Math.min(corridor.colStart + 3, BOARD_SIZE); c++) {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

      const piece = game.board[r][c];
      if (piece && piece.type !== 'k') {
        game.board[r][c] = null;
      }
    }
  }

  // Reset points
  game.points = game.initialPoints;

  // 1. Define Rows based on color
  let frontRow, middleRow, backRow;
  if (isWhite) {
    frontRow = corridor.rowStart;
    middleRow = corridor.rowStart + 1;
    backRow = corridor.rowStart + 2;
  } else {
    frontRow = corridor.rowStart + 2;
    middleRow = corridor.rowStart + 1;
    backRow = corridor.rowStart;
  }

  const getAvailableInRow = r => {
    if (r < 0 || r >= BOARD_SIZE) return [];
    const squares = [];
    for (let c = corridor.colStart; c < corridor.colStart + 3; c++) {
      const piece = game.board[r][c];
      if (!piece || piece.type !== 'k') {
        squares.push({ r, c });
      }
    }
    return squares;
  };

  const frontSquares = getAvailableInRow(frontRow);
  let middleSquares = getAvailableInRow(middleRow);
  let backSquares = getAvailableInRow(backRow);

  const placeInSlotsInternal = (pieceType, slots) => {
    if (slots.length > 0) {
      const sq = slots.shift();
      placePiece(game, sq.r, sq.c, pieceType, isWhite);
      return true;
    }
    return false;
  };

  const placeAnywhere = pieceType => {
    if (placeInSlotsInternal(pieceType, backSquares)) return;
    if (placeInSlotsInternal(pieceType, middleSquares)) return;
    if (placeInSlotsInternal(pieceType, frontSquares)) return;
  };

  const pieces = template.pieces;
  const pawns = pieces.filter(p => p === 'p');
  const rooks = pieces.filter(p => p === 'r' || p === 'c');
  const bishops = pieces.filter(p => p === 'b' || p === 'a');
  const knights = pieces.filter(p => p === 'n');
  const queens = pieces.filter(p => p === 'q');
  const others = pieces.filter(p => !['p', 'r', 'c', 'b', 'a', 'n', 'q'].includes(p));

  // 1. Pawns
  pawns.forEach(p => {
    if (!placeInSlotsInternal(p, frontSquares)) {
      if (!placeInSlotsInternal(p, middleSquares)) {
        placeInSlotsInternal(p, backSquares);
      }
    }
  });

  // 2. Rooks/Chancellors
  rooks.forEach(p => {
    const corners = backSquares.filter(
      sq => sq.c === corridor.colStart || sq.c === corridor.colStart + 2
    );
    if (corners.length > 0) {
      const sq = corners[0];
      backSquares = backSquares.filter(s => s !== sq);
      placePiece(game, sq.r, sq.c, p, isWhite);
    } else {
      placeAnywhere(p);
    }
  });

  // 3. Bishops/Archbishops
  bishops.forEach(p => {
    const centerBack = backSquares.find(sq => sq.c === corridor.colStart + 1);
    if (centerBack) {
      backSquares = backSquares.filter(s => s !== centerBack);
      placePiece(game, centerBack.r, centerBack.c, p, isWhite);
    } else {
      const cornersMiddle = middleSquares.filter(
        sq => sq.c === corridor.colStart || sq.c === corridor.colStart + 2
      );
      if (cornersMiddle.length > 0) {
        const sq = cornersMiddle[0];
        middleSquares = middleSquares.filter(s => s !== sq);
        placePiece(game, sq.r, sq.c, p, isWhite);
      } else {
        placeAnywhere(p);
      }
    }
  });

  // 4. Queens
  queens.forEach(p => {
    const centerBack = backSquares.find(sq => sq.c === corridor.colStart + 1);
    if (centerBack) {
      backSquares = backSquares.filter(s => s !== centerBack);
      placePiece(game, centerBack.r, centerBack.c, p, isWhite);
    } else {
      placeAnywhere(p);
    }
  });

  // 5. Knights
  knights.forEach(p => {
    if (!placeInSlotsInternal(p, middleSquares)) {
      placeAnywhere(p);
    }
  });

  // 6. Others
  others.forEach(p => {
    placeAnywhere(p);
  });

  UI.renderBoard(game);
  UI.updateShopUI(game);
  game.log(`Tutor: Aufstellung "${template.name}" angewendet.`);
}

/**
 * Places a piece and deducts points
 */
export function placePiece(game, r, c, type, isWhite) {
  game.board[r][c] = {
    type: type,
    color: isWhite ? 'white' : 'black',
    hasMoved: false,
  };

  const getVal = type => {
    const map = { q: 9, c: 8, a: 7, r: 5, n: 3, b: 3, p: 1, e: 12, k: 0 };
    return map[type] || 0;
  };
  game.points -= getVal(type);
}
