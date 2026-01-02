import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as TacticsDetector from './TacticsDetector.js';

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
      qualityLabel = '⭐⭐⭐ Gewinnzug! Diese Stellung ist entscheidend.';
    } else if (diffP >= -0.1) {
      category = 'excellent';
      qualityLabel = '⭐⭐⭐ Bester Zug';
    } else {
      category = 'good';
      qualityLabel = `⭐⭐ Guter Zug (minimal schwächer: ${Math.abs(diffP)} Bauern)`;
    }
  } else if (diffP >= -1.5) {
    category = 'normal';
    qualityLabel = `⭐ Solider Zug (${Math.abs(diffP)} Bauern schwächer als bester Zug)`;
  } else if (diffP >= -3.0) {
    category = 'questionable';
    qualityLabel = `⚠️ Fragwürdig (${Math.abs(diffP)} Bauern schlechter)`;
    warnings.push('Es gibt deutlich bessere Züge! Überlege nochmal.');
  } else {
    category = 'mistake';
    qualityLabel = `❌ Fehler (${Math.abs(diffP)} Bauern Nachteil)`;
    warnings.push('⚠️ Dieser Zug verschenkt Material oder Position!');
  }

  // Detect tactical patterns
  const patterns = TacticsDetector.detectTacticalPatterns(game, this, move);
  patterns.forEach(pattern => {
    tacticalExplanations.push(pattern.explanation);
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

  // 1. Center Control
  if (to.r >= 3 && to.r <= 5 && to.c >= 3 && to.c <= 5) {
    patterns.push({
      type: 'center_control',
      explanation: '🏰 Kontrolliert das Zentrum',
    });
  }

  // 2. Development
  const homeRow = piece.color === 'white' ? 8 : 0;
  if (from.r === homeRow && to.r !== homeRow) {
    patterns.push({
      type: 'development',
      explanation: '🚀 Entwickelt eine Figur',
    });
  }

  // 3. Mobility
  // This is a bit simplified as we don't have the board state after move here easily
  // without re-simulating. But detectTacticalPatterns already does simulation.

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
        callback: () => game.undoMove(),
      },
    ]
  );
}
