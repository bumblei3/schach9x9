// Import chess-pieces
const chessPieces = await import('../js/chess-pieces.js');
const { PIECE_SETS, setPieceSkin } = chessPieces;

describe('Chess Pieces', () => {
  describe('PIECE_SETS', () => {
    test('should contain all required skins', () => {
      expect(PIECE_SETS).toHaveProperty('classic');
      expect(PIECE_SETS).toHaveProperty('modern');
      expect(PIECE_SETS).toHaveProperty('pixel');
      expect(PIECE_SETS).toHaveProperty('infernale');
      expect(PIECE_SETS).toHaveProperty('wood');
      expect(PIECE_SETS).toHaveProperty('neon');
      expect(PIECE_SETS).toHaveProperty('minimalist');
    });

    test('each skin should have all piece types', () => {
      const requiredPieces = ['k', 'q', 'r', 'b', 'n', 'p', 'a', 'c', 'e'];

      Object.keys(PIECE_SETS).forEach(skinName => {
        const skin = PIECE_SETS[skinName];
        requiredPieces.forEach(pieceType => {
          expect(skin.white).toHaveProperty(pieceType);
          expect(skin.black).toHaveProperty(pieceType);
        });
      });
    });

    test('each piece should be a non-empty string', () => {
      Object.values(PIECE_SETS).forEach(skin => {
        Object.values(skin.white).forEach(svg => {
          expect(typeof svg).toBe('string');
          expect(svg.length).toBeGreaterThan(0);
        });
        Object.values(skin.black).forEach(svg => {
          expect(typeof svg).toBe('string');
          expect(svg.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('setPieceSkin', () => {
    beforeEach(() => {
      // Reset to default skin
      setPieceSkin('classic');
    });

    test('should switch to modern skin', () => {
      setPieceSkin('modern');
      expect(window.PIECE_SVGS.white.k).toBe(PIECE_SETS.modern.white.k);
      expect(window.PIECE_SVGS.black.q).toBe(PIECE_SETS.modern.black.q);
    });

    test('should switch to pixel skin', () => {
      setPieceSkin('pixel');
      expect(window.PIECE_SVGS.white.r).toBe(PIECE_SETS.pixel.white.r);
      expect(window.PIECE_SVGS.black.n).toBe(PIECE_SETS.pixel.black.n);
    });

    test('should switch to infernale skin', () => {
      setPieceSkin('infernale');
      expect(window.PIECE_SVGS.white.b).toBe(PIECE_SETS.infernale.white.b);
      expect(window.PIECE_SVGS.black.p).toBe(PIECE_SETS.infernale.black.p);
    });

    test('should switch to wood skin', () => {
      setPieceSkin('wood');
      expect(window.PIECE_SVGS.white.a).toBe(PIECE_SETS.wood.white.a);
      expect(window.PIECE_SVGS.black.c).toBe(PIECE_SETS.wood.black.c);
    });

    test('should switch to neon skin', () => {
      setPieceSkin('neon');
      expect(window.PIECE_SVGS.white.e).toBe(PIECE_SETS.neon.white.e);
      expect(window.PIECE_SVGS.black.k).toBe(PIECE_SETS.neon.black.k);
    });

    test('should switch to minimalist skin', () => {
      setPieceSkin('minimalist');
      expect(window.PIECE_SVGS.white.q).toBe(PIECE_SETS.minimalist.white.q);
      expect(window.PIECE_SVGS.black.r).toBe(PIECE_SETS.minimalist.black.r);
    });

    test('should handle switching between skins multiple times', () => {
      setPieceSkin('modern');
      expect(window.PIECE_SVGS.white.k).toBe(PIECE_SETS.modern.white.k);

      setPieceSkin('pixel');
      expect(window.PIECE_SVGS.white.k).toBe(PIECE_SETS.pixel.white.k);

      setPieceSkin('classic');
      expect(window.PIECE_SVGS.white.k).toBe(PIECE_SETS.classic.white.k);
    });

    test('should apply skin to all piece types', () => {
      setPieceSkin('infernale');

      const pieceTypes = ['k', 'q', 'r', 'b', 'n', 'p', 'a', 'c', 'e'];
      pieceTypes.forEach(type => {
        expect(window.PIECE_SVGS.white[type]).toBe(PIECE_SETS.infernale.white[type]);
        expect(window.PIECE_SVGS.black[type]).toBe(PIECE_SETS.infernale.black[type]);
      });
    });
  });

  describe('PIECE_SVGS global', () => {
    test('should be accessible via window.PIECE_SVGS', () => {
      expect(window.PIECE_SVGS).toBeDefined();
      expect(window.PIECE_SVGS.white).toBeDefined();
      expect(window.PIECE_SVGS.black).toBeDefined();
    });

    test('should have default classic skin on initialization', () => {
      // Reset and verify
      setPieceSkin('classic');
      expect(window.PIECE_SVGS.white.k).toBe(PIECE_SETS.classic.white.k);
    });
  });

  describe('getAvailableSkins', () => {
    test('should return all available skins', () => {
      const skins = chessPieces.getAvailableSkins();

      expect(skins).toHaveLength(8);
      expect(skins).toEqual([
        { id: 'classic', name: 'Klassisch' },
        { id: 'modern', name: 'Modern' },
        { id: 'pixel', name: 'Pixel' },
        { id: 'infernale', name: 'Infernale' },
        { id: 'wood', name: 'Holz' },
        { id: 'neon', name: 'Neon' },
        { id: 'minimalist', name: 'Minimalistisch' },
        { id: 'frost', name: 'Frost' },
      ]);
    });
  });

  describe('setPieceSkin with invalid skin', () => {
    test('should return false for invalid skin name', () => {
      const result = setPieceSkin('invalid-skin');
      expect(result).toBe(false);
    });

    test('should not change skin when given invalid name', () => {
      setPieceSkin('pixel');
      const beforeSkin = window.PIECE_SVGS.white.k;

      setPieceSkin('nonexistent');

      expect(window.PIECE_SVGS.white.k).toBe(beforeSkin);
    });
  });
});
