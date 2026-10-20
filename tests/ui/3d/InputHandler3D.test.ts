import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { InputHandler3D } from '../../../js/ui/3d/InputHandler3D.js';

// Mock logger
vi.mock('../../../js/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('InputHandler3D', () => {
  let sceneManager: any;
  let pieceManager: any;
  let handler: InputHandler3D;

  beforeEach(() => {
    vi.clearAllMocks();
    pieceManager = { animating: false, pieces: {} };
    sceneManager = {
      renderer: {
        domElement: document.createElement('canvas'),
      },
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      boardGroup: new THREE.Group(),
    };
    handler = new InputHandler3D(sceneManager, pieceManager);
  });

  test('constructor initializes defaults', () => {
    expect(handler.sceneManager).toBe(sceneManager);
    expect(handler.pieceManager).toBe(pieceManager);
    expect(handler.raycaster).toBeInstanceOf(THREE.Raycaster);
    expect(handler.mouse).toBeInstanceOf(THREE.Vector2);
    expect(handler.enabled).toBe(false);
  });

  test('enable attaches click listener when renderer exists', () => {
    const spy = vi.spyOn(sceneManager.renderer.domElement, 'addEventListener');
    handler.enable();
    expect(handler.enabled).toBe(true);
    expect(spy).toHaveBeenCalledWith('click', handler.clickHandler);
  });

  test('enable is idempotent', () => {
    handler.enable();
    const spy = vi.spyOn(sceneManager.renderer.domElement, 'addEventListener');
    handler.enable();
    expect(spy).not.toHaveBeenCalled();
  });

  test('disable removes click listener when enabled', () => {
    handler.enable();
    const spy = vi.spyOn(sceneManager.renderer.domElement, 'removeEventListener');
    handler.disable();
    expect(handler.enabled).toBe(false);
    expect(spy).toHaveBeenCalledWith('click', handler.clickHandler);
  });

  test('disable is idempotent', () => {
    const spy = vi.spyOn(sceneManager.renderer.domElement, 'removeEventListener');
    handler.disable();
    expect(spy).not.toHaveBeenCalled();
  });

  test('onClick returns early when animating', () => {
    pieceManager.animating = true;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    handler.onClick(new MouseEvent('click'));
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  test('onClick returns early without renderer/camera', () => {
    sceneManager.renderer = null;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    handler.onClick(new MouseEvent('click'));
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  test('onClick dispatches board3dclick when intersect hits userData', () => {
    // mock raycaster.intersectObjects to return an object with userData
    const obj = new THREE.Object3D();
    obj.userData = { row: 3, col: 4, type: 'p', color: 'white' };
    handler.raycaster.intersectObjects = vi.fn().mockReturnValue([{ object: obj }]);

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    handler.onClick(new MouseEvent('click', { clientX: 10, clientY: 20 }));

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('board3dclick');
    expect(event.detail).toEqual({ row: 3, col: 4, type: 'p', color: 'white' });
  });

  test('onClick dispatches nothing when no intersects', () => {
    handler.raycaster.intersectObjects = vi.fn().mockReturnValue([]);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    handler.onClick(new MouseEvent('click'));
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  test('dispose disables the handler', () => {
    handler.enable();
    handler.dispose();
    expect(handler.enabled).toBe(false);
  });
});
