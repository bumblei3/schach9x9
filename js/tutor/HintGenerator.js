import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as MoveAnalyzer from './MoveAnalyzer.js';

/**
 * Gets tutor hints by calling the AI engine
 */
export function getTutorHints(game, tutorController) {
  if (game.phase !== PHASES.PLAY) {
    return [];
  }

  // Only show hints when it's the human player's turn
  if (game.isAI && game.turn === 'black') {
    return []; // Don't give hints for AI
  }

  const moves = game.getAllLegalMoves(game.turn);

  if (moves.length === 0) return [];

  // Quick heuristic scoring for initial filtering (fast, no deep search)
  const quickScored = [];
  for (const move of moves) {
    const fromPiece = game.board[move.from.r][move.from.c];
    if (!fromPiece || fromPiece.color !== game.turn) continue;

    const targetPiece = game.board[move.to.r][move.to.c];
    if (targetPiece && targetPiece.color === game.turn) continue;

    // Quick heuristic: captures > center control > other
    let heuristic = 0;
    if (targetPiece) {
      const values = { p: 1, n: 3, b: 3, r: 5, q: 9, e: 12, a: 7, c: 8, k: 100 };
      heuristic += values[targetPiece.type] * 100; // Prioritize captures
    }
    // Center control bonus
    if (move.to.r >= 3 && move.to.r <= 5 && move.to.c >= 3 && move.to.c <= 5) {
      heuristic += 20;
    }

    quickScored.push({ move, heuristic });
  }

  // Sort by heuristic and take top 8 candidates for deep evaluation
  quickScored.sort((a, b) => b.heuristic - a.heuristic);
  const topCandidates = quickScored.slice(0, Math.min(8, quickScored.length));

  // Evaluate top candidates with shallow Minimax
  const evaluatedMoves = [];
  const depth = 2;

  for (const { move } of topCandidates) {
    const fromPiece = game.board[move.from.r][move.from.c];
    const validForPiece = game.getValidMoves(move.from.r, move.from.c, fromPiece);
    const isReallyValid = validForPiece.some(v => v.r === move.to.r && v.c === move.to.c);

    if (!isReallyValid) continue;

    // Use game's minimax if available, otherwise fallback
    const score = game.minimax ? game.minimax(move, depth, true, -Infinity, Infinity) : 0;
    const displayScore = -score;
    const notation = MoveAnalyzer.getMoveNotation(game, move);

    evaluatedMoves.push({
      move,
      score: displayScore,
      notation,
    });
  }

  // Sort by score (best first)
  evaluatedMoves.sort((a, b) => b.score - a.score);

  // Get best score for relative comparison
  const bestScore = evaluatedMoves.length > 0 ? evaluatedMoves[0].score : 0;

  // Return top 3 with analysis
  return evaluatedMoves.slice(0, 3).map(hint => {
    const analysis = MoveAnalyzer.analyzeMoveWithExplanation.call(
      tutorController,
      game,
      hint.move,
      hint.score,
      bestScore
    );
    return {
      ...hint,
      analysis,
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
 * Returns available setup templates
 */
export function getSetupTemplates(game) {
  const points = game.initialPoints;

  // Templates for 12 points
  const templates12 = [
    {
      id: 'fortress_12',
      name: '🏰 Die Festung',
      description: 'Defensiv mit Turm und Läufern.',
      pieces: ['r', 'b', 'b', 'p'], // 5+3+3+1 = 12
      cost: 12,
    },
    {
      id: 'rush_12',
      name: '⚡ Der Ansturm',
      description: 'Aggressiv mit Dame und Bauern.',
      pieces: ['q', 'p', 'p', 'p'], // 9+1+1+1 = 12
      cost: 12,
    },
    {
      id: 'flexible_12',
      name: '🔄 Flexibel',
      description: 'Ausgewogen mit Springer und Läufer.',
      pieces: ['n', 'n', 'b', 'p', 'p', 'p'], // 3+3+3+1+1+1 = 12
      cost: 12,
    },
    {
      id: 'swarm_12',
      name: '🐝 Der Schwarm',
      description: 'Viele leichte Figuren.',
      pieces: ['n', 'b', 'p', 'p', 'p', 'p', 'p'], // 3+3+1+1+1+1+1+1 = 12
      cost: 12,
    },
  ];

  // Templates for 15 points
  const templates15 = [
    {
      id: 'fortress_15',
      name: '🏰 Die Festung',
      description:
        'Defensive Strategie: 2 Türme kontrollieren wichtige Linien, Läufer unterstützt. Ideal gegen aggressive Gegner.',
      pieces: ['r', 'r', 'b', 'p', 'p'], // 5+5+3+1+1 = 15
      cost: 15,
    },
    {
      id: 'rush_15',
      name: '⚡ Der Ansturm',
      description:
        'Offensive Strategie: Dame + 2 Springer für frühen Angriffsdruck. Für erfahrene Spieler, die schnell zuschlagen wollen.',
      pieces: ['q', 'n', 'n'], // 9+3+3 = 15
      cost: 15,
    },
    {
      id: 'flexible_15',
      name: '🔄 Flexibel',
      description:
        'Ausgewogene Strategie: Erzbischof (Läufer+Springer-Hybrid) bietet Vielseitigkeit. Anpassbar  an jede Situation.',
      pieces: ['a', 'r', 'b'], // 7+5+3 = 15
      cost: 15,
    },
    {
      id: 'swarm_15',
      name: '🐝 Der Schwarm',
      description:
        'Zahlenüberlegenheit: Viele leichte Figuren für Feldkontrolle und Flexibilität. Schwer für Gegner zu verteidigen.',
      pieces: ['n', 'n', 'b', 'b', 'p', 'p', 'p'], // 3+3+3+3+1+1+1 = 15
      cost: 15,
    },
  ];

  // Templates for 18 points
  const templates18 = [
    {
      id: 'fortress_18',
      name: '🏰 Die Festung',
      description: 'Maximale Defensive mit 2 Türmen und Erzbischof.',
      pieces: ['r', 'r', 'a', 'p'], // 5+5+7+1 = 18
      cost: 18,
    },
    {
      id: 'rush_18',
      name: '⚡ Der Ansturm',
      description: 'Doppelte Damen für maximalen Druck.',
      pieces: ['q', 'q'], // 9+9 = 18
      cost: 18,
    },
    {
      id: 'flexible_18',
      name: '🔄 Flexibel',
      description: 'Kanzler, Dame und Bauer für Vielseitigkeit.',
      pieces: ['c', 'q', 'p'], // 8+9+1 = 18
      cost: 18,
    },
    {
      id: 'swarm_18',
      name: '🐝 Der Schwarm',
      description: 'Erzbischof mit vielen leichten Figuren.',
      pieces: ['a', 'n', 'n', 'b', 'p', 'p'], // 7+3+3+3+1+1 = 18
      cost: 18,
    },
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
