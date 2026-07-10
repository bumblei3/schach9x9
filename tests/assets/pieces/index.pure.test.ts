import { describe, test, expect, beforeEach } from 'vitest';
import {
  PIECE_SETS,
  PIECE_SVGS,
  setPieceSkin,
  getAvailableSkins,
} from '../../../js/assets/pieces/index.js';

describe('piece skins — sets & defaults', () => {
  test('all eight named skins are registered', () => {
    expect(Object.keys(PIECE_SETS).sort()).toEqual(
      ['classic', 'frost', 'infernale', 'minimalist', 'modern', 'neon', 'pixel', 'wood'].sort()
    );
  });

  test('every skin provides white and black piece maps', () => {
    for (const skin of Object.values(PIECE_SETS) as { white: unknown; black: unknown }[]) {
      expect(skin.white).toBeTypeOf('object');
      expect(skin.black).toBeTypeOf('object');
    }
  });

  test('default skin is classic and exposed as PIECE_SVGS', () => {
    expect(PIECE_SVGS).toBe(PIECE_SETS.classic);
  });
});

describe('piece skins — setPieceSkin', () => {
  beforeEach(() => {
    setPieceSkin('classic');
  });

  test('switches to a valid skin and updates PIECE_SVGS', () => {
    const ok = setPieceSkin('neon');
    expect(ok).toBe(true);
    expect(PIECE_SVGS).toBe(PIECE_SETS.neon);
  });

  test('mirrors the active skin onto window.PIECE_SVGS', () => {
    setPieceSkin('wood');
    expect((window as any).PIECE_SVGS).toBe(PIECE_SETS.wood);
  });

  test('rejects an unknown skin name and leaves the current skin intact', () => {
    setPieceSkin('modern');
    const ok = setPieceSkin('does-not-exist');
    expect(ok).toBe(false);
    expect(PIECE_SVGS).toBe(PIECE_SETS.modern);
  });

  test('re-selecting the current skin is a no-op but still returns true', () => {
    setPieceSkin('classic');
    const ok = setPieceSkin('classic');
    expect(ok).toBe(true);
    expect(PIECE_SVGS).toBe(PIECE_SETS.classic);
  });
});

describe('piece skins — getAvailableSkins', () => {
  test('returns all eight skins with id and localized name', () => {
    const skins = getAvailableSkins();
    expect(skins).toHaveLength(8);
    const byId = Object.fromEntries(skins.map((s: { id: string; name: string }) => [s.id, s.name]));
    expect(byId.classic).toBe('Klassisch');
    expect(byId.frost).toBe('Frost');
    expect(byId.minimalist).toBe('Minimalistisch');
    // every entry has both fields
    for (const s of skins) {
      expect(s.id).toBeTypeOf('string');
      expect(s.name).toBeTypeOf('string');
    }
  });
});
