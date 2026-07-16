import { PHASES, BOARD_SIZE, type Game, type Square } from '../gameEngine.js';
import type { GameLike, Piece } from '../types/core.js';
import { showToast, showModal, getPieceText, showMoveQuality } from '../ui.js';
import { detectThreatsAfterMove, isTactical, detectTacticalPatterns } from './TacticsDetector.js';
import type { Analyzer } from './TacticsDetector.js';
import { evaluatePosition } from '../aiEngine.js';
import { MENTOR_LEVELS } from '../config.js';

// --- Type definitions ---

export interface MoveInfo {
  from: Square;
  to: Square;
}

interface StrategicPattern {
  type: string;
  explanation: string;
}

export interface MoveExplanation {
  move: MoveInfo;
  score: number;
  category: string;
  qualityLabel: string;
  /** One short line for toast / coach (built from tactics + warnings) */
  summary: string;
  tacticalExplanations: string[];
  strategicExplanations: string[];
  warnings: string[];
  tacticalPatterns: { type: string; severity: string; explanation: string; question?: string }[];
  strategicValue: StrategicPattern[];
  questions: string[];
  scoreDiff: number;
  notation: string;
}

interface ScoreDescription {
  label: string;
  color: string;
  emoji: string;
}

export interface MoveRecord {
  from: Square;
  to: Square;
  piece: Piece;
  evalScore?: number;
}

interface ThreatInfo {
  piece: Piece;
  pos: { r: number; c: number };
  warning: string;
}

/**
 * Analyzes a move BEFORE it is executed to provide proactive warnings
 * @param {Object} game
 * @param {Object} move {from: {r,c}, to: {r,c}}
 */
export async function analyzePlayerMovePreExecution(
  game: GameLike,
  move: { from: Square; to: Square }
): Promise<MoveExplanation | null> {
  if (!game.kiMentorEnabled || game.phase !== PHASES.PLAY) return Promise.resolve(null);

  const from = move.from;
  const to = move.to;
  const piece = game.board[from.r][from.c];
  if (!piece) return Promise.resolve(null);

  // 1. Get current evaluation
  const currentEval = await evaluatePosition(game.board, 'white');

  // 🎯 Add tactical penalty for hanging pieces
  const threats = detectThreatsAfterMove(
    game,
    { getPieceName: (t: string) => t } as Analyzer,
    move
  );
  let penalty = 0;
  threats.forEach((t: ThreatInfo) => {
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
  let newEval = await evaluatePosition(game.board, 'white');

  const turn = piece.color;
  if (turn === 'white') newEval -= penalty;
  else newEval += penalty;

  // Restore board
  game.board[from.r][from.c] = piece;
  game.board[to.r][to.c] = originalTarget;

  // 4. Calculate drop from perspective of moving player
  const drop = turn === 'white' ? currentEval - newEval : newEval - currentEval;

  const currentLevel = game.mentorLevel
    ? MENTOR_LEVELS[game.mentorLevel] || MENTOR_LEVELS.STANDARD
    : MENTOR_LEVELS.STANDARD;
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
 * Builds a short human-readable summary from analysis parts (max 2 reasons).
 */
export function buildTutorSummary(analysis: Omit<MoveExplanation, 'summary'> | MoveExplanation): string {
  const reasons: string[] = [];
  const push = (text: string | undefined) => {
    if (!text) return;
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean || reasons.includes(clean)) return;
    if (reasons.length < 2) reasons.push(clean);
  };

  // Prefer concrete tactics, then warnings (why bad), then strategy
  for (const t of analysis.tacticalExplanations || []) push(t);
  for (const w of analysis.warnings || []) push(w);
  for (const s of analysis.strategicExplanations || []) push(s);

  if (reasons.length > 0) return reasons.join(' · ');

  // Fallback by quality category
  switch (analysis.category) {
    case 'brilliant':
      return 'Taktische Idee mit klarem Vorteil.';
    case 'best':
      return 'Stärkster Zug nach Engine-Bewertung.';
    case 'excellent':
      return 'Sehr starke Fortsetzung, nur minimal unter dem Bestzug.';
    case 'good':
      return 'Solider Zug ohne klares taktisches Motiv.';
    case 'inaccuracy':
      return 'Es gibt spürbar bessere Alternativen.';
    case 'mistake':
      return 'Die Stellung wird spürbar schlechter.';
    case 'blunder':
      return 'Grober Stellungs- oder Materialverlust.';
    default:
      return 'Solider Zug.';
  }
}

/**
 * Toast + optional panel: quality label + one-line "why".
 */
export function showTutorMoveFeedback(analysis: MoveExplanation): void {
  const summary = analysis.summary || buildTutorSummary(analysis);
  const emoji: Record<string, string> = {
    brilliant: '💎',
    best: '⭐',
    excellent: '✨',
    good: '✅',
    inaccuracy: '⁉️',
    mistake: '❓',
    blunder: '💥',
    normal: '♟️',
  };
  const shortLabel: Record<string, string> = {
    brilliant: 'Brilliant',
    best: 'Bester Zug',
    excellent: 'Exzellent',
    good: 'Gut',
    inaccuracy: 'Ungenau',
    mistake: 'Fehler',
    blunder: 'Patzer',
    normal: 'Zug',
  };
  const cat = analysis.category || 'normal';
  const toastType =
    cat === 'blunder' || cat === 'mistake'
      ? 'error'
      : cat === 'inaccuracy'
        ? 'warning'
        : cat === 'best' || cat === 'brilliant' || cat === 'excellent' || cat === 'good'
          ? 'success'
          : 'neutral';

  const head = `${emoji[cat] || '♟️'} ${shortLabel[cat] || 'Zug'}`;
  showToast(`${head}: ${summary}`, toastType);
  renderTutorFeedbackPanel(analysis, summary);
}

/**
 * Compact persistent feedback in #tutor-feedback (created if missing).
 */
export function renderTutorFeedbackPanel(analysis: MoveExplanation, summary?: string): void {
  let panel = document.getElementById('tutor-feedback');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'tutor-feedback';
    panel.className = 'tutor-feedback';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    // Prefer next to board / action area
    const host =
      document.getElementById('game-panel') ||
      document.getElementById('board-container') ||
      document.querySelector('.game-area') ||
      document.body;
    host.appendChild(panel);
  }

  const cat = analysis.category || 'normal';
  panel.className = `tutor-feedback tutor-feedback--${cat}`;
  panel.hidden = false;

  const text = summary || analysis.summary || buildTutorSummary(analysis);
  const notation = analysis.notation ? `<span class="tutor-feedback-move">${escapeHtml(analysis.notation)}</span>` : '';

  panel.innerHTML = `
    <div class="tutor-feedback-head">
      <span class="tutor-feedback-badge">${escapeHtml(analysis.qualityLabel.split(/[.!]/)[0] || cat)}</span>
      ${notation}
    </div>
    <div class="tutor-feedback-body">${escapeHtml(text)}</div>
  `;

  // Auto-fade after longer reads for good moves; keep mistakes longer
  const keepMs = cat === 'blunder' || cat === 'mistake' ? 12000 : 7000;
  window.clearTimeout((panel as HTMLElement & { _hideTimer?: number })._hideTimer);
  (panel as HTMLElement & { _hideTimer?: number })._hideTimer = window.setTimeout(() => {
    panel?.classList.add('tutor-feedback--fade');
    setTimeout(() => {
      if (panel) panel.hidden = true;
    }, 400);
  }, keepMs);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Analyzes a move and provides a detailed explanation
 */
export function analyzeMoveWithExplanation(
  game: GameLike,
  move: MoveInfo,
  score: number,
  bestScore: number
): MoveExplanation {
  const tacticalExplanations: string[] = [];
  const strategicExplanations: string[] = [];
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
    if (diffP > 0.5 && isTactical(game, move)) {
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
  const patterns = detectTacticalPatterns(game, analyzer, move);
  const questions: string[] = [];
  patterns.forEach(pattern => {
    tacticalExplanations.push(pattern.explanation);
    if (pattern.question) questions.push(pattern.question);
  });

  // Analyze strategic value (piece may already sit on `to` after the move)
  const strategic = analyzeStrategicValue(game, move);
  strategic.forEach(s => {
    strategicExplanations.push(s.explanation);
  });

  // Concrete material / check notes on the post-move board
  appendPostMoveReasons(game, move, tacticalExplanations, warnings);

  // Check for threats to own pieces after this move
  const threats = detectThreatsAfterMove(game, analyzer, move);
  if (threats.length > 0) {
    threats.forEach(threat => {
      warnings.push(threat.warning);
    });
  }

  const base = {
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

  return {
    ...base,
    summary: buildTutorSummary(base),
  };
}

/**
 * Extra plain-language reasons from the board after the move was played.
 */
function appendPostMoveReasons(
  game: GameLike,
  move: MoveInfo,
  tactical: string[],
  warnings: string[]
): void {
  // Piece is usually on destination after execution
  const pieceOnTo = game.board[move.to.r]?.[move.to.c];
  const pieceOnFrom = game.board[move.from.r]?.[move.from.c];
  const mover = pieceOnTo || pieceOnFrom;
  if (!mover) return;

  const opponent = mover.color === 'white' ? 'black' : 'white';

  // Did we give check?
  try {
    if (typeof game.isInCheck === 'function' && game.isInCheck(opponent as 'white' | 'black')) {
      tactical.push('♔ Schach dem Gegner!');
    }
  } catch {
    /* ignore */
  }

  // Own king in check after own move = illegal in real chess; still warn if engine allows
  try {
    if (typeof game.isInCheck === 'function' && game.isInCheck(mover.color as 'white' | 'black')) {
      warnings.push('Dein König steht (noch) im Schach — decken oder fliehen!');
    }
  } catch {
    /* ignore */
  }
}

/**
 * Analyzes strategic value of a move
 */
export function analyzeStrategicValue(game: GameLike, move: MoveInfo): StrategicPattern[] {
  const patterns: StrategicPattern[] = [];
  const from = move.from;
  const to = move.to;
  // Support both pre-move (piece on from) and post-move (piece on to) boards
  const piece = game.board[from.r]?.[from.c] || game.board[to.r]?.[to.c];

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
export function getScoreDescription(score: number): ScoreDescription {
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
export function getMoveNotation(game: GameLike, move: MoveInfo): string {
  // After move execution the piece sits on `to`; before, on `from`.
  const piece = game.board[move.from.r]?.[move.from.c] || game.board[move.to.r]?.[move.to.c];
  const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
  const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);

  if (!piece) {
    return `Zug ${fromNotation}→${toNotation}`;
  }

  // If piece already on destination, we cannot see the captured piece on `to`.
  const pieceOnFrom = game.board[move.from.r]?.[move.from.c];
  const targetPiece = pieceOnFrom ? game.board[move.to.r]?.[move.to.c] : null;
  const pieceSymbol = getPieceText(piece);
  const pieceName = getPieceName(piece.type);

  if (targetPiece && targetPiece !== piece) {
    const targetName = getPieceName(targetPiece.type);
    return `${pieceSymbol} ${pieceName} schlägt ${targetName} (${toNotation})`;
  }
  return `${pieceSymbol} ${pieceName} ${fromNotation}→${toNotation}`;
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
export function handlePlayerMove(
  game: GameLike,
  _tutorController: unknown,
  from: Square,
  to: Square
): void {
  if (game.phase !== PHASES.PLAY) return;

  // Get the move from legal moves
  const moves = game.getAllLegalMoves?.(game.turn) ?? [];
  const move = moves.find(
    (m: MoveInfo) =>
      m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c
  );

  if (!move) return;

  // 1. Guess the Move Logic
  if (game.tutorMode === 'guess_the_move') {
    const bestMoves = game.bestMoves || [];
    if (bestMoves.length > 0) {
      const isBest = (bestMoves as { move: MoveInfo }[]).some(
        hint =>
          hint.move.from.r === from.r &&
          hint.move.from.c === from.c &&
          hint.move.to.r === to.r &&
          hint.move.to.c === to.c
      );

      if (isBest) {
        if (game.tutorPoints !== undefined) game.tutorPoints += 10;
        showToast('Richtig geraten! +10 Tutor-Punkte', 'success');
      } else {
        showToast('Nicht der beste Zug, aber das Spiel geht weiter.', 'neutral');
      }
    }
  }
}

/**
 * Checks move quality after a human move: quality badge + tutor explanation toast.
 * Severe drops still open the blunder modal (when mentor is on).
 */
export async function checkBlunder(
  game: GameLike,
  tutorController: {
    showBlunderWarning: (_analysis: MoveExplanation, _callback: () => void) => void;
  },
  moveRecord: MoveRecord
): Promise<void> {
  if (!moveRecord || game.mode === 'puzzle' || game.mode === 'daily-puzzle') return;
  // Skip AI side in solo vs AI (black)
  if (game.isAI && moveRecord.piece?.color === 'black') return;

  const currentEval = moveRecord.evalScore;
  const prevEval = game.lastEval || 0;
  const turn = moveRecord.piece?.color || game.turn;

  // Advantage drop (from perspective of current player)
  const currentEvalNum = currentEval ?? 0;
  const drop = turn === 'white' ? prevEval - currentEvalNum : currentEvalNum - prevEval;

  // Track accuracy for Elo estimation
  const clampedDrop = Math.max(0, drop);
  const accuracy = 100 * Math.pow(0.5, clampedDrop / 200);
  if (game.stats) game.stats.accuracies.push(accuracy);

  // Best score: engine top move if available, else previous eval
  const bestScore =
    game.bestMoves && game.bestMoves.length > 0
      ? ((game.bestMoves[0] as { score?: number }).score ?? prevEval)
      : prevEval;

  // For white, higher eval is better; for black invert comparison baseline
  const playerBest =
    turn === 'white' ? (bestScore ?? prevEval) : -(bestScore ?? prevEval);
  const playerScore = turn === 'white' ? currentEvalNum : -currentEvalNum;

  const analysis = analyzeMoveWithExplanation(
    game,
    { from: moveRecord.from, to: moveRecord.to },
    playerScore,
    playerBest
  );

  // Board quality highlight + floating label
  if (showMoveQuality) {
    showMoveQuality(game, { from: moveRecord.from, to: moveRecord.to }, analysis.category);
  }

  // Always show why (toast + panel) for human moves in play
  if (game.phase === PHASES.PLAY || game.phase === 'play' || !game.phase) {
    showTutorMoveFeedback(analysis);
  }

  // Modal only for serious blunders when KI-Mentor is enabled
  if (drop >= 300 && game.kiMentorEnabled) {
    tutorController.showBlunderWarning(analysis, () => {});
  }

  game.lastEval = currentEval;
}

/**
 * Shows a blunder warning (can be post-move or pre-move)
 */
export function showBlunderWarning(
  game: Game & {
    moveController?: { undoMove: () => void };
    undoMove?: () => void;
    lastEval?: number;
  },
  analysis: MoveExplanation,
  proceedCallback: (() => void) | null = null
): void {
  const warnings = analysis.warnings.join('\n');
  const explanation =
    analysis.tacticalExplanations.join('\n') ||
    'Kein konkretes taktisches Motiv erkannt, aber die Stellung verschlechtert sich deutlich.';

  const isPreMove = !!proceedCallback;
  const title = isPreMove ? '⚠️ Warnung: Grober Fehler?' : '⚠️ Schwerer Fehler (Blunder)';
  const diff = (analysis.scoreDiff / -100).toFixed(1);

  const summary = analysis.summary || buildTutorSummary(analysis);
  const message = isPreMove
    ? `Dieser Zug würde deine Stellung um ${diff} Bauern verschlechtern.\n\n${summary}\n\n${warnings}\n\n${explanation}\n\nMöchtest du diesen Zug wirklich ausführen?`
    : `Dieser Zug verschlechtert deine Stellung um ${diff} Bauern.\n\nWarum: ${summary}\n\n${warnings}\n\n${explanation}\n\nMöchtest du den Zug zurücknehmen?`;

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

  showModal(title, message, buttons);
}
