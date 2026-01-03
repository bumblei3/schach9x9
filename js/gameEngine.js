// gameEngine.js

/**
 * Enthält die Spiellogik und Game-Klasse für Schach9x9
 * @module gameEngine
 */

import {
  BOARD_SIZE,
  PHASES,
  PIECE_VALUES,
  DEFAULT_TIME_CONTROL,
  DEFAULT_DIFFICULTY,
  AI_DELAY_MS,
} from './config.js';
import { RulesEngine } from './RulesEngine.js';
import { makeMove } from './ai/MoveGenerator.js';

export { BOARD_SIZE, PHASES, PIECE_VALUES, AI_DELAY_MS };

/**
 * Hauptklasse für die Spiellogik und den Spielzustand von Schach9x9
 */
export class Game {
  constructor(initialPoints = 15, mode = 'setup') {
    this.mode = mode;
    this.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    if (this.mode === 'classic') {
      this.phase = PHASES.PLAY;
      this.setupClassicBoard();
    } else {
      this.phase = PHASES.SETUP_WHITE_KING;
    }

    this.turn = 'white';
    this.points = initialPoints;
    this.initialPoints = initialPoints;
    this.selectedShopPiece = null;
    this.whiteCorridor = null;
    this.blackCorridor = null;
    this.isAI = true;
    this.difficulty = DEFAULT_DIFFICULTY;
    this.moveHistory = [];
    this.redoStack = []; // For redo functionality
    this.halfMoveClock = 0;
    this.positionHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.selectedSquare = null;
    this.validMoves = null;
    this.lastMoveHighlight = null;
    this.lastMove = null;
    this.stats = {
      totalMoves: 0,
      playerMoves: 0,
      playerBestMoves: 0,
      captures: 0,
      accuracies: [],
    };
    this.clockEnabled = false;
    this.timeControl = { ...DEFAULT_TIME_CONTROL };
    this.whiteTime = DEFAULT_TIME_CONTROL.base;
    this.blackTime = DEFAULT_TIME_CONTROL.base;
    this.clockInterval = null;
    this.lastMoveTime = Date.now();
    this.replayMode = false;
    this.replayPosition = -1;
    this.savedGameState = null;
    this.isAnimating = false;
    this.bestMoves = [];
    this.drawOffered = false;
    this.drawOfferedBy = null;
    // Analysis mode state
    this.analysisMode = false;
    this.analysisBasePosition = null; // Save point before entering analysis
    this.analysisVariations = []; // Track explored variations
    this.continuousAnalysis = false;
    // Puzzle Mode State
    this.puzzleState = null;

    this.rulesEngine = new RulesEngine(this);
  }

  setupClassicBoard() {
    // Setup Pawns
    for (let c = 0; c < BOARD_SIZE; c++) {
      this.board[1][c] = { type: 'p', color: 'black', hasMoved: false };
      this.board[BOARD_SIZE - 2][c] = { type: 'p', color: 'white', hasMoved: false };
    }

    // Setup Pieces: R N B Q K Q B N R
    const pieces = ['r', 'n', 'b', 'q', 'k', 'q', 'b', 'n', 'r'];
    for (let c = 0; c < BOARD_SIZE; c++) {
      this.board[0][c] = { type: pieces[c], color: 'black', hasMoved: false };
      this.board[BOARD_SIZE - 1][c] = { type: pieces[c], color: 'white', hasMoved: false };
    }
  }

  log(message) {
    const logPanel = document.getElementById('log-panel');
    if (!logPanel) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  // ...weitere Methoden wie in main.js...
  /**
   * Returns all LEGAL moves (handling check)
   * @param {number} r
   * @param {number} c
   * @param {object} piece
   * @returns {Array}
   */
  getValidMoves(r, c, piece) {
    return this.rulesEngine.getValidMoves(r, c, piece);
  }

  getPseudoLegalMoves(r, c, piece) {
    return this.rulesEngine.getPseudoLegalMoves(r, c, piece);
  }

  isSquareUnderAttack(r, c, attackerColor) {
    return this.rulesEngine.isSquareUnderAttack(r, c, attackerColor);
  }

  /**
   * Find the position of the king for a given color
   * @param {string} color - 'white' or 'black'
   * @returns {object|null} Position {r, c} or null if not found
   */
  findKing(color) {
    return this.rulesEngine.findKing(color);
  }

  isInCheck(color) {
    return this.rulesEngine.isInCheck(color);
  }

  isCheckmate(color) {
    return this.rulesEngine.isCheckmate(color);
  }

  getAllLegalMoves(color) {
    return this.rulesEngine.getAllLegalMoves(color);
  }

  isStalemate(color) {
    return this.rulesEngine.isStalemate(color);
  }

  /**
   * Calculates estimated Elo based on move accuracy
   * @returns {number} Estimated Elo
   */
  getEstimatedElo() {
    if (this.stats.accuracies.length === 0) return 600;

    // Filter out opening moves (usually 100% accuracy but don't say much about skill)
    const midgameAccuracies = this.stats.accuracies.slice(5);
    const evaluationList = midgameAccuracies.length > 0 ? midgameAccuracies : this.stats.accuracies;

    const avgAccuracy = evaluationList.reduce((a, b) => a + b, 0) / evaluationList.length;

    // Linear mapping with caps: 50% -> 800, 100% -> 2400
    const elo = 800 + (avgAccuracy - 50) * 32;
    return Math.max(400, Math.min(2800, Math.round(elo)));
  }

  /**
   * Generates a string hash for the current board state
   * Format matches OpeningBook's hash
   */
  getBoardHash() {
    let hash = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        hash += piece ? `${piece.color[0]}${piece.type}` : '..';
      }
    }
    hash += this.turn[0];
    return hash;
  }

  /**
   * Execute a move on the board
   * @param {object} from - {r, c}
   * @param {object} to - {r, c}
   */
  executeMove(from, to) {
    const move = { from, to };
    const undoInfo = makeMove(this.board, move);

    // Update game state
    this.moveHistory.push(undoInfo); // Usually we store undoInfo or move. Let's match what AI does or simple move?
    // AIController usually pushes JUST the move object {from, to, ...} to game.moveHistory
    // But Game.moveHistory usually keeps enough to undo.
    // The simplified Game here in gameEngine might be different from main App logic if not unified.
    // But BookGenerator uses THIS class.

    this.turn = this.turn === 'white' ? 'black' : 'white';

    return undoInfo;
  }
}

/**
 * Erstellt ein leeres 9x9-Schachbrett
 * @returns {Array<Array<null>>} Leeres Spielfeld
 */
export function createEmptyBoard() {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}
