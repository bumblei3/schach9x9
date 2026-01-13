// Comprehensive Three.js Mock
const mockThree = {
  Group: vi.fn().mockImplementation(function () {
    return {
      add: vi.fn(),
      remove: vi.fn(),
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      userData: {},
      traverse: vi.fn(() => {
        // No-op for now, or could simulate children
      }),
    };
  }),
  Mesh: vi.fn().mockImplementation(function () {
    return {
      castShadow: false,
      receiveShadow: false,
      position: { set: vi.fn() },
      rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
    };
  }),
  Vector2: vi.fn().mockImplementation(function (x, y) {
    return { x, y };
  }),
  LatheGeometry: vi.fn(),
  BoxGeometry: vi.fn(),
  CylinderGeometry: vi.fn(),
  SphereGeometry: vi.fn(),
  ConeGeometry: vi.fn(),
  TorusGeometry: vi.fn(),
  MeshStandardMaterial: vi.fn().mockImplementation(function (params) {
    return params || {};
  }),
  Color: vi.fn().mockImplementation(function (c) {
    return { hex: c };
  }),
};

vi.mock('three', () => mockThree);

const { createPiece3D, SKIN_PRESETS } = await import('../js/pieces3D.js');

describe('pieces3D Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should create all standard piece types', () => {
    const types = ['p', 'n', 'b', 'r', 'q', 'k', 'a', 'c', 'e'];
    const colors = ['white', 'black'];

    types.forEach(type => {
      colors.forEach(color => {
        const piece = createPiece3D(type, color);
        expect(piece).toBeDefined();
        expect(mockThree.Group).toHaveBeenCalled();
      });
    });
  });

  test('should apply different skin presets', () => {
    const skins = Object.keys(SKIN_PRESETS);

    skins.forEach(skin => {
      const piece = createPiece3D('p', 'white', skin);
      expect(piece).toBeDefined();
    });
  });

  test('should handle unknown piece type gracefully', () => {
    // Depending on implementation, it might return empty group or throw
    // Based on outline, it seems to just call sub-functions.
    // Let's see if it returns something for 'x'
    const piece = createPiece3D('x', 'white');
    expect(piece).toBeDefined();
  });

  describe('Piece specific generation', () => {
    test('should create Archbishop (hybrid)', () => {
      const piece = createPiece3D('a', 'white');
      expect(piece).toBeDefined();
    });

    test('should create Chancellor (hybrid)', () => {
      const piece = createPiece3D('c', 'white');
      expect(piece).toBeDefined();
    });

    test('should create Angel', () => {
      const piece = createPiece3D('e', 'white');
      expect(piece).toBeDefined();
    });
  });
});
