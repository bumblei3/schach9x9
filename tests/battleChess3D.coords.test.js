import { BattleChess3D } from '../js/battleChess3D.js';

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
    playBattle: vi.fn().mockResolvedValue(),
  })),
}));

describe('BattleChess3D Debug Tests', () => {
  let battleChess;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    battleChess = new BattleChess3D(container);
    // Manually init minimal parts to avoid full THREE init if possible,
    // but init() is async and complex.
    // We can just mock the battleAnimator property directly if we don't call init.
    battleChess.battleAnimator = {
      playBattle: vi.fn().mockResolvedValue(),
    };
    battleChess.scene = {}; // Mock scene
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  test('playBattleSequence should convert board coords to world coords', async () => {
    const attacker = { type: 'p', color: 'white' };
    const defender = { type: 'p', color: 'black' };

    // Inputs from moveController are {r, c} objects
    const from = { r: 6, c: 4 };
    const to = { r: 5, c: 4 };

    await battleChess.playBattleSequence(attacker, defender, from, to);

    // Check what playBattle was called with
    const callArgs = battleChess.battleAnimator.playBattle.mock.calls[0];
    const attackerPos = callArgs[2];

    // Should have x and z properties, NOT r and c
    expect(attackerPos).toHaveProperty('x');
    expect(attackerPos).toHaveProperty('z');
    expect(attackerPos).not.toHaveProperty('r');

    // Verify correct conversion (center is 0,0 at 4,4)
    // 6,4 -> row 6 is z=(6-4)=2, col 4 is x=(4-4)=0
    expect(attackerPos.x).toBe(0);
    expect(attackerPos.z).toBe(2);
  });
});
