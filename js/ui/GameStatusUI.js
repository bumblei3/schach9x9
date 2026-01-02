/**
 * Modul für HUD-Elemente, Spielstatus und Statistiken.
 * @module GameStatusUI
 */
import { BOARD_SIZE, PHASES, PIECE_VALUES } from '../config.js';
import { renderBoard } from './BoardRenderer.js';

/**
 * Aktualisiert die Zughistorie im UI.
 */
export function updateMoveHistoryUI(game) {
  const historyEl = document.getElementById('move-history');
  if (!historyEl) return;
  try {
    historyEl.innerHTML = '';
    const pieceSymbols = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K', a: 'A', c: 'C', e: 'E' };
    game.moveHistory.forEach((move, index) => {
      const moveEl = document.createElement('div');
      moveEl.className = 'move-entry';
      let moveText = '';
      if (move.specialMove?.type === 'castling') {
        moveText = move.specialMove.isKingside ? 'O-O' : 'O-O-O';
      } else {
        moveText += pieceSymbols[move.piece.type];
        if (move.piece.type === 'p' && move.capturedPiece)
          moveText += String.fromCharCode(97 + move.from.c);
        if (move.capturedPiece || move.specialMove?.type === 'enPassant') moveText += 'x';
        moveText += String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);
        if (move.specialMove?.type === 'promotion')
          moveText += `=${pieceSymbols[move.specialMove.promotedTo] || ''}`;
      }
      moveEl.textContent = `${index + 1}. ${moveText}`;
      historyEl.appendChild(moveEl);
    });
    historyEl.scrollTop = historyEl.scrollHeight;
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;
  } catch (error) {
    console.error('Error updating move history:', error);
  }
}

/**
 * Aktualisiert die Anzeige der geschlagenen Figuren.
 */
export function updateCapturedUI(game) {
  const whiteContainer = document.getElementById('captured-white');
  const blackContainer = document.getElementById('captured-black');
  if (!whiteContainer || !blackContainer) return;
  whiteContainer.innerHTML = '';
  blackContainer.innerHTML = '';
  let whiteMaterial = 0,
    blackMaterial = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = game.board[r][c];
      if (p) {
        const val = PIECE_VALUES[p.type] || 0;
        if (p.color === 'white') whiteMaterial += val;
        else blackMaterial += val;
      }
    }
  }
  const materialDiff = whiteMaterial - blackMaterial;
  const getSymbol = p => {
    if (window._svgCache && window._svgCache[p.color + p.type])
      return window._svgCache[p.color + p.type];
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
export function updateStatus(game) {
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
}

/**
 * Aktualisiert die Uhren-UI (aktive Farbe).
 */
export function updateClockUI(game) {
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
export function updateClockDisplay(game) {
  const formatTime = seconds =>
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
export function renderEvalGraph(game) {
  if (game.isAnimating) return;
  const container = document.getElementById('eval-graph-container');
  const svg = document.getElementById('eval-graph');
  if (!container || !svg) return;
  if (game.phase === PHASES.ANALYSIS || game.phase === PHASES.GAME_OVER)
    container.classList.remove('hidden');
  const history = game.moveHistory;
  if (history.length === 0) {
    svg.innerHTML = '';
    return;
  }
  const scores = [0, ...history.map(m => m.evalScore || 0)];
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
    svg.addEventListener('click', e => {
      const p = e.target.closest('.eval-point');
      if (!p) return;
      const idx = parseInt(p.dataset.index);
      if (idx >= 0 && game.gameController?.jumpToMove) game.gameController.jumpToMove(idx);
      else if (idx === -1 && game.gameController?.jumpToStart) game.gameController.jumpToStart();
    });
    svg.dataset.hasListener = 'true';
  }
}

/**
 * Aktualisiert die Statistiken.
 */
export function updateStatistics(game) {
  const movesEl = document.getElementById('stat-moves');
  if (movesEl) movesEl.textContent = game.stats.totalMoves;
  game.stats.captures =
    (game.capturedPieces?.white?.length || 0) + (game.capturedPieces?.black?.length || 0);
  const capturesEl = document.getElementById('stat-captures');
  if (capturesEl) capturesEl.textContent = game.stats.captures;
  const accuracyEl = document.getElementById('stat-accuracy');
  if (accuracyEl)
    accuracyEl.textContent =
      game.stats.playerMoves > 0
        ? Math.round((game.stats.playerBestMoves / game.stats.playerMoves) * 100) + '%'
        : '--%';
  const bestMovesEl = document.getElementById('stat-best-moves');
  if (bestMovesEl) bestMovesEl.textContent = game.stats.playerBestMoves;
  if (game.calculateMaterialAdvantage) {
    const adv = game.calculateMaterialAdvantage();
    const materialEl = document.getElementById('stat-material');
    if (materialEl) {
      materialEl.textContent = adv > 0 ? '+' + adv : adv;
      materialEl.classList.remove('positive', 'negative');
      if (adv > 0) materialEl.classList.add('positive');
      else if (adv < 0) materialEl.classList.add('negative');
    }
  }
}

/**
 * Zeigt das Statistik-Overlay.
 */
export function showStatisticsOverlay(game) {
  const overlay = document.getElementById('stats-overlay');
  if (overlay) {
    updateStatistics(game);
    overlay.classList.remove('hidden');
  }
}

/**
 * Replay-Modus Funktionen.
 */
export function updateReplayUI(game) {
  const moveNumEl = document.getElementById('replay-move-num');
  if (moveNumEl) moveNumEl.textContent = game.replayPosition + 1;
  const first = document.getElementById('replay-first'),
    prev = document.getElementById('replay-prev'),
    next = document.getElementById('replay-next'),
    last = document.getElementById('replay-last');
  if (first) first.disabled = game.replayPosition === -1;
  if (prev) prev.disabled = game.replayPosition === -1;
  if (next) next.disabled = game.replayPosition === game.moveHistory.length - 1;
  if (last) last.disabled = game.replayPosition === game.moveHistory.length - 1;
  renderBoard(game);
}

export function enterReplayMode(game) {
  if (game.replayMode || game.moveHistory.length === 0) return;
  game.savedGameState = {
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    selectedSquare: game.selectedSquare,
    validMoves: game.validMoves,
    lastMoveHighlight: game.lastMoveHighlight,
  };
  game.replayMode = true;
  game.replayPosition = game.moveHistory.length - 1;
  if (game.stopClock) game.stopClock();
  document.getElementById('replay-status').classList.remove('hidden');
  document.getElementById('replay-exit').classList.remove('hidden');
  const undo = document.getElementById('undo-btn');
  if (undo) undo.disabled = true;
  updateReplayUI(game);
}

export function exitReplayMode(game) {
  if (!game.replayMode) return;
  if (game.savedGameState) {
    game.board = game.savedGameState.board;
    game.turn = game.savedGameState.turn;
    game.selectedSquare = game.savedGameState.selectedSquare;
    game.validMoves = game.savedGameState.validMoves;
    game.lastMoveHighlight = game.savedGameState.lastMoveHighlight;
  }
  game.replayMode = false;
  game.replayPosition = -1;
  game.savedGameState = null;
  document.getElementById('replay-status').classList.add('hidden');
  document.getElementById('replay-exit').classList.add('hidden');
  const undo = document.getElementById('undo-btn');
  if (undo) undo.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;
  renderBoard(game);
  if (game.clockEnabled && game.phase === PHASES.PLAY && game.startClock) game.startClock();
}
