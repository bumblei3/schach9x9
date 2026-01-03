/**
 * Scene Manager for 3D Battle Chess
 * Handles THREE.js scene setup, camera, lighting, and board rendering
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BOARD_SIZE } from '../../config.js';
import { logger } from '../../logger.js';

export class SceneManager3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.boardGroup = null;
    this.squareSize = 1;

    // Default settings
    this.currentTheme = 'classic';
    this.boundAnimate = this.animate.bind(this);
    this.enabled = false;
  }

  /**
   * Initialize the 3D scene
   */
  async init() {
    try {
      logger.info('Setting up 3D scene...');

      if (!this.container) {
        logger.error('3D container is null!');
        return false;
      }

      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      if (width === 0 || height === 0) {
        logger.error('Container has zero dimensions!');
        return false;
      }

      // Scene
      this.scene = new THREE.Scene();
      // this.scene.background = new THREE.Color(0x1a1d29); // Remove solid background for transparency

      // Camera
      const aspect = width / height;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      this.camera.position.set(0, 12, 12);
      this.camera.lookAt(0, 0, 0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Enable alpha
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(0x000000, 0); // Transparent clear color

      // Clear container
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }

      this.container.appendChild(this.renderer.domElement);

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

      // Handle window resize
      window.addEventListener('resize', this.onWindowResize.bind(this));

      // Start loop
      this.enabled = true;
      this.animate();

      // Force initial resize and render
      this.onWindowResize();
      this.renderer.render(this.scene, this.camera);

      return true;
    } catch (error) {
      logger.error('Failed to initialize 3D scene:', error);
      return false;
    }
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 15, 8);
    mainLight.castShadow = true;

    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    mainLight.shadow.bias = -0.001;

    this.scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x4466ff, 0.5);
    rimLight.position.set(-5, 5, -10);
    this.scene.add(rimLight);
  }

  getThemeColors(theme) {
    const themes = {
      classic: { light: 0xe8dcc0, dark: 0x6b5d4f },
      blue: { light: 0x87ceeb, dark: 0x4682b4 },
      green: { light: 0x90ee90, dark: 0x228b22 },
      wood: { light: 0xdeb887, dark: 0x8b4513 },
      dark: { light: 0x4a4a4a, dark: 0x2a2a2a },
    };
    return themes[theme] || themes.classic;
  }

  createBoard() {
    this.boardGroup = new THREE.Group();
    this.currentTheme = localStorage.getItem('chess_theme') || 'classic';

    const squareGeometry = new THREE.BoxGeometry(this.squareSize, 0.1, this.squareSize);
    const colors = this.getThemeColors(this.currentTheme);

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const isLight = (row + col) % 2 === 0;
        const material = new THREE.MeshStandardMaterial({
          color: isLight ? colors.light : colors.dark,
          roughness: 0.7,
          metalness: 0.1,
        });

        const square = new THREE.Mesh(squareGeometry, material);
        const pos = this.boardToWorld(row, col);
        square.position.set(pos.x, -0.05, pos.z);
        square.receiveShadow = true;
        square.userData = { row, col, type: 'square', isLight };

        this.boardGroup.add(square);
      }
    }

    this.addCoordinateLabels();
    this.scene.add(this.boardGroup);
  }

  addCoordinateLabels() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    files.forEach((file, index) => {
      const sprite = this.createTextSprite(file);
      const pos = this.boardToWorld(0, index);
      sprite.position.set(pos.x, 0.05, 4.5 * this.squareSize);
      this.boardGroup.add(sprite);

      const spriteTop = this.createTextSprite(file);
      spriteTop.position.set(pos.x, 0.05, -4.5 * this.squareSize);
      this.boardGroup.add(spriteTop);
    });

    ranks.forEach((rank, index) => {
      const sprite = this.createTextSprite(rank);
      const pos = this.boardToWorld(index, 0);
      sprite.position.set(-4.5 * this.squareSize, 0.05, pos.z);
      this.boardGroup.add(sprite);

      const spriteRight = this.createTextSprite(rank);
      spriteRight.position.set(4.5 * this.squareSize, 0.05, pos.z);
      this.boardGroup.add(spriteRight);
    });
  }

  createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(0,0,0,0)';
    context.fillRect(0, 0, size, size);

    context.font = 'bold 80px "Outfit", Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    context.lineWidth = 4;
    context.strokeText(text.toUpperCase(), size / 2, size / 2);

    context.fillStyle = '#ffffff';
    context.fillText(text.toUpperCase(), size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.6, 0.6, 1);

    return sprite;
  }

  boardToWorld(row, col) {
    const x = (col - 4) * this.squareSize;
    const z = (row - 4) * this.squareSize;
    return { x, z };
  }

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

  animate() {
    if (!this.enabled) return;

    requestAnimationFrame(this.boundAnimate);

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setTheme(themeName) {
    if (!this.boardGroup || !this.scene) return;
    this.currentTheme = themeName;
    const colors = this.getThemeColors(themeName);

    this.boardGroup.children.forEach(square => {
      if (square.userData && square.userData.type === 'square') {
        const isLight = square.userData.isLight;
        square.material.color.setHex(isLight ? colors.light : colors.dark);
      }
    });
  }

  dispose() {
    this.enabled = false;
    window.removeEventListener('resize', this.onWindowResize);
    this.controls?.dispose();
    this.renderer?.dispose();

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

    if (this.renderer?.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
