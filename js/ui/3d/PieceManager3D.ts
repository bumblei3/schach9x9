/**
 * Piece Manager for 3D Battle Chess
 * Handles 3D piece creation, movement, and battle animations
 */

import * as THREE from 'three';
import { createPiece3D } from '../../pieces3D.js';
import { BattleAnimator } from '../../battleAnimations.js';
import { triggerVibration, shakeScreen } from '../../effects.js';
import { BOARD_SIZE, PHASES } from '../../config.js';
import { logger } from '../../logger.js';
import type { SceneManager3D } from './SceneManager3D.js';
import type { Game } from '../../gameEngine.js';
import type { Square, Piece } from '../../types/game.js';

export class PieceManager3D {
  public sceneManager: SceneManager3D;
  public pieces: Record<string, THREE.Group>;
  public highlights: THREE.Mesh[];
  public battleAnimator: BattleAnimator | null;
  public animating: boolean;
  public currentSkin: string;

  constructor(sceneManager: SceneManager3D) {
    this.sceneManager = sceneManager;
    this.pieces = {}; // map of "r,c" to 3D piece
    this.highlights = [];
    this.battleAnimator = null;
    this.animating = false;
    this.currentSkin = localStorage.getItem('chess_skin') || 'classic';
  }

  init(): void {
    if (this.sceneManager.scene && this.sceneManager.camera) {
      this.battleAnimator = new BattleAnimator(this.sceneManager.scene, this.sceneManager.camera);
    }
  }

  updateFromGameState(game: Game): void {
    if (!this.sceneManager.scene) return;
    logger.debug('[PieceManager3D] updateFromGameState started');

    // Clear existing pieces
    Object.values(this.pieces).forEach(piece => {
      if (this.sceneManager.scene) this.sceneManager.scene.remove(piece);
    });
    this.pieces = {};
    logger.debug('[PieceManager3D] Existing pieces cleared');

    // Add pieces from game board
    let count = 0;
    const start = performance.now();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const piece = game.board[row][col];
        if (piece) {
          this.addPiece(piece.type, piece.color, row, col);
          count++;
        }
      }
    }
    logger.info(
      `[PieceManager3D] Created ${count} pieces in ${(performance.now() - start).toFixed(2)}ms`
    );
    this.updateSetupHighlights(game);
  }

  updateSetupHighlights(game: Game): void {
    if (!game) return;

    // Setup Corridors
    const zones: Square[] = [];
    const isHumanSetup =
      game.phase === PHASES.SETUP_WHITE_KING ||
      (game.phase === PHASES.SETUP_BLACK_KING && !game.isAI);

    if (isHumanSetup) {
      const rowStart = game.phase === PHASES.SETUP_WHITE_KING ? 6 : 0;
      // 3 rows x 9 cols
      for (let r = rowStart; r < rowStart + 3; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          zones.push({ r, c });
        }
      }
      this.highlightZones(zones, 0x6366f1); // Indigo color matching 2D
      return;
    }

    // Check for specific setup phase corridors if typed appropriately in Game
    // Assuming game might have custom properties or we inspect logic
    // For now, based on legacy code:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = game as any;

    if (game.phase === PHASES.SETUP_WHITE_PIECES && g.whiteCorridor) {
      const { rowStart, colStart } = g.whiteCorridor;
      for (let r = rowStart; r < rowStart + 3; r++) {
        for (let c = colStart; c < colStart + 3; c++) {
          zones.push({ r, c });
        }
      }
      this.highlightZones(zones, 0x6366f1);
      return;
    }

    if (game.phase === PHASES.SETUP_BLACK_PIECES && g.blackCorridor) {
      const { rowStart, colStart } = g.blackCorridor;
      for (let r = rowStart; r < rowStart + 3; r++) {
        for (let c = colStart; c < colStart + 3; c++) {
          zones.push({ r, c });
        }
      }
      this.highlightZones(zones, 0xef4444); // Red for black (though usually we allow same color highlight)
      return;
    }
  }

  highlightZones(zones: Square[], colorHex: number): void {
    this.clearHighlights();

    const geometry = new THREE.PlaneGeometry(0.9, 0.9);
    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });

    zones.forEach(zone => {
      const marker = new THREE.Mesh(geometry, material);
      const pos = this.sceneManager.boardToWorld(zone.r, zone.c);
      marker.position.set(pos.x, 0.02, pos.z); // Slightly above board
      marker.rotation.x = -Math.PI / 2;
      marker.userData = { type: 'highlight', row: zone.r, col: zone.c };

      if (this.sceneManager.scene) this.sceneManager.scene.add(marker);
      this.highlights.push(marker);
    });
  }

  addPiece(type: string, color: string, row: number, col: number): void {
    const piece3D = createPiece3D(type, color, this.currentSkin);
    if (!piece3D) return;

    const pos = this.sceneManager.boardToWorld(row, col);
    piece3D.position.set(pos.x, 0, pos.z);
    piece3D.userData = { type, color, row, col };

    if (this.sceneManager.scene) this.sceneManager.scene.add(piece3D);
    this.pieces[`${row},${col}`] = piece3D;
  }

  removePiece(row: number, col: number): void {
    const key = `${row},${col}`;
    const piece = this.pieces[key];
    if (piece) {
      if (this.sceneManager.scene) this.sceneManager.scene.remove(piece);
      delete this.pieces[key];
    }
  }

  highlightMoves(moves: Square[]): void {
    this.clearHighlights();

    const geometry = new THREE.RingGeometry(0.3, 0.45, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });

    moves.forEach(move => {
      const marker = new THREE.Mesh(geometry, material);
      const pos = this.sceneManager.boardToWorld(move.r, move.c);
      marker.position.set(pos.x, 0.05, pos.z);
      marker.rotation.x = -Math.PI / 2;
      marker.userData = { type: 'highlight', row: move.r, col: move.c };

      if (this.sceneManager.scene) this.sceneManager.scene.add(marker);
      this.highlights.push(marker);
    });
  }

  clearHighlights(): void {
    this.highlights.forEach(h => {
      if (this.sceneManager.scene) this.sceneManager.scene.remove(h);
    });
    this.highlights = [];
  }

  async animateMove(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    _captured: boolean = false
  ): Promise<void> {
    const key = `${fromRow},${fromCol}`;
    const piece = this.pieces[key];
    if (!piece) return;

    this.animating = true;

    const fromPos = this.sceneManager.boardToWorld(fromRow, fromCol);
    const toPos = this.sceneManager.boardToWorld(toRow, toCol);

    const duration = 500;
    const start = Date.now();

    return new Promise(resolve => {
      const moveAnimation = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased =
          progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        piece.position.x = fromPos.x + (toPos.x - fromPos.x) * eased;
        piece.position.z = fromPos.z + (toPos.z - fromPos.z) * eased;
        piece.position.y = Math.sin(progress * Math.PI) * 0.5;

        if (progress < 1) {
          requestAnimationFrame(moveAnimation);
        } else {
          piece.position.y = 0;
          piece.userData.row = toRow;
          piece.userData.col = toCol;

          delete this.pieces[key];
          this.pieces[`${toRow},${toCol}`] = piece;

          this.animating = false;
          resolve();
        }
      };

      moveAnimation();
    });
  }

  async playBattleSequence(
    attacker: Piece,
    defender: Piece,
    attackerPos: Square,
    defenderPos: Square
  ): Promise<void> {
    logger.info('Playing battle sequence:', attacker.type, 'vs', defender.type);

    if (!this.battleAnimator) return;

    this.animating = true;

    let startPos = { x: 0, z: 0 };
    let endPos = { x: 0, z: 0 };

    if (attackerPos.r !== undefined && attackerPos.c !== undefined) {
      startPos = this.sceneManager.boardToWorld(attackerPos.r, attackerPos.c);
    }
    if (defenderPos.r !== undefined && defenderPos.c !== undefined) {
      endPos = this.sceneManager.boardToWorld(defenderPos.r, defenderPos.c);
    }

    try {
      await this.battleAnimator.playBattle(attacker, defender, startPos, endPos);

      if (['q', 'a', 'c', 'e'].includes(attacker.type)) {
        triggerVibration('heavy');
        shakeScreen(8, 400);
      } else {
        triggerVibration('medium');
        shakeScreen(3, 200);
      }
    } catch (error) {
      logger.error('Battle animation failed:', error);
    }

    this.animating = false;
  }

  setSkin(skinName: string): void {
    if (!this.sceneManager.scene) return;

    this.currentSkin = skinName;
    localStorage.setItem('chess_skin', skinName);

    const piecesToRecreate: { type: string; color: string; row: number; col: number }[] = [];
    Object.entries(this.pieces).forEach(([_key, piece]) => {
      const { type, color, row, col } = piece.userData;
      piecesToRecreate.push({ type, color, row, col });
    });

    piecesToRecreate.forEach(({ type, color, row, col }) => {
      this.removePiece(row, col);
      this.addPiece(type, color, row, col);
    });

    logger.info(`3D skin changed to: ${skinName}`);
  }
}
