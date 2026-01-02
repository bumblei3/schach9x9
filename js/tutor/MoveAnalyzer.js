import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as TacticsDetector from './TacticsDetector.js';
import { evaluatePosition as _evaluatePosition } from '../ai/Evaluation.js';

/**
 * Analyzes a move and provides a detailed explanation
 */
export function analyzeMoveWithExplanation(game, move, score, bestScore) {
  const tacticalExplanations = [];
  const strategicExplanations = [];
  const warnings = [];
  let category = 'normal';

  // Calculate difference from best move (relative quality)
  const diff = score - bestScore;
  const diffPawns = (diff / 100).toFixed(1);

  // Categorize based on relative score
  let qualityLabel = '';
  const diffP = parseFloat(diffPawns);
  if (diffP >= -0.5) {
    if (score >= 300) {
      category = 'excellent';
      qualityLabel = '⭐⭐⭐ Entscheidender Gewinnzug! Du kontrollierst die Partie.';
    } else if (diffP >= -0.1) {
      category = 'excellent';
      qualityLabel = '⭐⭐⭐ Brillanter Zug! Exakt die Empfehlung der KI.';
    } else {
      category = 'good';
      qualityLabel = `⭐⭐ Guter Zug (minimal schwächer: ${Math.abs(diffP)} Bauern)`;
    }
  } else if (diffP >= -1.5) {
    category = 'normal';
    qualityLabel = `⭐ Solider Zug (${Math.abs(diffP)} Bauern schwächer)`;
  } else if (diffP >= -3.0) {
    category = 'questionable';
    qualityLabel = `⚠️ Ungenauigkeit (${Math.abs(diffP)} Bauern schlechter)`;
    warnings.push('Es gibt strategisch wertvollere Alternativen. Beachte die Figurenentwicklung!');
  } else {
    category = 'mistake';
    qualityLabel = `❌ Grober Fehler (${Math.abs(diffP)} Bauern Verlust)`;
    warnings.push('⚠️ Dieser Zug gefährdet deine Position massiv!');
  }

  // Detect tactical patterns
  const patterns = TacticsDetector.detectTacticalPatterns(game, this, move);
  const questions = [];
  patterns.forEach(pattern => {
    tacticalExplanations.push(pattern.explanation);
    if (pattern.question) questions.push(pattern.question);
  });

  // Analyze strategic value
  const strategic = analyzeStrategicValue(game, move);
  strategic.forEach(s => {
    strategicExplanations.push(s.explanation);
  });

  // Check for threats to own pieces after this move
  const threats = TacticsDetector.detectThreatsAfterMove(game, this, move);
  if (threats.length > 0) {
    threats.forEach(threat => {
      warnings.push(threat.warning);
    });
  }

  return {
    move,
    score,
    category,
    qualityLabel,
    tacticalExplanations,
    strategicExplanations,
    warnings,
    tacticalPatterns: patterns,
    strategicValue: strategic,
    questions,
    scoreDiff: diff,
    notation: getMoveNotation(game, move),
  };
}

/**
 * Analyzes strategic value of a move
 */
export function analyzeStrategicValue(game, move) {
  const patterns = [];
  const from = move.from;
  const to = move.to;
  const piece = game.board[from.r][from.c];

  if (!piece) return patterns;

  // Utilize the Evaluation logic to detect concepts
  // We need to simulate the board state
  // Simplification: We look at static features of the move

  // 1. Center Control
  // Center is 3,3 to 5,5
  if (to.r >= 3 && to.r <= 5 && to.c >= 3 && to.c <= 5) {
    patterns.push({
      type: 'center_control',
      explanation: '🏰 Besetzt das Zentrum',
    });
  }

  // 2. Development (Minor Pieces)
  const homeRow = piece.color === 'white' ? 8 : 0;
  if (
    (piece.type === 'n' || piece.type === 'b' || piece.type === 'a' || piece.type === 'c') &&
    from.r === homeRow &&
    to.r !== homeRow
  ) {
    patterns.push({
      type: 'development',
      explanation: '🚀 Entwickelt eine Figur',
    });
  }

  // 3. King Safety (Simple Heuristic for Tutor)
  // If King moves and creates a castling-like structure or moves to safety
  if (piece.type === 'k') {
    // Castling detection (usually specific move type, but here by coordinates)
    if (Math.abs(from.c - to.c) > 1) {
      patterns.push({
        type: 'safety',
        explanation: '🛡️ Bringt den König in Sicherheit (Rochade)',
      });
    }
  }

  // 4. Pawn Structure
  if (piece.type === 'p') {
    // Check for passed pawn creation (simplified)
    if (piece.color === 'white' && to.r < 4) {
      patterns.push({
        type: 'space',
        explanation: 'Territoriumsgewinn',
      });
    }
  }

  return patterns;
}

/**
 * Gets a description for a score
 */
export function getScoreDescription(score) {
  // Score is in centipawns (100 = 1 pawn advantage)
  if (score >= 900) {
    return { label: '🏆 Gewinnstellung', color: '#10b981', emoji: '🏆' };
  } else if (score >= 500) {
    return { label: '⭐ Großer Vorteil', color: '#22c55e', emoji: '⭐' };
  } else if (score >= 200) {
    return { label: '✨ Klarer Vorteil', color: '#4ade80', emoji: '✨' };
  } else if (score >= 50) {
    return { label: '➕ Leichter Vorteil', color: '#86efac', emoji: '➕' };
  } else if (score >= -50) {
    return { label: '⚖️ Ausgeglichen', color: '#94a3b8', emoji: '⚖️' };
  } else if (score >= -200) {
    return { label: '➖ Leichter Nachteil', color: '#fca5a5', emoji: '➖' };
  } else if (score >= -500) {
    return { label: '⚠️ Schwieriger', color: '#f87171', emoji: '⚠️' };
  } else if (score >= -900) {
    return { label: '🔴 Großer Nachteil', color: '#ef4444', emoji: '🔴' };
  } else {
    return { label: '💀 Verloren', color: '#dc2626', emoji: '💀' };
  }
}

/**
 * Gets algebraic notation for a move
 */
export function getMoveNotation(game, move) {
  const piece = game.board[move.from.r][move.from.c];

  // Handle null piece gracefully
  if (!piece) {
    const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
    const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);
    return `Zug ${fromNotation}→${toNotation}`;
  }

  const targetPiece = game.board[move.to.r][move.to.c];
  const pieceSymbol = UI.getPieceText ? UI.getPieceText(piece) : '';
  const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);

  const pieceName = getPieceName(piece.type);

  if (targetPiece) {
    const targetName = getPieceName(targetPiece.type);
    return `${pieceSymbol} ${pieceName} schlägt ${targetName} (${toNotation})`;
  } else {
    return `${pieceSymbol} ${pieceName} nach ${toNotation}`;
  }
}

/**
 * Gets a localized piece name
 */
export function getPieceName(type) {
  const names = {
    p: 'Bauer',
    r: 'Turm',
    n: 'Springer',
    b: 'Läufer',
    q: 'Dame',
    k: 'König',
    a: 'Erzbischof',
    c: 'Kanzler',
    e: 'Engel',
  };
  return names[type] || type;
}

/**
 * Handles player moves for Guess the Move and warnings
 */
export function handlePlayerMove(game, tutorController, from, to) {
  if (game.phase !== PHASES.PLAY) return;

  // Get the move from legal moves
  const moves = game.getAllLegalMoves(game.turn);
  const move = moves.find(
    m => m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c
  );

  if (!move) return;

  // 1. Guess the Move Logic
  if (game.tutorMode === 'guess_the_move') {
    const bestMoves = game.bestMoves || [];
    if (bestMoves.length > 0) {
      const isBest = bestMoves.some(
        hint =>
          hint.move.from.r === from.r &&
          hint.move.from.c === from.c &&
          hint.move.to.r === to.r &&
          hint.move.to.c === to.c
      );

      if (isBest) {
        game.tutorPoints += 10;
        UI.showToast('Richtig geraten! +10 Tutor-Punkte', 'success');
      } else {
        UI.showToast('Nicht der beste Zug, aber das Spiel geht weiter.', 'neutral');
      }
    }
  }
}

/**
 * Checks for blunders
 */
export function checkBlunder(game, tutorController, moveRecord) {
  if (!moveRecord || game.mode === 'puzzle') return;

  const currentEval = moveRecord.evalScore;
  const prevEval = game.lastEval || 0;
  const turn = moveRecord.piece.color;

  // Advantage drop (from perspective of current player)
  const drop = turn === 'white' ? prevEval - currentEval : currentEval - prevEval;

  // Track accuracy for Elo estimation
  // Using a sigmoid-like curve or simple mapping:
  // 0 drop = 100%, 100 drop = 90%, 200 drop = 70%, 500 drop = 20%
  const clampedDrop = Math.max(0, drop);
  const accuracy = 100 * Math.pow(0.5, clampedDrop / 200);
  game.stats.accuracies.push(accuracy);

  if (drop >= 200) {
    // 2.0 evaluation drop is a blunder
    const analysis = analyzeMoveWithExplanation.call(
      tutorController,
      game,
      { from: moveRecord.from, to: moveRecord.to },
      currentEval,
      turn === 'white' ? prevEval : -prevEval
    );
    tutorController.showBlunderWarning(analysis);
  }

  game.lastEval = currentEval;
}

/**
 * Shows a blunder warning
 */
export function showBlunderWarning(game, analysis) {
  const warnings = analysis.warnings.join('\n');
  const explanation =
    analysis.tacticalExplanations.join('\n') ||
    'Kein konkretes taktisches Motiv erkannt, aber die Stellung verschlechtert sich deutlich.';

  UI.showModal(
    '⚠️ Schwerer Fehler (Blunder)',
    `Dieser Zug verschlechtert deine Stellung um ${(analysis.scoreDiff / -100).toFixed(1)} Bauern.\n\n${warnings}\n\n${explanation}\n\nMöchtest du den Zug zurücknehmen?`,
    [
      { text: 'Nein, weiterspielen', class: 'btn-secondary' },
      {
        text: 'Ja, Zug rückgängig machen',
        class: 'btn-primary',
        callback: () => {
          if (game.moveController && game.moveController.undoMove) {
            game.moveController.undoMove();
          } else if (game.undoMove) {
            game.undoMove();
          }
        },
      },
    ]
  );
}
