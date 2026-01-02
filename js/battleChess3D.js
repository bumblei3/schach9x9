/**
 * Battle Chess 3D Module
 * Handles 3D rendering, animations, and battle sequences for Schach 9x9
 * @module battleChess3D
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPiece3D /*, PIECE_COLORS*/ } from './pieces3D.js';
import { BattleAnimator } from './battleAnimations.js';
import { logger } from './logger.js';
import { BOARD_SIZE } from './config.js';

/**
 * Main 3D Battle Chess Engine
 */
export class BattleChess3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.enabled = false;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.board = null;
    this.pieces = {}; // map of "r,c" to 3D piece
    this.highlights = [];
    this.battleAnimator = null;
    this.animationFrameId = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clickHandler = null;
    this.resizeHandler = null;
    this.squareSize = 1;

    // Skin system - use unified localStorage key
    this.currentSkin = localStorage.getItem('chessSkin') || 'classic';

    logger.info('[3D] BattleChess3D instance created');
  }

  /**
   * Initialize the 3D scene
   */
  async init() {
    try {
      logger.info('Setting up 3D scene...');

      // Validate container
      if (!this.container) {
        logger.error('3D container is null!');
        return false;
      }

      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      logger.info(`Container dimensions: ${width}x${height}`);

      if (width === 0 || height === 0) {
        logger.error('Container has zero dimensions!');
        return false;
      }

      // Scene
      this.scene = new THREE.Scene();
      // Use transparent background to see through to board or use a gradient
      this.scene.background = new THREE.Color(0x1a1d29); // Match app background
      // Remove fog for clearer visibility
      // this.scene.fog = new THREE.Fog(0x0a0e27, 10, 50);
      logger.info('Scene created');

      // Camera
      const aspect = width / height;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      // Better camera position for 9x9 board
      this.camera.position.set(0, 12, 12);
      this.camera.lookAt(0, 0, 0);
      logger.info(`Camera positioned at (0, 12, 12), aspect: ${aspect}`);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // CRITICAL: Clear container first
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }

      this.container.appendChild(this.renderer.domElement);
      logger.info('Renderer canvas added to DOM');

      // Controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2.2;
      this.controls.minDistance = 8;
      this.controls.maxDistance = 30;
      this.controls.target.set(0, 0, 0);

      // Lighting
      this.setupLighting();

      // Create board
      this.createBoard();
      logger.info(`Board created with ${this.boardGroup.children.length} squares`);

      // Battle animator
      this.battleAnimator = new BattleAnimator(this.scene, this.camera);

      // Handle window resize
      window.addEventListener('resize', this.onWindowResize.bind(this));

      // Raycasting for clicks
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.renderer.domElement.addEventListener('click', this.onClick.bind(this));

      // Bind animate once
      this.boundAnimate = this.animate.bind(this);

      // Start animation loop BEFORE toggling enabled
      this.animate();

      // Enable rendering
      this.enabled = true;

      // Force handle resize to ensure correct dimensions
      this.onWindowResize();

      // Force first render
      this.renderer.render(this.scene, this.camera);
      logger.info(`Scene objects: ${this.scene.children.length}, First render complete`);

      logger.info('3D scene setup complete');
      return true;
    } catch (error) {
      logger.error('Failed to initialize 3D scene:', error);
      return false;
    }
  }

  // ... (setupLighting, getThemeColors, createBoard, addCoordinateLabels, boardToWorld, updateFromGameState, addPiece, removePiece, highlightMoves, clearHighlights, animateMove, playBattleSequence, onClick) ...

  /**
   * Handle window resize
   */
  onWindowResize() {
    if (!this.camera || !this.renderer || !this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) return;

    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Animation loop
   */
  animate() {
    requestAnimationFrame(this.boundAnimate);

    // Only render if enabled
    if (!this.enabled || !this.renderer || !this.scene || !this.camera) {
      return;
    }

    // Update controls
    this.controls?.update();

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Toggle 3D mode on/off
   */
  toggle(enabled) {
    this.enabled = enabled;

    if (enabled) {
      logger.info('3D mode enabled');
      // Make sure animation loop is running
      if (!this.scene) {
        this.init();
      }
    } else {
      logger.info('3D mode disabled');
    }
  }

  /**
   * Change the 3D piece skin
   * @param {string} skinName - Name of the skin preset
   */
  setSkin(skinName) {
    if (!this.scene) return;

    this.currentSkin = skinName;
    localStorage.setItem('chessSkin', skinName);

    // Recreate all pieces with the new skin
    const piecesToRecreate = [];
    Object.entries(this.pieces).forEach(([_key, piece]) => {
      const { type, color, row, col } = piece.userData;
      piecesToRecreate.push({ type, color, row, col });
    });

    // Remove and recreate
    piecesToRecreate.forEach(({ type, color, row, col }) => {
      this.removePiece(row, col);
      this.addPiece(type, color, row, col);
    });

    logger.info(`3D skin changed to: ${skinName}`);
  }

  /**
   * Change the board theme
   * @param {string} themeName - Name of the theme (classic, blue, green, wood, dark)
   */
  setTheme(themeName) {
    if (!this.boardGroup || !this.scene) return;

    this.currentTheme = themeName;
    const colors = this.getThemeColors(themeName);

    // Update all board squares
    this.boardGroup.children.forEach(square => {
      if (square.userData.type === 'square') {
        const isLight = square.userData.isLight;
        square.material.color.setHex(isLight ? colors.light : colors.dark);
      }
    });

    logger.info(`3D board theme changed to: ${themeName}`);
  }

  /**
   * Cleanup and dispose
   */
  dispose() {
    logger.info('Disposing 3D scene');

    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer?.domElement.removeEventListener('click', this.onClick);

    // Dispose controls
    this.controls?.dispose();

    // Dispose renderer
    this.renderer?.dispose();

    // Clear scene
    if (this.scene) {
      this.scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }

    // Remove canvas
    if (this.renderer?.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }

    this.enabled = false;
  }
}
