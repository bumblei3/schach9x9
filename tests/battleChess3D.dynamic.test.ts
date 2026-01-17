import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BattleChess3D } from '../js/battleChess3D.js';
import { setBoardVariant } from '../js/config.js';

// Mock THREE
vi.mock('three', () => {
  return {
    Scene: vi.fn(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      background: null,
      traverse: vi.fn(),
    })),
    PerspectiveCamera: vi.fn(() => ({
      position: { set: vi.fn(), clone: vi.fn() },
      lookAt: vi.fn(),
      aspect: 1,
      updateProjectionMatrix: vi.fn(),
    })),
    WebGLRenderer: vi.fn(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 100, height: 100 })),
      },
      shadowMap: { enabled: false, type: null },
      setClearColor: vi.fn(),
    })),
    CanvasTexture: vi.fn(),
    SpriteMaterial: vi.fn(),
    Sprite: vi.fn(() => ({
      scale: { set: vi.fn() },
      position: { set: vi.fn() },
    })),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn(() => ({
      position: { set: vi.fn() },
      shadow: {
        camera: {},
        mapSize: {},
      },
    })),
    Group: vi.fn(() => ({
      add: vi.fn(),
      children: [],
    })),
    BoxGeometry: vi.fn(),
    MeshStandardMaterial: vi.fn(),
    Mesh: vi.fn(() => ({
      position: { set: vi.fn() },
      rotation: { x: 0 },
      userData: {},
      receiveShadow: false,
    })),
    Vector2: vi.fn(),
    Vector3: vi.fn((x, y, z) => ({ x, y, z })),
    Raycaster: vi.fn(),
    Color: vi.fn(),
    SphereGeometry: vi.fn(),
    MeshBasicMaterial: vi.fn(),
    RingGeometry: vi.fn(),
    PCFSoftShadowMap: 'PCFSoftShadowMap',
    DoubleSide: 'DoubleSide',
  };
});

// Mock OrbitControls
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn(() => ({
    enableDamping: false,
    target: { set: vi.fn() },
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock pieces3D
vi.mock('../js/pieces3D.js', () => ({
  createPiece3D: vi.fn(() => ({
    position: { set: vi.fn() },
    userData: {},
  })),
  PIECE_COLORS: {},
}));

// Mock battleAnimations
vi.mock('../js/battleAnimations.js', () => ({
  BattleAnimator: vi.fn(() => ({
    playBattle: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('BattleChess3D Dynamic Board Size', () => {
  let battleChess: any;
  let container: any;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    battleChess = new BattleChess3D(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
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
