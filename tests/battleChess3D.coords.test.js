import { jest } from '@jest/globals';

import { BattleChess3D } from '../js/battleChess3D.js';

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
      playBattle: jest.fn().mockResolvedValue(),
    };
    battleChess.scene = {}; // Mock scene
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
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
