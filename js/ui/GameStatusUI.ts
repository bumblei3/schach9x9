/**
 * Modul für HUD-Elemente, Spielstatus und Statistiken.
 * @module GameStatusUI
 */
import { BOARD_SIZE, PHASES, PIECE_VALUES } from '../config.js';
import { renderBoard } from './BoardRenderer.js';
import { getOpeningName } from '../ai/OpeningDatabase.js';
import { openingBookUI } from './OpeningBookUI.js';
import type { Game, PieceWithMoved } from '../gameEngine.js';
import type { Square } from '../types/game.js';

interface SavedGameState {
  board: (PieceWithMoved | null)[][];
  turn: 'white' | 'black';
  selectedSquare: Square | null;
  validMoves: Square[];
  lastMoveHighlight: { from: Square; to: Square } | null;
}

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
  let text = '';
  switch (game.phase) {
    case PHASES.SETUP_WHITE_KING:
      text = 'Weiß: Wähle einen Korridor für den König';
      break;
    case PHASES.SETUP_BLACK_KING:
      text = 'Schwarz: Wähle einen Korridor für den König';
      break;
    case PHASES.SETUP_WHITE_PIECES:
      text = 'Weiß: Kaufe Truppen';
      break;
    case PHASES.SETUP_BLACK_PIECES:
      text = 'Schwarz: Kaufe Truppen';
      break;
    case PHASES.SETUP_WHITE_UPGRADES:
      text = 'Weiß: Klicke eine Figur für Upgrades';
      break;
    case PHASES.SETUP_BLACK_UPGRADES:
      text = 'Schwarz: Klicke eine Figur für Upgrades';
      break;
    case PHASES.PLAY:
      text = `Spiel läuft - ${game.turn === 'white' ? 'Weiß' : 'Schwarz'} am Zug`;
      break;
    case PHASES.ANALYSIS:
      text = `🔍 Analyse-Modus - ${game.turn === 'white' ? 'Weiß' : 'Schwarz'} am Zug`;
      break;
    case PHASES.GAME_OVER:
      text = `Spiel vorbei! ${game.turn === 'white' ? 'Weiß' : 'Schwarz'} hat gewonnen!`;
      break;
  }
  statusEl.textContent = text;
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
  if (whiteClockEl && blackClockEl) {
    whiteClockEl.classList.remove('active', 'low-time');
    blackClockEl.classList.remove('active', 'low-time');
    if (game.turn === 'white') {
      whiteClockEl.classList.add('active');
      if (game.whiteTime < 30) whiteClockEl.classList.add('low-time');
    } else {
      blackClockEl.classList.add('active');
      if (game.blackTime < 30) blackClockEl.classList.add('low-time');
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
  if (whiteEl) whiteEl.textContent = formatTime(game.whiteTime);
  if (blackEl) blackEl.textContent = formatTime(game.blackTime);
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

/**
 * Replay-Modus Funktionen.
 */
export function updateReplayUI(game: Game): void {
  const moveNumEl = document.getElementById('replay-move-num');
  if (moveNumEl) moveNumEl.textContent = String(game.replayPosition + 1);
  const first = document.getElementById('replay-first') as HTMLButtonElement,
    prev = document.getElementById('replay-prev') as HTMLButtonElement,
    next = document.getElementById('replay-next') as HTMLButtonElement,
    last = document.getElementById('replay-last') as HTMLButtonElement;
  if (first) first.disabled = game.replayPosition === -1;
  if (prev) prev.disabled = game.replayPosition === -1;
  if (next) next.disabled = game.replayPosition === game.moveHistory.length - 1;
  if (last) last.disabled = game.replayPosition === game.moveHistory.length - 1;
  renderBoard(game);
}

export function enterReplayMode(game: Game): void {
  if (game.replayMode || game.moveHistory.length === 0) return;
  const gk = game as unknown as Record<string, unknown>;
  gk.savedGameState = {
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    selectedSquare: game.selectedSquare,
    validMoves: game.validMoves,
    lastMoveHighlight: game.lastMoveHighlight,
  };
  game.replayMode = true;
  game.replayPosition = game.moveHistory.length - 1;
  if (gk.stopClock) (gk.stopClock as () => void)();

  const statusEl = document.getElementById('replay-status');
  const exitEl = document.getElementById('replay-exit');
  const controlEl = document.getElementById('replay-control');
  if (statusEl) statusEl.classList.remove('hidden');
  if (exitEl) exitEl.classList.remove('hidden');
  if (controlEl) controlEl.classList.remove('hidden');

  const undo = document.getElementById('undo-btn') as HTMLButtonElement;
  if (undo) undo.disabled = true;
  updateReplayUI(game);
}

export function exitReplayMode(game: Game): void {
  if (!game.replayMode) return;
  const gk = game as unknown as Record<string, unknown>;
  const saved = gk.savedGameState as SavedGameState | null;
  if (saved) {
    game.board = saved.board;
    game.turn = saved.turn;
    game.selectedSquare = saved.selectedSquare;
    game.validMoves = saved.validMoves;
    game.lastMoveHighlight = saved.lastMoveHighlight;
  }
  game.replayMode = false;
  game.replayPosition = -1;
  gk.savedGameState = null;

  const statusEl = document.getElementById('replay-status');
  const exitEl = document.getElementById('replay-exit');
  const controlEl = document.getElementById('replay-control');
  if (statusEl) statusEl.classList.add('hidden');
  if (exitEl) exitEl.classList.add('hidden');
  if (controlEl) controlEl.classList.add('hidden');

  const undo = document.getElementById('undo-btn') as HTMLButtonElement;
  if (undo) undo.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;
  renderBoard(game);
  const gk2 = game as unknown as Record<string, unknown>;
  if (game.clockEnabled && game.phase === PHASES.PLAY && gk2.startClock)
    (gk2.startClock as () => void)();
}
