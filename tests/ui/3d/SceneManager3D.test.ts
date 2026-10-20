import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { SceneManager3D, SHADOW_MAP_TYPE } from '../../../js/ui/3d/SceneManager3D.js';

// Mock logger
vi.mock('../../../js/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock('../../../js/config.js', () => ({
  BOARD_SIZE: 9,
  getCurrentBoardSize: () => 9,
}));

describe('SceneManager3D', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, writable: true });
  });

  test('constructor initializes defaults', () => {
    const sm = new SceneManager3D(container);
    expect(sm.container).toBe(container);
    expect(sm.scene).toBeNull();
    expect(sm.camera).toBeNull();
    expect(sm.renderer).toBeNull();
    expect(sm.controls).toBeNull();
    expect(sm.boardGroup).toBeNull();
    expect(sm.squareSize).toBe(1);
    expect(sm.currentTheme).toBe('classic');
    expect(sm.enabled).toBe(false);
  });

  test('SHADOW_MAP_TYPE is PCFShadowMap', () => {
    expect(SHADOW_MAP_TYPE).toBe(THREE.PCFShadowMap);
  });

  test('boardToWorld maps (row, col) to centered coordinates', () => {
    const sm = new SceneManager3D(container);
    // BOARD_SIZE=9, offset=4, squareSize=1
    expect(sm.boardToWorld(0, 0)).toEqual({ x: -4, z: -4 });
    expect(sm.boardToWorld(4, 4)).toEqual({ x: 0, z: 0 });
    expect(sm.boardToWorld(8, 8)).toEqual({ x: 4, z: 4 });
    expect(sm.boardToWorld(0, 8)).toEqual({ x: 4, z: -4 });
  });

  test('boardToWorld respects squareSize', () => {
    const sm = new SceneManager3D(container);
    sm.squareSize = 2;
    expect(sm.boardToWorld(0, 0)).toEqual({ x: -8, z: -8 });
    expect(sm.boardToWorld(8, 8)).toEqual({ x: 8, z: 8 });
  });

  test('getThemeColors returns known themes', () => {
    const sm = new SceneManager3D(container);
    expect(sm.getThemeColors('classic')).toEqual({ light: 0xe8dcc0, dark: 0x6b5d4f });
    expect(sm.getThemeColors('blue')).toEqual({ light: 0x87ceeb, dark: 0x4682b4 });
    expect(sm.getThemeColors('green')).toEqual({ light: 0x90ee90, dark: 0x228b22 });
    expect(sm.getThemeColors('wood')).toEqual({ light: 0xdeb887, dark: 0x8b4513 });
    expect(sm.getThemeColors('dark')).toEqual({ light: 0x4a4a4a, dark: 0x2a2a2a });
  });

  test('getThemeColors falls back to classic for unknown theme', () => {
    const sm = new SceneManager3D(container);
    expect(sm.getThemeColors('nonexistent')).toEqual({ light: 0xe8dcc0, dark: 0x6b5d4f });
  });

  test('setTheme updates currentTheme when boardGroup and scene exist', () => {
    const sm = new SceneManager3D(container);
    const scene = new THREE.Scene();
    const boardGroup = new THREE.Group();
    // add a square mesh with userData
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), mat);
    mesh.userData = { type: 'square', isLight: true };
    boardGroup.add(mesh);

    sm.scene = scene;
    sm.boardGroup = boardGroup;
    sm.setTheme('blue');

    expect(sm.currentTheme).toBe('blue');
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x87ceeb);
  });

  test('setTheme does nothing when boardGroup is null', () => {
    const sm = new SceneManager3D(container);
    sm.scene = new THREE.Scene();
    sm.currentTheme = 'classic';
    sm.setTheme('blue');
    expect(sm.currentTheme).toBe('classic');
  });

  test('setTheme does nothing when scene is null', () => {
    const sm = new SceneManager3D(container);
    sm.boardGroup = new THREE.Group();
    sm.currentTheme = 'classic';
    sm.setTheme('blue');
    expect(sm.currentTheme).toBe('classic');
  });

  test('onWindowResize does nothing without camera/renderer/container', () => {
    const sm = new SceneManager3D(container);
    // should not throw
    sm.onWindowResize();
    expect(sm.camera).toBeNull();
  });

  test('onWindowResize does nothing when dimensions are zero', () => {
    const sm = new SceneManager3D(container);
    const camera = new THREE.PerspectiveCamera();
    const renderer = { setSize: vi.fn() } as any;
    sm.camera = camera;
    sm.renderer = renderer;
    Object.defineProperty(container, 'clientWidth', { value: 0, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 0, writable: true });
    sm.onWindowResize();
    expect(renderer.setSize).not.toHaveBeenCalled();
  });

  test('dispose sets enabled to false', () => {
    const sm = new SceneManager3D(container);
    sm.enabled = true;
    sm.dispose();
    expect(sm.enabled).toBe(false);
  });
});
