import { PHASES, BOARD_SIZE, type Game, type Square } from '../gameEngine.js';
import type { GameLike, Piece, Player } from '../types/core.js';
import { showToast, showModal, getPieceText, showMoveQuality } from '../ui.js';
import { t } from '../i18n.js';
import {
  detectThreatsAfterMove,
  isTactical,
  detectTacticalPatterns,
  detectFairyPatterns,
} from './TacticsDetector.js';
import {
  evaluatePosition,
  getTopMoves,
  getAllThreats,
  see,
  convertBoardToInt,
  COLOR_BLACK,
  COLOR_WHITE,
} from '../aiEngine.js';
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

export interface BetterMoveSuggestion {
  from: Square;
  to: Square;
  score: number;
  notation: string;
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
  /** Engine alternative when the played move was inaccurate or worse */
  betterMove?: BetterMoveSuggestion | null;
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
  /** Captured piece (needed to reverse the board for alternative search) */
  captured?: Piece | null;
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

  // Der Bedrohungsteil (int-Board, X-Ray, Fesselungen, Eval) ist auf das
  // 9×9-Raster festgelegt. In den 8×8-Modi erfindet er Warnungen ("Dame ist
  // GEFESSELT", "8.9 Bauern"), die jeden Zug blockieren — dann lieber keine
  // Vorab-Warnung. `BOARD_SIZE` geht hier nicht, das liegt in 8×8 ebenfalls auf 8.
  if (game.mode === 'standard8x8' || game.mode === 'upgrade8x8') return Promise.resolve(null);

  const from = move.from;
  const to = move.to;
  const piece = game.board[from.r][from.c];
  if (!piece) return Promise.resolve(null);

  const turn = piece.color;

  // 1. Get current evaluation
  const currentEval = await evaluatePosition(game.board, 'white');

  // 2. Simulate the move first — the penalty has to be measured on the position
  //    the player actually reaches, not on the one they come from.
  const originalTarget = game.board[to.r][to.c];
  game.board[to.r][to.c] = piece;
  game.board[from.r][from.c] = null;

  // 🎯 Material the opponent actually wins by capturing (static exchange
  //    evaluation). A piece that is merely attacked — or attacked but defended
  //    with equal value — costs nothing and must not count as a blunder.
  const penalty = staticExchangePenalty(game, turn);

  // 3. Evaluate resulting position
  let newEval = await evaluatePosition(game.board, 'white');

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
 * Material the opponent actually wins by capturing, summed over our attacked
 * pieces (static exchange evaluation).
 *
 * The previous heuristic added the *full* value of every attacked piece, so a
 * defended pawn "under attack" counted as 100 cp lost and the pre-move dialog
 * fired on ordinary developing moves. SEE resolves the capture sequence: a
 * defended piece costs nothing, a hanging one costs what it is really worth.
 */
function staticExchangePenalty(game: GameLike, moverColor: Player): number {
  const aiOpponentColor = moverColor === 'white' ? COLOR_BLACK : COLOR_WHITE;
  const intBoard = convertBoardToInt(game.board);
  const threats = getAllThreats(intBoard, aiOpponentColor);

  // Several attackers can hit the same square; SEE already resolves the whole
  // capture sequence for one attacker, so keep the worst case per square.
  const worstPerSquare = new Map<number, number>();

  for (const threat of threats) {
    const targetR = Math.floor(threat.targetSquare / BOARD_SIZE);
    const targetC = threat.targetSquare % BOARD_SIZE;
    const target = game.board[targetR]?.[targetC];
    // Only our own, non-royal pieces can be won.
    if (!target || target.color !== moverColor || target.type === 'k') continue;

    const attackerR = Math.floor(threat.attackerSquare / BOARD_SIZE);
    const attackerC = threat.attackerSquare % BOARD_SIZE;
    if (!game.board[attackerR]?.[attackerC]) continue;

    const gain = see(game.board, { r: attackerR, c: attackerC }, { r: targetR, c: targetC });
    if (gain <= 0) continue;

    const previous = worstPerSquare.get(threat.targetSquare) ?? 0;
    if (gain > previous) worstPerSquare.set(threat.targetSquare, gain);
  }

  let penalty = 0;
  for (const gain of worstPerSquare.values()) penalty += gain;
  return penalty;
}

/**
 * Drop duplicate reason lines (detectors can report the same motif once per
 * piece) while keeping the original order. Used for every user-facing list.
 */
export function uniqueReasons(list: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list || []) {
    const text = (raw || '').replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

/**
 * Builds a short human-readable summary from analysis parts (max 2 reasons).
 */
export function buildTutorSummary(
  analysis: Omit<MoveExplanation, 'summary'> | MoveExplanation
): string {
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
      return t('tutor.quality.tacticalIdee');
    case 'best':
      return t('tutor.quality.bestMove');
    case 'excellent':
      return t('tutor.quality.excellent');
    case 'good':
      return t('tutor.quality.good');
    case 'inaccuracy':
      return t('tutor.quality.inaccuracy');
    case 'mistake':
      return t('tutor.quality.mistake');
    case 'blunder':
      return t('tutor.quality.blunder');
    default:
      return t('tutor.quality.normal');
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
    brilliant: t('tutor.shortLabel.brilliant'),
    best: t('tutor.shortLabel.best'),
    excellent: t('tutor.shortLabel.excellent'),
    good: t('tutor.shortLabel.good'),
    inaccuracy: t('tutor.shortLabel.inaccuracy'),
    mistake: t('tutor.shortLabel.mistake'),
    blunder: t('tutor.shortLabel.blunder'),
    normal: t('tutor.shortLabel.normal'),
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

  const head = `${emoji[cat] || '♟️'} ${shortLabel[cat] || t('tutor.shortLabel.normal')}`;
  const better = analysis.betterMove;
  const toastBody = better
    ? `${head}: ${summary} · ${t('tutor.better', { move: better.notation })}`
    : `${head}: ${summary}`;
  showToast(toastBody, toastType);
  renderTutorFeedbackPanel(analysis, summary);
}

/**
 * Draw a green "better move" arrow + cell highlights.
 * Accepts game when available (arrowRenderer); falls back to cell CSS only.
 */
function showBetterMoveArrow(
  game: GameLike | null | undefined,
  better: BetterMoveSuggestion
): void {
  clearBetterMoveHighlights();

  const fromCell = document.querySelector(
    `.cell[data-r="${better.from.r}"][data-c="${better.from.c}"]`
  );
  const toCell = document.querySelector(`.cell[data-r="${better.to.r}"][data-c="${better.to.c}"]`);
  fromCell?.classList.add('better-move-from');
  toCell?.classList.add('better-move-to');

  const ar =
    game &&
    (
      game as GameLike & {
        arrowRenderer?: {
          clearArrows: () => void;
          drawArrow: (_fr: number, _fc: number, _tr: number, _tc: number, _color?: string) => void;
          updateCellSize?: () => void;
        };
      }
    ).arrowRenderer;

  if (ar?.drawArrow) {
    try {
      ar.updateCellSize?.();
      ar.clearArrows();
      ar.drawArrow(better.from.r, better.from.c, better.to.r, better.to.c, 'green');
    } catch {
      /* ignore layout races */
    }
  }
}

function clearBetterMoveHighlights(): void {
  // Der Fade-Timer aus `renderTutorFeedbackPanel` überlebt den Test-Aufbau: ist
  // jsdom bereits abgerissen, ist `document` weg und der Aufruf würde als
  // Uncaught Exception den vitest-Lauf rot machen — alle Tests grün, aber
  // `Errors 1 error`. Gleiches Muster wie in `TooltipManager.ts`.
  if (typeof document === 'undefined') return;
  document
    .querySelectorAll('.cell.better-move-from, .cell.better-move-to')
    .forEach(el => el.classList.remove('better-move-from', 'better-move-to'));
}

/**
 * Compact persistent feedback in #tutor-feedback (created if missing).
 */
function renderTutorFeedbackPanel(analysis: MoveExplanation, summary?: string): void {
  let panel = document.getElementById('tutor-feedback');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'tutor-feedback';
    panel.className = 'tutor-feedback';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    // Prefer next to board / action area
    const host =
      document.getElementById('board-container') ||
      document.querySelector('.game-area') ||
      document.body;
    host.appendChild(panel);
  }

  const cat = analysis.category || 'normal';
  panel.className = `tutor-feedback tutor-feedback--${cat}`;
  panel.hidden = false;

  const text = summary || analysis.summary || buildTutorSummary(analysis);
  const notation = analysis.notation
    ? `<span class="tutor-feedback-move">${escapeHtml(analysis.notation)}</span>`
    : '';
  const betterHtml = analysis.betterMove
    ? `<div class="tutor-feedback-better">
         <span class="tutor-feedback-better-label">${t('tutor.betterWas')}</span>
         <span class="tutor-feedback-better-move">${escapeHtml(analysis.betterMove.notation)}</span>
         <span class="tutor-feedback-better-hint">${t('tutor.greenArrow')}</span>
       </div>`
    : '';

  panel.innerHTML = `
    <div class="tutor-feedback-head">
      <span class="tutor-feedback-badge">${escapeHtml(analysis.qualityLabel.split(/[.!]/)[0] || cat)}</span>
      ${notation}
    </div>
    <div class="tutor-feedback-body">${escapeHtml(text)}</div>
    ${betterHtml}
  `;

  // Auto-fade after longer reads for good moves; keep mistakes longer
  const keepMs =
    cat === 'blunder' || cat === 'mistake' ? 14000 : analysis.betterMove ? 12000 : 7000;
  window.clearTimeout((panel as HTMLElement & { _hideTimer?: number })._hideTimer);
  (panel as HTMLElement & { _hideTimer?: number })._hideTimer = window.setTimeout(() => {
    panel?.classList.add('tutor-feedback--fade');
    setTimeout(() => {
      if (panel) panel.hidden = true;
      clearBetterMoveHighlights();
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

  // Calculate difference from best move (relative quality)
  const diff = score - bestScore;
  const diffPawns = (diff / 100).toFixed(1);

  // Categorize based on relative score
  let qualityLabel = '';
  // `category` is always assigned in the if/else chain below (incl. the final
  // else), so no initial value is needed. A `let category = 'normal'` here is
  // dead (js/useless-assignment-to-local) since it is unconditionally
  // overwritten before any read.
  let category: string;
  const diffP = parseFloat(diffPawns);

  if (diffP >= 0) {
    // If it's as good or better than engine's top move
    if (diffP > 0.5 && isTactical(game, move)) {
      category = 'brilliant';
      qualityLabel =
        t('tutor.brilliantLabel');
    } else {
      category = 'best';
      qualityLabel = t('tutor.bestLabel');
    }
  } else if (diffP >= -0.3) {
    category = 'excellent';
    qualityLabel = t('tutor.excellentLabel');
  } else if (diffP >= -1.5) {
    category = 'good';
    qualityLabel = t('tutor.goodLabel');
  } else if (diffP >= -2.5) {
    category = 'inaccuracy';
    qualityLabel = t('tutor.inaccuracyLabel', { pawns: Math.abs(diffP) });
    warnings.push(t('tutor.strategicAlternatives'));
  } else if (diffP >= -4.0) {
    category = 'mistake';
    qualityLabel = t('tutor.mistakeLabel', { pawns: Math.abs(diffP) });
    warnings.push(t('tutor.warnWorse'));
  } else {
    category = 'blunder';
    qualityLabel = t('tutor.blunderLabel', { pawns: Math.abs(diffP) });
    warnings.push(t('tutor.warnCritical'));
  }

  // Detect tactical patterns
  const analyzer = { getPieceName };
  const patterns = detectTacticalPatterns(game, analyzer, move);
  const questions: string[] = [];
  patterns.forEach(pattern => {
    tacticalExplanations.push(pattern.explanation);
    if (pattern.question) questions.push(pattern.question);
  });

  // Fairy tactics (M3.1/M3.2): named 9x9 patterns with proper piece names.
  const fairyPatterns = detectFairyPatterns(game, analyzer, move);
  fairyPatterns.forEach(fp => {
    tacticalExplanations.unshift(fp.explanation); // fairy names first — they are the headline
    questions.push(t('tutor.questionUsePiece', { piece: fp.pieceName }));
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
    // De-duplicated: the same motif is reported once per affected piece.
    tacticalExplanations: uniqueReasons(tacticalExplanations),
    strategicExplanations: uniqueReasons(strategicExplanations),
    warnings: uniqueReasons(warnings),
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
      warnings.push(t('tutor.warnKingInCheck'));
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
        explanation: t('tutor.castlingSafe'),
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
    return { label: t('tutor.labelBigAdvantage'), color: '#22c55e', emoji: '⭐' };
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
    return { label: t('tutor.labelBigDisadvantage'), color: '#ef4444', emoji: '🔴' };
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
    return `${pieceSymbol} ${t('tutor.captureDesc', { piece: pieceName, target: targetName, move: toNotation })}`;
  }
  return `${pieceSymbol} ${pieceName} ${fromNotation}→${toNotation}`;
}

/**
 * Gets a localized piece name
 */
export function getPieceName(type: string): string {
  const names: Record<string, string> = {
    p: t('piece.p'),
    r: t('piece.r'),
    n: t('piece.n'),
    b: t('piece.b'),
    q: t('piece.q'),
    k: t('piece.k'),
    a: t('piece.a'),
    c: t('piece.c'),
    e: t('piece.e'),
    j: t('piece.j'),
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
        showToast(t('toast.guessCorrect'), 'success');
      } else {
        showToast(t('toast.guessNotBest'), 'neutral');
      }
    }
  }
}

/**
 * After a suboptimal move, reverse it on the live board briefly and search for
 * a better alternative for the side that just moved. Restores the board always.
 */
export async function findBetterAlternative(
  game: GameLike,
  played: MoveInfo,
  turn: Player,
  captured: Piece | null | undefined
): Promise<BetterMoveSuggestion | null> {
  const board = game.board;
  if (!board) return null;

  const mover = board[played.to.r]?.[played.to.c];
  if (!mover) return null;

  // Only reverse simple non-special moves (no castling/en-passant/promotion)
  const fromEmpty = !board[played.from.r]?.[played.from.c];
  if (!fromEmpty) return null;

  board[played.from.r][played.from.c] = mover;
  board[played.to.r][played.to.c] = captured ?? null;

  try {
    const isTestEnv =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      (navigator.webdriver === true ||
        (window as Window & { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ === true);

    const top = await getTopMoves(board, turn, 2, isTestEnv ? 1 : 2, isTestEnv ? 400 : 1200);
    if (!top?.length || !top[0]?.move) return null;

    const best = top[0].move as MoveInfo & { from: Square; to: Square };
    if (
      best.from.r === played.from.r &&
      best.from.c === played.from.c &&
      best.to.r === played.to.r &&
      best.to.c === played.to.c
    ) {
      // Same as played — try second candidate
      const second = top[1]?.move as MoveInfo | undefined;
      if (!second) return null;
      const notation = getMoveNotation(game, second);
      return {
        from: second.from,
        to: second.to,
        score: top[1].score,
        notation,
      };
    }

    const notation = getMoveNotation(game, best);
    return {
      from: best.from,
      to: best.to,
      score: top[0].score,
      notation,
    };
  } catch {
    return null;
  } finally {
    // Restore post-move board
    board[played.to.r][played.to.c] = mover;
    board[played.from.r][played.from.c] = null;
  }
}

/**
 * Checks move quality after a human move: quality badge + tutor explanation toast.
 * On inaccuracy/mistake/blunder, searches a better alternative and draws an arrow.
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
  const turn = (moveRecord.piece?.color || game.turn) as Player;

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
  const playerBest = turn === 'white' ? (bestScore ?? prevEval) : -(bestScore ?? prevEval);
  const playerScore = turn === 'white' ? currentEvalNum : -currentEvalNum;

  const analysis = analyzeMoveWithExplanation(
    game,
    { from: moveRecord.from, to: moveRecord.to },
    playerScore,
    playerBest
  );

  // Suggest a better move when the played one was clearly suboptimal
  const wantsAlt =
    analysis.category === 'inaccuracy' ||
    analysis.category === 'mistake' ||
    analysis.category === 'blunder' ||
    drop >= 150;

  if (wantsAlt) {
    const better = await findBetterAlternative(
      game,
      { from: moveRecord.from, to: moveRecord.to },
      turn,
      moveRecord.captured
    );
    if (better) {
      analysis.betterMove = better;
      showBetterMoveArrow(game, better);
    }
  }

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

  // Auto-hint after a blunder (M3.3): proactive tutor tip with the better
  // move — opt-in via settings, default off.
  if (
    analysis.category === 'blunder' &&
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('auto_hint_blunder') === 'true'
  ) {
    const betterText = analysis.betterMove
      ? t('tutor.betterWouldBe', { move: getMoveNotation(game, analysis.betterMove) })
      : 'Schau dir die Stellung noch einmal an.';
    showToast(`💡 Auto-Hinweis: ${analysis.qualityLabel} — ${betterText}`, 'warning');
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
  const warnings = uniqueReasons(analysis.warnings).join('\n');
  const tactical = uniqueReasons(analysis.tacticalExplanations);
  // The reasons are listed verbatim below, so a summary line would repeat them.
  const detail = [warnings, tactical.join('\n')].filter(part => part.trim().length > 0).join('\n');
  // Only claim "no motif" when nothing at all was found — the warnings list can
  // itself carry tactical motifs (hanging piece, discovered attack).
  const explanation =
    detail ||
    'Kein konkretes taktisches Motiv erkannt, aber die Stellung verschlechtert sich deutlich.';

  const isPreMove = !!proceedCallback;
  const title = isPreMove ? '⚠️ Warnung: Grober Fehler?' : '⚠️ Schwerer Fehler (Blunder)';
  const diff = (analysis.scoreDiff / -100).toFixed(1);

  const message = (
    isPreMove
      ? [t('tutor.worsenByPawns', { pawns: diff }), explanation, t('tutor.confirmMove')]
      : [
          `Dieser Zug verschlechtert deine Stellung um ${diff} Bauern.`,
          explanation,
          t('tutor.confirmUndo'),
        ]
  )
    .filter(part => part && part.trim().length > 0)
    .join('\n\n');

  const buttons = isPreMove
    ? [
        { text: 'Abbrechen', class: 'btn-secondary' },
        { text: 'Trotzdem ziehen', class: 'btn-primary', callback: proceedCallback },
      ]
    : [
        { text: 'Nein, weiterspielen', class: 'btn-secondary' },
        {
          text: t('tutor.confirmUndoYes'),
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
