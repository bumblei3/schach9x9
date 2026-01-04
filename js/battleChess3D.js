/**
 * Battle Chess 3D Module
 * Handles 3D rendering, animations, and battle sequences for Schach 9x9
 * Facade class that orchestrates specialized managers.
 * @module battleChess3D
 */

import { logger } from './logger.js';
import { SceneManager3D } from './ui/3d/SceneManager3D.js';
import { PieceManager3D } from './ui/3d/PieceManager3D.js';
import { InputHandler3D } from './ui/3d/InputHandler3D.js';

/**
 * Main 3D Battle Chess Engine
 */
export class BattleChess3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.enabled = false;

    // Initialize managers
    this.sceneManager = new SceneManager3D(containerElement);
    this.pieceManager = new PieceManager3D(this.sceneManager);
    this.inputHandler = new InputHandler3D(this.sceneManager, this.pieceManager);

    logger.info('[3D] BattleChess3D instance created (Modular)');
  }

  // Getters and Setters for compatibility with tests and external access
  get scene() {
    return this.sceneManager.scene;
  }
  set scene(value) {
    this.sceneManager.scene = value;
  }

  get camera() {
    return this.sceneManager.camera;
  }
  set camera(value) {
    this.sceneManager.camera = value;
  }

  get renderer() {
    return this.sceneManager.renderer;
  }
  set renderer(value) {
    this.sceneManager.renderer = value;
  }

  get controls() {
    return this.sceneManager.controls;
  }
  set controls(value) {
    this.sceneManager.controls = value;
  }

  get battleAnimator() {
    return this.pieceManager.battleAnimator;
  }
  set battleAnimator(value) {
    this.pieceManager.battleAnimator = value;
  }

  get pieces() {
    return this.pieceManager.pieces;
  }
  set pieces(value) {
    this.pieceManager.pieces = value;
  }

  get animating() {
    return this.pieceManager.animating;
  }

  get currentSkin() {
    return this.pieceManager.currentSkin;
  }
  set currentSkin(value) {
    this.pieceManager.currentSkin = value;
  }

  get currentTheme() {
    return this.sceneManager.currentTheme;
  }
  set currentTheme(value) {
    this.sceneManager.currentTheme = value;
  }

  get highlights() {
    return this.pieceManager.highlights;
  }
  set highlights(value) {
    this.pieceManager.highlights = value;
  }

  /**
   * Initialize the 3D scene
   */
  async init() {
    try {
      const success = await this.sceneManager.init();
      if (success) {
        this.pieceManager.init();
        this.inputHandler.enable();
        this.enabled = true;

        // Restore saved settings
        const savedSkin = localStorage.getItem('chess_skin') || 'classic';
        const savedTheme = localStorage.getItem('chess_theme') || 'classic';

        this.pieceManager.setSkin(savedSkin);
        this.sceneManager.setTheme(savedTheme);

        logger.info('3D scene setup complete');
      }
      return success;
    } catch (error) {
      logger.error('Failed to initialize 3D scene:', error);
      return false;
    }
  }

  /**
   * Toggle 3D mode on/off
   */
  toggle(enabled) {
    this.enabled = enabled;
    this.sceneManager.enabled = enabled;

    if (enabled) {
      if (!this.sceneManager.scene) {
        this.init();
      } else {
        this.inputHandler.enable();
        this.sceneManager.animate();
      }
      document.body.classList.add('mode-3d');
      // Force resize after enabling to ensure canvas fits
      setTimeout(() => this.onWindowResize(), 50);
      logger.info('3D mode enabled');
    } else {
      this.inputHandler.disable();
      document.body.classList.remove('mode-3d');
      logger.info('3D mode disabled');
    }
  }

  /**
   * Update 3D board from game state
   */
  updateFromGameState(game) {
    this.pieceManager.updateFromGameState(game);
  }

  /**
   * Animate a piece move
   */
  async animateMove(fromRow, fromCol, toRow, toCol, captured = false) {
    return this.pieceManager.animateMove(fromRow, fromCol, toRow, toCol, captured);
  }

  /**
   * Play battle animation when piece is captured
   */
  async playBattleSequence(attacker, defender, attackerPos, defenderPos) {
    return this.pieceManager.playBattleSequence(attacker, defender, attackerPos, defenderPos);
  }

  /**
   * Highlight valid moves on the board
   */
  highlightMoves(moves) {
    this.pieceManager.highlightMoves(moves);
  }

  /**
   * Clear move highlights
   */
  clearHighlights() {
    this.pieceManager.clearHighlights();
  }

  /**
   * Change the 3D piece skin
   */
  setSkin(skinName) {
    this.pieceManager.setSkin(skinName);
  }

  /**
   * Change the board theme
   */
  setTheme(themeName) {
    this.sceneManager.setTheme(themeName);
  }

  /**
   * Cleanup and dispose
   */
  dispose() {
    this.inputHandler.dispose();
    this.sceneManager.dispose();
    this.enabled = false;
  }

  // Proxy methods for backward compatibility
  addPiece(type, color, row, col) {
    this.pieceManager.addPiece(type, color, row, col);
  }

  removePiece(row, col) {
    this.pieceManager.removePiece(row, col);
  }

  // Internal handlers exposed for testing
  onClick(event) {
    this.inputHandler.onClick(event);
  }

  onWindowResize() {
    this.sceneManager.onWindowResize();
  }

  boardToWorld(row, col) {
    return this.sceneManager.boardToWorld(row, col);
  }
}
