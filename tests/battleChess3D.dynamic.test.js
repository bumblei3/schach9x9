import { jest } from '@jest/globals';
import { BattleChess3D } from '../js/battleChess3D.js';
import { setBoardVariant } from '../js/config.js';

// Mock THREE
jest.mock('three', () => {
  return {
    Scene: jest.fn(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      background: null,
      traverse: jest.fn(),
    })),
    PerspectiveCamera: jest.fn(() => ({
      position: { set: jest.fn(), clone: jest.fn() },
      lookAt: jest.fn(),
      aspect: 1,
      updateProjectionMatrix: jest.fn(),
    })),
    WebGLRenderer: jest.fn(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 100, height: 100 })),
      },
      shadowMap: { enabled: false, type: null },
      setClearColor: jest.fn(),
    })),
    CanvasTexture: jest.fn(),
    SpriteMaterial: jest.fn(),
    Sprite: jest.fn(() => ({
      scale: { set: jest.fn() },
      position: { set: jest.fn() },
    })),
    AmbientLight: jest.fn(),
    DirectionalLight: jest.fn(() => ({
      position: { set: jest.fn() },
      shadow: {
        camera: {},
        mapSize: {},
      },
    })),
    Group: jest.fn(() => ({
      add: jest.fn(),
      children: [],
    })),
    BoxGeometry: jest.fn(),
    MeshStandardMaterial: jest.fn(),
    Mesh: jest.fn(() => ({
      position: { set: jest.fn() },
      rotation: { x: 0 },
      userData: {},
      receiveShadow: false,
    })),
    Vector2: jest.fn(),
    Vector3: jest.fn((x, y, z) => ({ x, y, z })),
    Raycaster: jest.fn(),
    Color: jest.fn(),
    SphereGeometry: jest.fn(),
    MeshBasicMaterial: jest.fn(),
    RingGeometry: jest.fn(),
    PCFSoftShadowMap: 'PCFSoftShadowMap',
    DoubleSide: 'DoubleSide',
  };
});

// Mock OrbitControls
jest.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: jest.fn(() => ({
    enableDamping: false,
    target: { set: jest.fn() },
    update: jest.fn(),
    dispose: jest.fn(),
  })),
}));

// Mock pieces3D
jest.mock('../js/pieces3D.js', () => ({
  createPiece3D: jest.fn(() => ({
    position: { set: jest.fn() },
    userData: {},
  })),
  PIECE_COLORS: {},
}));

// Mock battleAnimations
jest.mock('../js/battleAnimations.js', () => ({
  BattleAnimator: jest.fn(() => ({
    playBattle: jest.fn().mockResolvedValue(),
  })),
}));

describe('BattleChess3D Dynamic Board Size', () => {
  let battleChess;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    battleChess = new BattleChess3D(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  test('Should calculate 9x9 coordinates correctly', async () => {
    setBoardVariant('9x9'); // 9x9

    await battleChess.sceneManager.init();

    // 9x9 Offset is (9-1)/2 = 4

    // Center (4,4) should be 0,0
    const center = battleChess.sceneManager.boardToWorld(4, 4);
    expect(center.x).toBe(0);
    expect(center.z).toBe(0);

    // Top-Left (0,0) should be -4, -4
    const topLeft = battleChess.sceneManager.boardToWorld(0, 0);
    expect(topLeft.x).toBe(-4);
    expect(topLeft.z).toBe(-4);

    // Bottom-Right (8,8) should be 4, 4
    const bottomRight = battleChess.sceneManager.boardToWorld(8, 8);
    expect(bottomRight.x).toBe(4);
    expect(bottomRight.z).toBe(4);
  });

  test('Should calculate 8x8 coordinates correctly', async () => {
    setBoardVariant('8x8'); // 8x8

    // Re-init scene manager to pick up new board size?
    // SceneManager imports BOARD_SIZE.
    // We might need to ensure the module re-evaluates or just use the updated binding.
    // boardToWorld uses BOARD_SIZE directly.

    // 8x8 Offset is (8-1)/2 = 3.5

    // "Center" checks
    // Col 3 -> 3 - 3.5 = -0.5
    // Col 4 -> 4 - 3.5 = 0.5

    const pos33 = battleChess.sceneManager.boardToWorld(3, 3);
    expect(pos33.x).toBe(-0.5);
    expect(pos33.z).toBe(-0.5);

    const pos44 = battleChess.sceneManager.boardToWorld(4, 4);
    expect(pos44.x).toBe(0.5);
    expect(pos44.z).toBe(0.5);

    // Top-Left (0,0)
    // 0 - 3.5 = -3.5
    const topLeft = battleChess.sceneManager.boardToWorld(0, 0);
    expect(topLeft.x).toBe(-3.5);
    expect(topLeft.z).toBe(-3.5);
  });
});
