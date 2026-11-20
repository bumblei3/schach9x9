/**
 * Modul für HUD-Elemente, Spielstatus und Statistiken.
 * @module GameStatusUI
 */
import { BOARD_SIZE, PHASES, PIECE_VALUES } from '../config.js';
import { getOpeningName } from '../ai/OpeningDatabase.js';
import { openingBookUI } from './OpeningBookUI.js';
import type { Game, MoveHistoryEntry } from '../gameEngine.js';
import { computeMaterialSeries } from '../analyze/materialSeries.js';
import { buildVariantTree } from '../analyze/variantTree.js';
import { rulesFromPosition } from '../ai/ruleState.js';
import type { Piece } from '../types/core.js';
import { moveToAlgebraic } from '../openingTrainer.js';
import { t } from '../i18n.js';

/** Helper: access dynamic properties not in Game interface */
const g = <T>(game: Game, key: string): T | undefined =>
  (game as unknown as Record<string, T>)[key];

/**
 * Aktualisiert die Zughistorie im UI.
 */
export function updateMoveHistoryUI(game: Game): void {
  const historyEl = document.getElementById('move-history');
  if (!historyEl) return;
  try {
    historyEl.innerHTML = '';
    const pieceSymbols: Record<string, string> = {
      p: '',
      n: 'N',
      b: 'B',
      r: 'R',
      q: 'Q',
      k: 'K',
      a: 'A',
      c: 'C',
      e: 'E',
    };
    const qualityMeta: Record<string, { symbol: string; color: string }> = {
      brilliant: { symbol: '!!', color: '#31c48d' },
      great: { symbol: '!', color: '#31c48d' },
      best: { symbol: '★', color: '#9f5fef' },
      excellent: { symbol: '□', color: '#93c5fd' },
      good: { symbol: '✔', color: '#d1d5db' },
      inaccuracy: { symbol: '?!', color: '#facc15' },
      mistake: { symbol: '?', color: '#f97316' },
      blunder: { symbol: '??', color: '#f87171' },
    };
    game.moveHistory.forEach((move, index) => {
      const moveEl = document.createElement('div');
      moveEl.className = 'move-entry';
      let moveText = '';
      const sm = move.specialMove;
      if (sm?.type === 'castling') {
        moveText = sm.isKingside ? 'O-O' : 'O-O-O';
      } else {
        moveText += pieceSymbols[move.piece!.type];
        if (move.piece!.type === 'p' && move.captured)
          moveText += String.fromCharCode(97 + move.from.c);
        if (move.captured || sm?.type === 'enPassant') moveText += 'x';
        moveText += String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);
        if (sm?.type === 'promotion') moveText += `=${pieceSymbols[sm.promotedTo || ''] || ''}`;
      }
      moveEl.textContent = `${index + 1}. ${moveText}`;

      // Add per-move time if recorded
      if (move.timeUsed !== undefined) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'move-time';
        timeSpan.style.opacity = '0.6';
        timeSpan.style.fontSize = '0.8em';
        timeSpan.style.marginLeft = '4px';
        timeSpan.textContent = `(${(move.timeUsed / 1000).toFixed(1)}s)`;
        moveEl.appendChild(timeSpan);
      }

      // Add quality badge if analyzed
      const classification = move.classification;
      if (classification && qualityMeta[classification]) {
        const badge = document.createElement('span');
        badge.className = 'move-quality-badge';
        badge.textContent = qualityMeta[classification].symbol;
        badge.style.backgroundColor = qualityMeta[classification].color;
        badge.title = classification.charAt(0).toUpperCase() + classification.slice(1);
        moveEl.appendChild(badge);
      }

      historyEl.appendChild(moveEl);
    });
    historyEl.scrollTop = historyEl.scrollHeight;
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;
  } catch (error) {
    console.error('Error updating move history:', error);
  }
}

/**
 * Aktualisiert die Anzeige der geschlagenen Figuren.
 */
export function updateCapturedUI(game: Game): void {
  const whiteContainer = document.getElementById('captured-white');
  const blackContainer = document.getElementById('captured-black');
  if (!whiteContainer || !blackContainer) return;
  whiteContainer.innerHTML = '';
  blackContainer.innerHTML = '';
  let whiteMaterial = 0,
    blackMaterial = 0;
  for (let r = 0; r < game.boardSize; r++) {
    for (let c = 0; c < game.boardSize; c++) {
      const p = game.board[r][c];
      if (p) {
        const val = PIECE_VALUES[p.type] || 0 || 0;
        if (p.color === 'white') whiteMaterial += val;
        else blackMaterial += val;
      }
    }
  }
  const materialDiff = whiteMaterial - blackMaterial;
  const getSymbol = (p: { color: string; type: string }) => {
    if ((window as unknown as Record<string, Record<string, string>>)._svgCache)
      return (window as unknown as Record<string, Record<string, string>>)._svgCache[
        p.color + p.type
      ];
    return p.type;
  };
  game.capturedPieces.white.forEach(p => {
    const el = document.createElement('div');
    el.className = 'captured-piece';
    el.innerHTML = getSymbol(p);
    whiteContainer.appendChild(el);
  });
  if (materialDiff > 0) {
    const adv = document.createElement('div');
    adv.className = 'material-advantage white-adv';
    adv.textContent = `+${materialDiff}`;
    whiteContainer.appendChild(adv);
  }
  game.capturedPieces.black.forEach(p => {
    const el = document.createElement('div');
    el.className = 'captured-piece';
    el.innerHTML = getSymbol(p);
    blackContainer.appendChild(el);
  });
  if (materialDiff < 0) {
    const adv = document.createElement('div');
    adv.className = 'material-advantage black-adv';
    adv.textContent = `+${Math.abs(materialDiff)}`;
    blackContainer.appendChild(adv);
  }
}

/**
 * Aktualisiert die Statusanzeige.
 */
export function updateStatus(game: Game): void {
  const statusEl = document.getElementById('status-display');
  if (!statusEl) return;
  const side = game.turn === 'white' ? t('game.sideWhite') : t('game.sideBlack');
  let text = '';
  switch (game.phase) {
    case PHASES.SETUP_WHITE_KING:
      text = t('game.statusSetupWhiteKing');
      break;
    case PHASES.SETUP_BLACK_KING:
      text = t('game.statusSetupBlackKing');
      break;
    case PHASES.SETUP_WHITE_PIECES:
      text = t('game.statusSetupWhitePieces');
      break;
    case PHASES.SETUP_BLACK_PIECES:
      text = t('game.statusSetupBlackPieces');
      break;
    case PHASES.SETUP_WHITE_UPGRADES:
      text = t('game.statusSetupWhiteUpgrades');
      break;
    case PHASES.SETUP_BLACK_UPGRADES:
      text = t('game.statusSetupBlackUpgrades');
      break;
    case PHASES.PLAY: {
      const inCheck = typeof game.isInCheck === 'function' ? game.isInCheck(game.turn) : false;
      text = inCheck ? t('game.statusCheck', { side }) : t('game.statusPlay', { side });
      statusEl.classList.toggle('status-check-active', !!inCheck);
      break;
    }
    case PHASES.ANALYSIS:
      text = t('game.statusAnalysis', { side });
      break;
    case PHASES.GAME_OVER: {
      // `game.turn` ist am Ende die *bedrängte* Seite — daraus keinen Sieger
      // ableiten. `winner` wird an allen GAME_OVER-Stellen gesetzt.
      const winner = game.winner;
      text =
        winner === 'draw'
          ? t('game.statusGameOverDraw')
          : winner
            ? t('game.statusGameOverWinner', {
                side: winner === 'white' ? t('game.sideWhite') : t('game.sideBlack'),
              })
            : t('game.statusGameOverWinner', { side });
      break;
    }
  }
  statusEl.textContent = text;
  if (game.phase !== PHASES.PLAY) {
    statusEl.classList.remove('status-check-active', 'status-check');
  }
  updateOpeningUI(game);
}

/**
 * Aktualisiert die Anzeige des Eröffnungsnamens.
 */
export function updateOpeningUI(game: Game): void {
  const container = document.getElementById('opening-name-container');
  const nameEl = document.getElementById('opening-name');
  if (!container || !nameEl) return;

  if (game.phase !== PHASES.PLAY) {
    container.classList.add('hidden');
    return;
  }

  const hash = game.getBoardHash();
  const openingName = getOpeningName(hash);

  if (openingName) {
    nameEl.textContent = openingName;
    container.classList.remove('hidden');
  } else {
    if (game.moveHistory.length > 15) {
      container.classList.add('hidden');
    }
  }

  // Also update the Opening Book UI if it's visible
  if (openingBookUI.visible) {
    openingBookUI.setGame(game);
    openingBookUI.updateCurrentOpening();
  }
}

/**
 * Aktualisiert die Uhren-UI (aktive Farbe).
 */
export function updateClockUI(game: Game): void {
  const whiteClockEl = document.getElementById('clock-white');
  const blackClockEl = document.getElementById('clock-black');
  const headerWhite = document.getElementById('header-clock-white');
  const headerBlack = document.getElementById('header-clock-black');
  const whiteActive = game.turn === 'white';
  const blackActive = !whiteActive;
  const whiteLow = game.whiteTime < 30;
  const blackLow = game.blackTime < 30;

  for (const el of [whiteClockEl, headerWhite]) {
    if (!el) continue;
    el.classList.remove('active', 'low-time');
    if (whiteActive) {
      el.classList.add('active');
      if (whiteLow) el.classList.add('low-time');
    }
  }
  for (const el of [blackClockEl, headerBlack]) {
    if (!el) continue;
    el.classList.remove('active', 'low-time');
    if (blackActive) {
      el.classList.add('active');
      if (blackLow) el.classList.add('low-time');
    }
  }
}

/**
 * Aktualisiert die Zeitanzeige.
 */
export function updateClockDisplay(game: Game): void {
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0')}`;
  const whiteEl = document.getElementById('clock-white');
  const blackEl = document.getElementById('clock-black');
  const headerWhite = document.getElementById('header-clock-white');
  const headerBlack = document.getElementById('header-clock-black');
  const w = formatTime(game.whiteTime);
  const b = formatTime(game.blackTime);
  if (whiteEl) whiteEl.textContent = w;
  if (blackEl) blackEl.textContent = b;
  if (headerWhite) headerWhite.textContent = w;
  if (headerBlack) headerBlack.textContent = b;
}

/**
 * Rendert den Evaluationsgraphen.
 */
export function renderEvalGraph(game: Game): void {
  if (game.isAnimating) return;
  const container = document.getElementById('eval-graph-container');
  const svg = document.getElementById('eval-graph') as unknown as SVGSVGElement & {
    dataset: Record<string, string>;
  };
  if (!container || !svg) return;
  if (game.phase === PHASES.ANALYSIS || game.phase === PHASES.GAME_OVER)
    container.classList.remove('hidden');
  const history = game.moveHistory;
  if (history.length === 0) {
    svg.innerHTML = '';
    return;
  }
  const scores = [0, ...history.map(m => (m as { evalScore?: number }).evalScore || 0)];
  const width = 1000,
    height = 100,
    centerY = height / 2,
    maxEval = 1000;
  const points = scores.map((score, i) => {
    const x = (i / (scores.length - 1)) * width;
    const norm = Math.max(-maxEval, Math.min(maxEval, score));
    const y = centerY - (norm / maxEval) * (height / 2);
    return { x, y, score, index: i - 1 };
  });
  let svgContent = `<defs><linearGradient id="eval-gradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#4ade80;stop-opacity:1" /><stop offset="50%" style="stop-color:#4f9cf9;stop-opacity:1" /><stop offset="100%" style="stop-color:#f87171;stop-opacity:1" /></linearGradient><linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#4ade80;stop-opacity:0.3" /><stop offset="50%" style="stop-color:#4f9cf9;stop-opacity:0.1" /><stop offset="100%" style="stop-color:#f87171;stop-opacity:0.3" /></linearGradient></defs><line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" class="eval-zero-line" />`;
  if (points.length > 1) {
    let areaPath = `M ${points[0].x} ${centerY} `;
    points.forEach(p => {
      areaPath += `L ${p.x} ${p.y} `;
    });
    areaPath += `L ${points[points.length - 1].x} ${centerY} Z`;
    svgContent += `<path d="${areaPath}" class="eval-area" />`;
    let linePath = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) linePath += `L ${points[i].x} ${points[i].y} `;
    svgContent += `<path d="${linePath}" class="eval-line" />`;
  }
  points.forEach((p, i) => {
    const skip = Math.ceil(points.length / 50);
    if (i % skip === 0 || i === points.length - 1)
      svgContent += `<circle cx="${p.x}" cy="${p.y}" r="3" class="eval-point" data-index="${p.index}"><title>Zug ${i}: ${(p.score / 100).toFixed(2)}</title></circle>`;
  });
  svg.innerHTML = svgContent;
  if (!svg.dataset.hasListener) {
    svg.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement | null;
      const p = target?.closest('.eval-point');
      if (!p) return;
      const idx = parseInt((p as HTMLElement).dataset.index || '0');
      if (idx >= 0 && (game.gameController as unknown as Record<string, unknown>)?.jumpToMove)
        (game.gameController as unknown as Record<string, (_idx: number) => void>).jumpToMove(idx);
      else if (
        idx === -1 &&
        (game.gameController as unknown as Record<string, unknown>)?.jumpToStart
      )
        (game.gameController as unknown as Record<string, () => void>).jumpToStart();
    });
    svg.dataset.hasListener = 'true';
  }
}

/**
 * Renders the material-balance graph (white vs black material over the game)
 * into #material-graph. Mirrors renderEvalGraph but plots the material DIFF
 * (whiteMaterial - blackMaterial in centi-pawns) instead of the engine eval.
 */
export function renderMaterialGraph(game: Game): void {
  const container = document.getElementById('material-graph-container');
  const svg = document.getElementById('material-graph') as unknown as SVGSVGElement & {
    dataset: Record<string, string>;
  };
  if (!container || !svg) return;
  if (game.phase === PHASES.ANALYSIS || game.phase === PHASES.GAME_OVER)
    container.classList.remove('hidden');
  const history = game.moveHistory;
  if (history.length === 0) {
    svg.innerHTML = '';
    return;
  }
  const series = computeMaterialSeries(history as MoveHistoryEntry[]);
  const scores = series.points.map(p => p.diff);
  const width = 1000,
    height = 100,
    centerY = height / 2,
    maxDiff = 2000; // centi-pawns; clamp large material swings
  const points = scores.map((score, i) => {
    const x = (i / (scores.length - 1)) * width;
    const norm = Math.max(-maxDiff, Math.min(maxDiff, score));
    const y = centerY - (norm / maxDiff) * (height / 2);
    return { x, y, score, index: i - 1 };
  });
  let svgContent = `<defs><linearGradient id="mat-gradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#4ade80;stop-opacity:1" /><stop offset="50%" style="stop-color:#fbbf24;stop-opacity:1" /><stop offset="100%" style="stop-color:#f87171;stop-opacity:1" /></linearGradient></defs><line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" class="eval-zero-line" />`;
  if (points.length > 1) {
    let areaPath = `M ${points[0].x} ${centerY} `;
    points.forEach(p => {
      areaPath += `L ${p.x} ${p.y} `;
    });
    areaPath += `L ${points[points.length - 1].x} ${centerY} Z`;
    svgContent += `<path d="${areaPath}" class="eval-area" />`;
    let linePath = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) linePath += `L ${points[i].x} ${points[i].y} `;
    svgContent += `<path d="${linePath}" class="eval-line" />`;
  }
  points.forEach((p, i) => {
    const skip = Math.ceil(points.length / 50);
    if (i % skip === 0 || i === points.length - 1)
      svgContent += `<circle cx="${p.x}" cy="${p.y}" r="3" class="eval-point" data-index="${p.index}"><title>Zug ${i}: ${p.score > 0 ? '+' : ''}${(p.score / 100).toFixed(2)} (weiß)</title></circle>`;
  });
  svg.innerHTML = svgContent;
}

/**
 * Renders the move-time chart (execution time per move, in seconds) into
 * #move-time-graph. Mirrors the other post-game charts but draws bars
 * (one per move) instead of a line, since move time is a discrete per-move
 * value rather than a continuous series.
 */
export function renderMoveTimeGraph(game: Game): void {
  const container = document.getElementById('move-time-graph-container');
  const svg = document.getElementById('move-time-graph') as unknown as SVGSVGElement & {
    dataset: Record<string, string>;
  };
  if (!container || !svg) return;
  if (game.phase === PHASES.ANALYSIS || game.phase === PHASES.GAME_OVER)
    container.classList.remove('hidden');
  const history = game.moveHistory;
  if (history.length === 0) {
    svg.innerHTML = '';
    return;
  }
  const times = history.map(m => ((m as { timeUsed?: number }).timeUsed ?? 0) / 1000); // seconds
  const width = 1000,
    height = 100;
  const maxTime = Math.max(1, ...times); // avoid divide-by-zero
  const barW = width / times.length;
  let svgContent = `<line x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}" class="eval-zero-line" />`;
  times.forEach((t, i) => {
    const h = (t / maxTime) * (height - 4);
    const x = i * barW;
    const y = height - h;
    const color = t > maxTime * 0.66 ? '#f87171' : t > maxTime * 0.33 ? '#fbbf24' : '#4ade80';
    svgContent += `<rect x="${x + 1}" y="${y}" width="${Math.max(0.5, barW - 2)}" height="${Math.max(0.5, h)}" fill="${color}" class="time-bar" data-index="${i}"><title>Zug ${i + 1}: ${t.toFixed(2)}s</title></rect>`;
  });
  svg.innerHTML = svgContent;
}

/**
 * Renders the variant-tree panel (#variant-tree) after a SOLO game ends.
 *
 * Builds the top-N candidate moves for the side to move (plus each one's best
 * reply chain) via `buildVariantTree`, and lists them as `.variant-root` divs
 * inside #variant-tree. `buildVariantTree` is async (KI search), so this
 * function is async and awaits it before touching the DOM.
 *
 * IMPORTANT: this is a post-game render and must NOT be guarded by the
 * animation/isAnimating state — after resign the game can still briefly report
 * isAnimating, and a guard would leave the panel empty.
 */
export async function renderVariantTree(game: Game): Promise<void> {
  const container = document.getElementById('variant-tree-container');
  const root = document.getElementById('variant-tree');
  if (!container || !root) return;

  // Only show after solo games that actually had moves.
  if (!game.moveHistory || game.moveHistory.length === 0) return;

  container.classList.remove('hidden');

  const board = game.board as (Piece | null)[][];
  const turn: 'white' | 'black' = game.turn === 'white' ? 'white' : 'black';
  // Awaiting the async KI search before rendering — no isAnimating guard.
  const nodes = await buildVariantTree(board, turn, 3, 2, rulesFromPosition(board, game.lastMove));
  if (nodes.length === 0) return; // nothing to show; keep panel hidden

  container.classList.remove('hidden');
  root.innerHTML = '';
  for (const node of nodes) {
    const line = document.createElement('div');
    line.className = 'variant-root';
    const moveStr = moveToAlgebraic(node.move.from, node.move.to, 9);
    const contStr = node.continuation.map(m => moveToAlgebraic(m.from, m.to, 9)).join(' → ');
    line.textContent =
      `${moveStr} (${node.score >= 0 ? '+' : ''}${node.score})` +
      (contStr ? `  →  ${contStr}` : '');
    root.appendChild(line);
  }
}

/**
 * Aktualisiert die Statistiken.
 */
export function updateStatistics(game: Game): void {
  const movesEl = document.getElementById('stat-moves');
  if (movesEl) movesEl.textContent = String(game.stats.totalMoves);
  game.stats.captures =
    (game.capturedPieces?.white?.length || 0) + (game.capturedPieces?.black?.length || 0);
  const capturesEl = document.getElementById('stat-captures');
  if (capturesEl) capturesEl.textContent = String(game.stats.captures);

  // Accuracy display based on recorded accuracies
  const accuracyEl = document.getElementById('stat-accuracy');
  if (accuracyEl) {
    if (game.stats.accuracies && game.stats.accuracies.length > 0) {
      const avgAcc =
        game.stats.accuracies.reduce((a, b) => a + b, 0) / game.stats.accuracies.length;
      accuracyEl.textContent = Math.round(avgAcc) + '%';
    } else {
      accuracyEl.textContent = '--%';
    }
  }

  // Elo estimation display
  const eloEl = document.getElementById('stat-elo');
  if (eloEl && game.getEstimatedElo) {
    eloEl.textContent = String(game.getEstimatedElo());
  }

  const bestMovesEl = document.getElementById('stat-best-moves');
  if (bestMovesEl) bestMovesEl.textContent = String(game.stats.playerBestMoves);

  if (g<(_color?: string) => number>(game, 'calculateMaterialAdvantage')) {
    const adv = g<(_color?: string) => number>(game, 'calculateMaterialAdvantage')!(game.turn);
    const materialEl = document.getElementById('stat-material');
    if (materialEl) {
      materialEl.textContent = adv > 0 ? '+' + adv : String(adv);
      materialEl.classList.remove('positive', 'negative');
      if (adv > 0) materialEl.classList.add('positive');
      else if (adv < 0) materialEl.classList.add('negative');
    }
  }
}

/**
 * Zeigt das Statistik-Overlay.
 */
export function showStatisticsOverlay(game: Game): void {
  const overlay = document.getElementById('stats-overlay');
  if (overlay) {
    updateStatistics(game);
    overlay.classList.remove('hidden');
  }
}
