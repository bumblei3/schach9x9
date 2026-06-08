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
  public container: HTMLElement;
  public enabled: boolean;
  public sceneManager: SceneManager3D;
  public pieceManager: PieceManager3D;
  public inputHandler: InputHandler3D;

  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
    this.enabled = false;

    // Initialize managers
        const SceneManager = (window as any).SceneManager3D || SceneManager3D;
        const PieceManager = (window as any).PieceManager3D || PieceManager3D;
        const InputHandler = (window as any).InputHandler3D || InputHandler3D;

    this.sceneManager = new SceneManager(containerElement);
    this.pieceManager = new PieceManager(this.sceneManager);
    this.inputHandler = new InputHandler(this.sceneManager, this.pieceManager);

    logger.info('[3D] BattleChess3D instance created (Modular)');
  }

  // Getters and Setters for compatibility with tests and external access
    get scene(): any {
    return this.sceneManager.scene;
  }
    set scene(value: any) {
    this.sceneManager.scene = value;
  }

    get camera(): any {
    return this.sceneManager.camera;
  }
    set camera(value: any) {
    this.sceneManager.camera = value;
  }

    get renderer(): any {
    return this.sceneManager.renderer;
  }
    set renderer(value: any) {
    this.sceneManager.renderer = value;
  }

    get controls(): any {
    return this.sceneManager.controls;
  }
    set controls(value: any) {
    this.sceneManager.controls = value;
  }

    get battleAnimator(): any {
    return this.pieceManager.battleAnimator;
  }
    set battleAnimator(value: any) {
    this.pieceManager.battleAnimator = value;
  }

    get pieces(): any {
    return this.pieceManager.pieces;
  }
    set pieces(value: any) {
    this.pieceManager.pieces = value;
  }

    get animating(): any {
    return this.pieceManager.animating;
  }

    get currentSkin(): any {
    return this.pieceManager.currentSkin;
  }
    set currentSkin(value: any) {
    this.pieceManager.currentSkin = value;
  }

    get currentTheme(): any {
    return this.sceneManager.currentTheme;
  }
    set currentTheme(value: any) {
    this.sceneManager.currentTheme = value;
  }

    get highlights(): any {
    return this.pieceManager.highlights;
  }
    set highlights(value: any) {
    this.pieceManager.highlights = value;
  }

  /**
   * Initialize the 3D scene
   */
  public async init(): Promise<boolean> {
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
  public toggle(enabled: boolean): void {
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
    public updateFromGameState(game: any): void {
    this.pieceManager.updateFromGameState(game);
  }

  /**
   * Animate a piece move
   */
    public async animateMove(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    captured: boolean = false
  ): Promise<any> {
    return this.pieceManager.animateMove(fromRow, fromCol, toRow, toCol, captured);
  }

  /**
   * Play battle animation when piece is captured
   */
    public async playBattleSequence(
    attacker: any,
    defender: any,
    attackerPos: any,
    defenderPos: any
  ): Promise<any> {
    return this.pieceManager.playBattleSequence(attacker, defender, attackerPos, defenderPos);
  }

  /**
   * Highlight valid moves on the board
   */
    public highlightMoves(moves: any[]): void {
    this.pieceManager.highlightMoves(moves);
  }

  /**
   * Clear move highlights
   */
  public clearHighlights(): void {
    this.pieceManager.clearHighlights();
  }

  /**
   * Change the 3D piece skin
   */
  public setSkin(skinName: string): void {
    this.pieceManager.setSkin(skinName);
  }

  /**
   * Change the board theme
   */
  public setTheme(themeName: string): void {
    this.sceneManager.setTheme(themeName);
  }

  /**
   * Cleanup and dispose
   */
  public dispose(): void {
    this.inputHandler.dispose();
    this.sceneManager.dispose();
    this.enabled = false;
  }

  // Proxy methods for backward compatibility
  public addPiece(type: string, color: string, row: number, col: number): void {
    this.pieceManager.addPiece(type, color, row, col);
  }

  public removePiece(row: number, col: number): void {
    this.pieceManager.removePiece(row, col);
  }

  // Internal handlers exposed for testing
    public onClick(event: any): void {
    this.inputHandler.onClick(event);
  }

  public onWindowResize(): void {
    this.sceneManager.onWindowResize();
  }

    public boardToWorld(row: number, col: number): any {
    return this.sceneManager.boardToWorld(row, col);
  }
}

declare global {
  interface Window {
    battleChess3D?: BattleChess3D;
  }
}
