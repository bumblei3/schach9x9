import { jest } from '@jest/globals';

// Comprehensive Three.js Mock
const mockThree = {
  Scene: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    traverse: jest.fn(cb =>
      cb({ geometry: { dispose: jest.fn() }, material: { dispose: jest.fn() } })
    ),
    background: null,
    children: [],
  })),
  PerspectiveCamera: jest.fn().mockImplementation(() => ({
    position: { set: jest.fn() },
    lookAt: jest.fn(),
    aspect: 1,
    updateProjectionMatrix: jest.fn(),
  })),
  WebGLRenderer: jest.fn().mockImplementation(() => ({
    setSize: jest.fn(),
    setPixelRatio: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, type: null },
  })),
  Group: jest.fn().mockImplementation(() => ({
    add: jest.fn(function (obj) {
      this.children.push(obj);
    }),
    remove: jest.fn(function (obj) {
      const index = this.children.indexOf(obj);
      if (index > -1) this.children.splice(index, 1);
    }),
    position: { set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    children: [],
    userData: {},
  })),
  Raycaster: jest.fn().mockImplementation(() => ({
    setFromCamera: jest.fn(),
    intersectObjects: jest.fn(objs => {
      // Simulate intersection with a piece/square if objs contains something
      if (objs.length > 0) {
        return [{ object: { userData: { row: 4, col: 4, type: 'square' } } }];
      }
      return [];
    }),
  })),
  Vector3: jest.fn().mockImplementation(() => ({ x: 0, y: 0, z: 0 })),
  BoxGeometry: jest.fn(),
  SphereGeometry: jest.fn(),
  RingGeometry: jest.fn(),
  MeshStandardMaterial: jest.fn(),
  MeshBasicMaterial: jest.fn(),
  AmbientLight: jest.fn(),
  DirectionalLight: jest.fn().mockImplementation(() => ({
    position: { set: jest.fn() },
    shadow: { camera: {}, mapSize: {} },
  })),
  Color: jest.fn(),
  Mesh: jest.fn().mockImplementation(() => ({
    position: { set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    userData: {},
    material: { color: { setHex: jest.fn() } },
    add: jest.fn(),
  })),
  HemisphereLight: jest.fn().mockImplementation(() => ({
    position: { set: jest.fn() },
  })),
  LatheGeometry: jest.fn(),
  Vector2: jest.fn().mockImplementation((x, y) => ({ x, y })),
  DoubleSide: 2,
  PCFSoftShadowMap: 1,
};

jest.unstable_mockModule('three', () => mockThree);
jest.unstable_mockModule('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
    dispose: jest.fn(),
    target: { set: jest.fn() },
  })),
}));

jest.unstable_mockModule('../js/pieces3D.js', () => ({
  createPiece3D: jest.fn(() => ({
    position: { set: jest.fn() },
    userData: {},
  })),
  PIECE_COLORS: { white: 0xffffff, black: 0x000000 },
}));

jest.unstable_mockModule('../js/battleAnimations.js', () => ({
  BattleAnimator: jest.fn().mockImplementation(() => ({
    playBattle: jest.fn(() => Promise.resolve()),
  })),
}));

const { BattleChess3D } = await import('../js/battleChess3D.js');

describe('BattleChess3D Class', () => {
  let container;
  let engine;

  beforeEach(() => {
    container = document.createElement('div');
    // Mock clientWidth/Height for init
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });

    engine = new BattleChess3D(container);
    jest.clearAllMocks();
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
    engine.boardGroup = {
      children: [
        { userData: { type: 'square', isLight: true }, material: { color: { setHex: jest.fn() } } },
      ],
    };
    engine.setTheme('blue');
    expect(engine.currentTheme).toBe('blue');
  });

  test('should setSkin', async () => {
    await engine.init();
    engine.pieces = { '0,0': { userData: { type: 'p', color: 'white', row: 0, col: 0 } } };
    engine.setSkin('neon');
    expect(engine.currentSkin).toBe('neon');
  });

  test('should animateMove', async () => {
    await engine.init();
    const piece = { position: { set: jest.fn(), x: 0, y: 0, z: 0 }, userData: {} };
    engine.pieces['0,0'] = piece;

    const animationPromise = engine.animateMove(0, 0, 1, 1);

    // Mock requestAnimationFrame to call the callback immediately
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      setTimeout(cb, 0);
      return 1;
    });

    // Jump time to finish animation
    const realDate = Date.now;
    let currentTime = Date.now();
    global.Date.now = jest.fn(() => currentTime);
    currentTime += 600;

    await animationPromise;
    expect(engine.animating).toBe(false);
    rafSpy.mockRestore();
    global.Date.now = realDate;
  });

  test('should handle onClick', async () => {
    await engine.init();
    const mockEvent = { clientX: 100, clientY: 100 };
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

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
});
