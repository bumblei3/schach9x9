import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import * as TacticsDetector from './TacticsDetector.js';
import * as aiEngine from '../aiEngine.js';
import { MENTOR_LEVELS } from '../config.js';

/**
 * Analyzes a move BEFORE it is executed to provide proactive warnings
 * @param {Object} game
 * @param {Object} move {from: {r,c}, to: {r,c}}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function analyzePlayerMovePreExecution(game: any, move: any): Promise<any> {
  if (!game.kiMentorEnabled || game.phase !== PHASES.PLAY) return null;

  const from = move.from;
  const to = move.to;
  const piece = game.board[from.r][from.c];
  if (!piece) return null;

  // 1. Get current evaluation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentEval = await (aiEngine as any).evaluatePosition(game.board, 'white');

  // 🎯 Add tactical penalty for hanging pieces
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threats = (TacticsDetector as any).detectThreatsAfterMove(
    game,
    { getPieceName: (t: any) => t },
    move
  );
  let penalty = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  threats.forEach((t: any) => {
    const val: Record<string, number> = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 20000,
      a: 650,
      c: 850,
      e: 1220,
    };
    penalty += val[t.piece.type] || 0;
  });

  // 2. Simulate move for static evaluation
  const originalTarget = game.board[to.r][to.c];
  game.board[to.r][to.c] = piece;
  game.board[from.r][from.c] = null;

  // 3. Evaluate resulting position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newEval = await (aiEngine as any).evaluatePosition(game.board, 'white');

  const turn = piece.color;
  if (turn === 'white') newEval -= penalty;
  else newEval += penalty;

  // Restore board
  game.board[from.r][from.c] = piece;
  game.board[to.r][to.c] = originalTarget;

  // 4. Calculate drop from perspective of moving player
  const drop = turn === 'white' ? currentEval - newEval : newEval - currentEval;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentLevel = (MENTOR_LEVELS as any)[game.mentorLevel] || (MENTOR_LEVELS as any).STANDARD;
  const threshold = currentLevel.threshold;

  if (drop >= threshold) {
    // Generate full analysis for the warning
    return analyzeMoveWithExplanation(
      game,
      move,
      newEval,
      turn === 'white' ? currentEval : -currentEval
    );
  }

  return null;
}

/**
 * Analyzes a move and provides a detailed explanation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function analyzeMoveWithExplanation(
  game: any,
  move: any,
  score: number,
  bestScore: number
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tacticalExplanations: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strategicExplanations: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const warnings: string[] = [];
  let category = 'normal';

  // Calculate difference from best move (relative quality)
  const diff = score - bestScore;
  const diffPawns = (diff / 100).toFixed(1);

  // Categorize based on relative score
  let qualityLabel = '';
  const diffP = parseFloat(diffPawns);

  if (diffP >= 0) {
    // If it's as good or better than engine's top move
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (diffP > 0.5 && (TacticsDetector as any).isTactical(game, move)) {
      category = 'brilliant';
      qualityLabel =
        '!! Brillanter Zug! Du hast eine taktische Tiefe gefunden, die die KI beeindruckt.';
    } else {
      category = 'best';
      qualityLabel = '⭐ Bester Zug! Exakt die Empfehlung der KI.';
    }
  } else if (diffP >= -0.3) {
    category = 'excellent';
    qualityLabel = '✨ Exzellenter Zug! Beinahe perfekt.';
  } else if (diffP >= -1.5) {
    category = 'good';
    qualityLabel = '✅ Guter Zug.';
  } else if (diffP >= -2.5) {
    category = 'inaccuracy';
    qualityLabel = `!? Ungenauigkeit (${Math.abs(diffP)} Bauern schwächer)`;
    warnings.push('Es gibt strategisch wertvollere Alternativen.');
  } else if (diffP >= -4.0) {
    category = 'mistake';
    qualityLabel = `? Fehler (${Math.abs(diffP)} Bauern schlechter)`;
    warnings.push('Dieser Zug verschlechtert deine Stellung spürbar.');
  } else {
    category = 'blunder';
    qualityLabel = `?? Grober Fehler (${Math.abs(diffP)} Bauern Verlust)`;
    warnings.push('⚠️ Dieser Zug gefährdet deine Position massiv!');
  }

  // Detect tactical patterns
  const analyzer = { getPieceName };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patterns = (TacticsDetector as any).detectTacticalPatterns(game, analyzer, move);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patterns.forEach((pattern: any) => {
    tacticalExplanations.push(pattern.explanation);
    if (pattern.question) questions.push(pattern.question);
  });

  // Analyze strategic value
  const strategic = analyzeStrategicValue(game, move);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategic.forEach((s: any) => {
    strategicExplanations.push(s.explanation);
  });

  // Check for threats to own pieces after this move
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threats = (TacticsDetector as any).detectThreatsAfterMove(game, analyzer, move);
  if (threats.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    threats.forEach((threat: any) => {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function analyzeStrategicValue(game: any, move: any): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patterns: any[] = [];
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

  // 5. Open File (Rook/Queen)
  if ((piece.type === 'r' || piece.type === 'q') && from.c !== to.c) {
    // Check if file 'to.c' is open (no pawns of either color)
    // or semi-open (no friendly pawns).
    // Simplified: Check if file has NO pawns
    let hasPawn = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const p = game.board[r][to.c];
      if (p && p.type === 'p') {
        hasPawn = true;
        break;
      }
    }
    if (!hasPawn) {
      patterns.push({
        type: 'open_file',
        explanation: '🛣️ Besetzt eine offene Linie',
      });
    }
  }

  // 6. Knight Outpost
  if (piece.type === 'n') {
    // Outpost: Rank 4-6 (indices 3-5 for center, relative to side?)
    // Let's say central-ish ranks 3,4,5 (indices).
    if (to.r >= 3 && to.r <= 5) {
      // Protected by pawn?
      const pawnOffset = piece.color === 'white' ? 1 : -1; // Pawns are "below" or "above"
      const rPawn = to.r + pawnOffset;
      let protectedByPawn = false;
      if (rPawn >= 0 && rPawn < BOARD_SIZE) {
        const pLeft = game.board[rPawn][to.c - 1];
        const pRight = game.board[rPawn][to.c + 1];
        if (
          (pLeft && pLeft.type === 'p' && pLeft.color === piece.color) ||
          (pRight && pRight.type === 'p' && pRight.color === piece.color)
        ) {
          protectedByPawn = true;
        }
      }
      if (protectedByPawn) {
        patterns.push({
          type: 'outpost',
          explanation: '🐴 Starker Springer-Vorposten',
        });
      }
    }
  }

  return patterns;
}

/**
 * Gets a description for a score
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getScoreDescription(score: number): any {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMoveNotation(game: any, move: any): string {
  const piece = game.board[move.from.r][move.from.c];

  // Handle null piece gracefully
  if (!piece) {
    const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
    const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);
    return `Zug ${fromNotation}→${toNotation}`;
  }

  const targetPiece = game.board[move.to.r][move.to.c];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pieceSymbol = (UI as any).getPieceText ? (UI as any).getPieceText(piece) : '';
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
export function getPieceName(type: string): string {
  const names: Record<string, string> = {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handlePlayerMove(game: any, _tutorController: any, from: any, to: any): void {
  if (game.phase !== PHASES.PLAY) return;

  // Get the move from legal moves
  const moves = game.getAllLegalMoves(game.turn);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const move = moves.find(
    (m: any) => m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c
  );

  if (!move) return;

  // 1. Guess the Move Logic
  if (game.tutorMode === 'guess_the_move') {
    const bestMoves = game.bestMoves || [];
    if (bestMoves.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isBest = bestMoves.some(
        (hint: any) =>
          hint.move.from.r === from.r &&
          hint.move.from.c === from.c &&
          hint.move.to.r === to.r &&
          hint.move.to.c === to.c
      );

      if (isBest) {
        game.tutorPoints += 10;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (UI as any).showToast('Richtig geraten! +10 Tutor-Punkte', 'success');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (UI as any).showToast('Nicht der beste Zug, aber das Spiel geht weiter.', 'neutral');
      }
    }
  }
}

/**
 * Checks for blunders
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkBlunder(
  game: any,
  tutorController: any,
  moveRecord: any
): Promise<void> {
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

  if (drop >= 300) {
    // 3.0 evaluation drop is a blunder (increased from 2.0 to be less annoying)
    const analysis = analyzeMoveWithExplanation(
      game,
      { from: moveRecord.from, to: moveRecord.to },
      currentEval,
      turn === 'white' ? prevEval : -prevEval
    );
    tutorController.showBlunderWarning(analysis);
  }

  // Show quality highlight on the board
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((UI as any).showMoveQuality) {
    // We assume the best move score is either the engine's best or the previous eval if no engine ran
    const bestScore =
      game.bestMoves && game.bestMoves.length > 0 ? game.bestMoves[0].score : prevEval;
    const analysis = analyzeMoveWithExplanation(
      game,
      { from: moveRecord.from, to: moveRecord.to },
      currentEval,
      bestScore
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (UI as any).showMoveQuality(
      game,
      { from: moveRecord.from, to: moveRecord.to },
      analysis.category
    );
  }

  game.lastEval = currentEval;
}

/**
 * Shows a blunder warning (can be post-move or pre-move)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function showBlunderWarning(game: any, analysis: any, proceedCallback: any = null): void {
  const warnings = analysis.warnings.join('\n');
  const explanation =
    analysis.tacticalExplanations.join('\n') ||
    'Kein konkretes taktisches Motiv erkannt, aber die Stellung verschlechtert sich deutlich.';

  const isPreMove = !!proceedCallback;
  const title = isPreMove ? '⚠️ Warnung: Grober Fehler?' : '⚠️ Schwerer Fehler (Blunder)';
  const diff = (analysis.scoreDiff / -100).toFixed(1);

  const message = isPreMove
    ? `Dieser Zug würde deine Stellung um ${diff} Bauern verschlechtern.\n\n${warnings}\n\n${explanation}\n\nMöchtest du diesen Zug wirklich ausführen?`
    : `Dieser Zug verschlechtert deine Stellung um ${diff} Bauern.\n\n${warnings}\n\n${explanation}\n\nMöchtest du den Zug zurücknehmen?`;

  const buttons = isPreMove
    ? [
        { text: 'Abbrechen', class: 'btn-secondary' },
        { text: 'Trotzdem ziehen', class: 'btn-primary', callback: proceedCallback },
      ]
    : [
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
      ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (UI as any).showModal(title, message, buttons);
}
