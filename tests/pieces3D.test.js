import { jest } from '@jest/globals';

// Comprehensive Three.js Mock
const mockThree = {
  Group: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    position: { set: jest.fn() },
    rotation: { set: jest.fn() },
    userData: {},
    traverse: jest.fn(() => {
      // No-op for now, or could simulate children
    }),
  })),
  Mesh: jest.fn().mockImplementation(() => ({
    castShadow: false,
    receiveShadow: false,
    position: { set: jest.fn() },
    rotation: { set: jest.fn(), x: 0, y: 0, z: 0 },
  })),
  Vector2: jest.fn().mockImplementation((x, y) => ({ x, y })),
  LatheGeometry: jest.fn(),
  BoxGeometry: jest.fn(),
  CylinderGeometry: jest.fn(),
  SphereGeometry: jest.fn(),
  ConeGeometry: jest.fn(),
  TorusGeometry: jest.fn(),
  MeshStandardMaterial: jest.fn().mockImplementation(params => params),
  Color: jest.fn().mockImplementation(c => ({ hex: c })),
};

jest.unstable_mockModule('three', () => mockThree);

const { createPiece3D, SKIN_PRESETS } = await import('../js/pieces3D.js');

describe('pieces3D Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
