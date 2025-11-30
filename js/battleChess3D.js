/**
 * Battle Chess 3D Module
 * Handles 3D rendering, animations, and battle sequences for Schach 9x9
 * @module battleChess3D
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPiece3D, PIECE_COLORS } from './pieces3D.js';
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
        this.battleAnimator = null;

        // Game state
        this.pieces = new Map(); // key: "r,c", value: THREE.Group
        this.highlights = [];
        this.selectedPiece = null;

        // Board helpers
        this.boardGroup = null;
        this.squareSize = 1.0;

        // Animation
        this.animating = false;
        this.animationQueue = [];

        logger.info('BattleChess3D initialized');
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
            this.renderer.domElement.addEventListener(
                'click',
                this.onClick.bind(this),
            );

            // Start animation loop BEFORE toggling enabled
            this.animate();

            // Enable rendering
            this.enabled = true;

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

    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Strong ambient light for base visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        // Main directional light (sun) - much brighter
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.camera.left = -10;
        mainLight.shadow.camera.right = 10;
        mainLight.shadow.camera.top = 10;
        mainLight.shadow.camera.bottom = -10;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // Fill light from other side
        const fillLight = new THREE.DirectionalLight(0x4466ff, 0.6);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        // Additional top light for clear visibility
        const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
        topLight.position.set(0, 15, 0);
        this.scene.add(topLight);

        logger.info('3D lighting setup: High intensity for visibility');
    }

    /**
     * Create the 9x9 chess board
     */
    createBoard() {
        this.boardGroup = new THREE.Group();

        const squareGeometry = new THREE.BoxGeometry(
            this.squareSize,
            0.1,
            this.squareSize,
        );

        // Create 9x9 grid
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const isLight = (row + col) % 2 === 0;

                const material = new THREE.MeshStandardMaterial({
                    color: isLight ? 0xe8dcc0 : 0x6b5d4f,
                    roughness: 0.7,
                    metalness: 0.1,
                });

                const square = new THREE.Mesh(squareGeometry, material);

                // Position: convert board coords to 3D coords
                const pos = this.boardToWorld(row, col);
                square.position.set(pos.x, -0.05, pos.z);
                square.receiveShadow = true;

                // Store board position for raycasting
                square.userData = { row, col, type: 'square' };

                this.boardGroup.add(square);
            }
        }

        // Add coordinate labels (simple)
        this.addCoordinateLabels();

        this.scene.add(this.boardGroup);
    }

    /**
     * Add coordinate labels to the board
     */
    addCoordinateLabels() {
        // TODO: Add text sprites for coordinates
        // For now, just add small markers at corners
        const markerGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

        // Mark origin
        const origin = new THREE.Mesh(markerGeometry, markerMaterial);
        origin.position.set(-4 * this.squareSize, 0.1, -4 * this.squareSize);
        this.boardGroup.add(origin);
    }

    /**
     * Convert board coordinates [0-8][0-8] to 3D world position
     */
    boardToWorld(row, col) {
        // Center the board at origin
        // row 0 = z: -4, row 8 = z: 4
        // col 0 = x: -4, col 8 = x: 4
        const x = (col - 4) * this.squareSize;
        const z = (row - 4) * this.squareSize;
        return { x, z };
    }

    /**
     * Update 3D board from game state
     */
    updateFromGameState(game) {
        logger.info('Updating 3D board from game state');

        // Clear existing pieces
        this.pieces.forEach((piece) => this.scene.remove(piece));
        this.pieces.clear();

        // Add pieces from game board
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = game.board[row][col];
                if (piece) {
                    this.addPiece(piece.type, piece.color, row, col);
                }
            }
        }
    }

    /**
     * Add a 3D piece to the board
     */
    addPiece(type, color, row, col) {
        const piece3D = createPiece3D(type, color);
        if (!piece3D) return;

        const pos = this.boardToWorld(row, col);
        piece3D.position.set(pos.x, 0, pos.z);
        piece3D.userData = { type, color, row, col };

        this.scene.add(piece3D);
        this.pieces.set(`${row},${col}`, piece3D);
    }

    /**
     * Remove piece from 3D scene
     */
    removePiece(row, col) {
        const key = `${row},${col}`;
        const piece = this.pieces.get(key);
        if (piece) {
            this.scene.remove(piece);
            this.pieces.delete(key);
        }
    }

    /**
     * Highlight valid moves on the board
     */
    highlightMoves(moves) {
        // Clear previous highlights
        this.clearHighlights();

        // Create highlight markers
        const geometry = new THREE.RingGeometry(0.3, 0.45, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
        });

        moves.forEach((move) => {
            const marker = new THREE.Mesh(geometry, material);
            const pos = this.boardToWorld(move.r, move.c);
            marker.position.set(pos.x, 0.05, pos.z);
            marker.rotation.x = -Math.PI / 2;
            marker.userData = { type: 'highlight', row: move.r, col: move.c };

            this.scene.add(marker);
            this.highlights.push(marker);
        });
    }

    /**
     * Clear move highlights
     */
    clearHighlights() {
        this.highlights.forEach((h) => this.scene.remove(h));
        this.highlights = [];
    }

    /**
     * Animate a piece move
     */
    async animateMove(fromRow, fromCol, toRow, toCol, captured = false) {
        const key = `${fromRow},${fromCol}`;
        const piece = this.pieces.get(key);
        if (!piece) return;

        this.animating = true;

        const fromPos = this.boardToWorld(fromRow, fromCol);
        const toPos = this.boardToWorld(toRow, toCol);

        // Animate movement
        const duration = 500; // ms
        const start = Date.now();

        return new Promise((resolve) => {
            const moveAnimation = () => {
                const elapsed = Date.now() - start;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-in-out)
                const eased =
                    progress < 0.5
                        ? 2 * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                piece.position.x = fromPos.x + (toPos.x - fromPos.x) * eased;
                piece.position.z = fromPos.z + (toPos.z - fromPos.z) * eased;
                piece.position.y = Math.sin(progress * Math.PI) * 0.5; // Arc

                if (progress < 1) {
                    requestAnimationFrame(moveAnimation);
                } else {
                    piece.position.y = 0;
                    piece.userData.row = toRow;
                    piece.userData.col = toCol;

                    // Update map
                    this.pieces.delete(key);
                    this.pieces.set(`${toRow},${toCol}`, piece);

                    this.animating = false;
                    resolve();
                }
            };

            moveAnimation();
        });
    }

    /**
     * Play battle animation when piece is captured
     */
    async playBattleSequence(attacker, defender, attackerPos, defenderPos) {
        logger.info('Playing battle sequence:', attacker.type, 'vs', defender.type);

        if (!this.battleAnimator) return;

        this.animating = true;

        try {
            await this.battleAnimator.playBattle(
                attacker,
                defender,
                attackerPos,
                defenderPos,
            );
        } catch (error) {
            logger.error('Battle animation failed:', error);
        }

        this.animating = false;
    }

    /**
     * Handle mouse clicks on the 3D scene
     */
    onClick(event) {
        if (this.animating) return;

        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Check intersections with pieces and board
        const allObjects = [
            ...Array.from(this.pieces.values()),
            ...this.boardGroup.children,
            ...this.highlights,
        ];
        const intersects = this.raycaster.intersectObjects(allObjects, true);

        if (intersects.length > 0) {
            // Find the first object with userData
            for (const intersect of intersects) {
                const obj = intersect.object;
                if (obj.userData && obj.userData.row !== undefined) {
                    // Dispatch custom event with board coordinates
                    const clickEvent = new CustomEvent('board3dclick', {
                        detail: {
                            row: obj.userData.row,
                            col: obj.userData.col,
                            type: obj.userData.type,
                        },
                    });
                    this.container.dispatchEvent(clickEvent);
                    break;
                }
            }
        }
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(
            this.container.clientWidth,
            this.container.clientHeight,
        );
    }

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(this.animate.bind(this));

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
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((m) => m.dispose());
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
