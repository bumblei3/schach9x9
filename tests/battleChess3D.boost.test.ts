// Comprehensive Three.js Mock
const mockThree = {
  Scene: vi.fn().mockImplementation(function () {
    return {
      add: vi.fn(),
      remove: vi.fn(),
      traverse: vi.fn(cb => cb({ geometry: { dispose: vi.fn() }, material: { dispose: vi.fn() } })),
      background: null,
      children: [],
    };
  }),
  PerspectiveCamera: vi.fn().mockImplementation(function () {
    return {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      aspect: 1,
      updateProjectionMatrix: vi.fn(),
    };
  }),
  WebGLRenderer: vi.fn().mockImplementation(function () {
    return {
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      setClearColor: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas'),
      shadowMap: { enabled: false, type: null },
    };
  }),
  Group: vi.fn().mockImplementation(function () {
    return {
      add: vi.fn(function (obj) {
        this.children.push(obj);
      }),
      remove: vi.fn(function (obj) {
        const index = this.children.indexOf(obj);
        if (index > -1) this.children.splice(index, 1);
      }),
      position: { set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
      children: [],
      userData: {},
    };
  }),
  Raycaster: vi.fn().mockImplementation(function () {
    return {
      setFromCamera: vi.fn(),
      intersectObjects: vi.fn(objs => {
        // Simulate intersection with a piece/square if objs contains something
        if (objs.length > 0) {
          return [{ object: { userData: { row: 4, col: 4, type: 'square' } } }];
        }
        return [];
      }),
    };
  }),
  CanvasTexture: vi.fn(),
  SpriteMaterial: vi.fn(),
  Sprite: vi.fn().mockImplementation(function () {
    return {
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
    };
  }),
  Vector3: vi.fn().mockImplementation(function () {
    return { x: 0, y: 0, z: 0 };
  }),
  BoxGeometry: vi.fn(),
  SphereGeometry: vi.fn(),
  RingGeometry: vi.fn(),
  MeshStandardMaterial: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn().mockImplementation(function () {
    return {
      position: { set: vi.fn() },
      shadow: { camera: {}, mapSize: {} },
    };
  }),
  Color: vi.fn(),
  Mesh: vi.fn().mockImplementation(function () {
    return {
      position: { set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
      userData: {},
      material: { color: { setHex: vi.fn() } },
      add: vi.fn(),
    };
  }),
  HemisphereLight: vi.fn().mockImplementation(function () {
    return {
      position: { set: vi.fn() },
    };
  }),
  LatheGeometry: vi.fn(),
  Vector2: vi.fn().mockImplementation(function (x, y) {
    return { x, y };
  }),
  DoubleSide: 2,
  PCFSoftShadowMap: 1,
};

vi.mock('three', () => mockThree);
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(function () {
    return {
      update: vi.fn(),
      dispose: vi.fn(),
      target: { set: vi.fn() },
    };
  }),
}));

vi.mock('../js/pieces3D.js', () => ({
  createPiece3D: vi.fn(() => ({
    position: { set: vi.fn() },
    userData: {},
  })),
  PIECE_COLORS: { white: 0xffffff, black: 0x000000 },
}));

vi.mock('../js/battleAnimations.js', () => ({
  BattleAnimator: vi.fn().mockImplementation(function () {
    return {
      playBattle: vi.fn(() => Promise.resolve()),
    };
  }),
}));

import { setupJSDOM } from './test-utils.js';

const { BattleChess3D } = await import('../js/battleChess3D.js');

describe('BattleChess3D Class', () => {
  let container;
  let engine;

  beforeEach(() => {
    setupJSDOM();
    container = document.createElement('div');
    // Mock clientWidth/Height for init
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });

    engine = new BattleChess3D(container);
    vi.clearAllMocks();
  });

  test('should initialize correctly', async () => {
    const result = await engine.init();
    expect(result).toBe(true);
    expect(engine.scene).toBeDefined();
    expect(engine.renderer).toBeDefined();
  });

  test('should handle init failure with zero dimensions', async () => {
    Object.defineProperty(container, 'clientWidth', { value: 0 });
    const result = await engine.init();
    expect(result).toBe(false);
  });

  test('should boardToWorld correctly', () => {
    const pos = engine.boardToWorld(0, 0);
    expect(pos).toEqual({ x: -4, z: -4 });
  });

  test('should updateFromGameState', async () => {
    await engine.init();
    const game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
    };
    game.board[0][0] = { type: 'r', color: 'white' };

    engine.updateFromGameState(game);
    expect(Object.keys(engine.pieces).length).toBe(1);
  });

  test('should highlightMoves', async () => {
    await engine.init();
    engine.highlights = []; // Mock highlights array if not initialized
    const moves = [
      { r: 4, c: 4 },
      { r: 5, c: 5 },
    ];
    engine.highlightMoves(moves);
    expect(engine.highlights.length).toBe(2);
  });

  test('should toggle enabled state', () => {
    engine.toggle(true);
    expect(engine.enabled).toBe(true);
    engine.toggle(false);
    expect(engine.enabled).toBe(false);
  });

  test('should dispose correctly', async () => {
    await engine.init();
    engine.dispose();
    expect(engine.enabled).toBe(false);
  });

  test('should setTheme', async () => {
    await engine.init();
    // Mock boardGroup on sceneManager, not engine
    engine.sceneManager.boardGroup = {
      children: [
        { userData: { type: 'square', isLight: true }, material: { color: { setHex: vi.fn() } } },
      ],
    };
    engine.setTheme('blue');
    expect(engine.currentTheme).toBe('blue');
  });

  test('should setSkin', async () => {
    await engine.init();
    // Use addPiece to populate pieces map properly so setSkin can iterate them
    engine.pieceManager.addPiece('p', 'white', 0, 0);
    // engine.pieces = { '0,0': { userData: { type: 'p', color: 'white', row: 0, col: 0 } } };
    // Setting pieces directly might bypass scene addition if setSkin relies on scene removal
    // setSkin: removePiece(row, col) which calls scene.remove(piece).
    // So piece MUST be in scene?
    // PieceManager3D.addPiece adds to scene.

    engine.setSkin('neon');
    expect(engine.currentSkin).toBe('neon');
  });

  test('should animateMove', async () => {
    await engine.init();
    const piece = { position: { set: vi.fn(), x: 0, y: 0, z: 0 }, userData: {} };
    // We need to inject into pieces map
    engine.pieceManager.pieces['0,0'] = piece;

    // Start the animation - just verify it starts without error
    const animationPromise = engine.animateMove(0, 0, 1, 1);

    // Verify animation started
    expect(engine.animating).toBe(true);

    // Clean up - we don't wait for animation to complete in this unit test
    // as it requires complex RAF mocking
    expect(animationPromise).toBeDefined();
  });

  test('should handle onClick', async () => {
    await engine.init();
    const mockEvent = { clientX: 100, clientY: 100 };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    // We need `sceneManager.camera` and proper setup because InputHandler uses Raycaster.
    // Mock Raycaster returns intersection.
    // InputHandler.onClick logic:
    // ...
    // raycaster.setFromCamera(...)
    // const intersects = raycaster.intersectObjects(this.sceneManager.boardGroup.children)
    // We need `sceneManager.boardGroup` to exist and have children!

    engine.sceneManager.boardGroup = { children: [{}] }; // Mock children

    engine.onClick(mockEvent);

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe('board3dclick');
    expect(event.detail.row).toBe(4);
  });

  test('should handle onWindowResize', async () => {
    await engine.init();
    Object.defineProperty(container, 'clientWidth', { value: 1024, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 768, configurable: true });

    engine.onWindowResize();

    expect(engine.camera.aspect).toBe(1024 / 768);
    expect(engine.renderer.setSize).toHaveBeenCalledWith(1024, 768);
  });

  test('should playBattleSequence', async () => {
    await engine.init();
    const attacker = { type: 'q', color: 'white' };
    const defender = { type: 'p', color: 'black' };
    const attackerPos = { r: 6, c: 4 };
    const defenderPos = { r: 5, c: 4 };

    await engine.playBattleSequence(attacker, defender, attackerPos, defenderPos);

    expect(engine.battleAnimator.playBattle).toHaveBeenCalled();
    expect(engine.animating).toBe(false);
  });

  // Additional coverage tests for setters
  test('should set camera', async () => {
    await engine.init();
    const mockCamera = { position: { set: vi.fn() } };
    engine.camera = mockCamera;
    expect(engine.sceneManager.camera).toBe(mockCamera);
  });

  test('should set renderer', async () => {
    await engine.init();
    const mockRenderer = { setSize: vi.fn(), render: vi.fn() };
    engine.renderer = mockRenderer;
    expect(engine.sceneManager.renderer).toBe(mockRenderer);
  });

  test('should set controls', async () => {
    await engine.init();
    const mockControls = { update: vi.fn() };
    engine.controls = mockControls;
    expect(engine.sceneManager.controls).toBe(mockControls);
  });

  test('should set battleAnimator', async () => {
    await engine.init();
    const mockAnimator = { playBattle: vi.fn() };
    engine.battleAnimator = mockAnimator;
    expect(engine.pieceManager.battleAnimator).toBe(mockAnimator);
  });

  test('should set pieces', async () => {
    await engine.init();
    const mockPieces = { '0,0': {} };
    engine.pieces = mockPieces;
    expect(engine.pieceManager.pieces).toBe(mockPieces);
  });

  test('should set currentSkin', async () => {
    await engine.init();
    engine.currentSkin = 'neon';
    expect(engine.pieceManager.currentSkin).toBe('neon');
  });

  test('should set currentTheme', async () => {
    await engine.init();
    engine.currentTheme = 'blue';
    expect(engine.sceneManager.currentTheme).toBe('blue');
  });

  test('should toggle with existing scene (re-enable)', async () => {
    await engine.init();
    engine.toggle(false);
    expect(engine.enabled).toBe(false);

    // Re-enable with existing scene
    engine.toggle(true);
    expect(engine.enabled).toBe(true);
    expect(document.body.classList.contains('mode-3d')).toBe(true);
  });

  test('should clear highlights', async () => {
    await engine.init();
    engine.pieceManager.highlights = [{ mock: true }];
    engine.clearHighlights();
    expect(engine.pieceManager.highlights.length).toBe(0);
  });

  test('should add and remove pieces', async () => {
    await engine.init();
    engine.addPiece('p', 'white', 3, 3);
    expect(Object.keys(engine.pieces).length).toBe(1);

    engine.removePiece(3, 3);
    expect(Object.keys(engine.pieces).length).toBe(0);
  });
});
