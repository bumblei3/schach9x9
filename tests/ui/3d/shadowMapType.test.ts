/**
 * three.js r186 removed `PCFSoftShadowMap` (it is kept only as a deprecated
 * constant): assigning it to `renderer.shadowMap.type` logs
 *
 *   THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using
 *   PCFShadowMap instead.
 *
 * on every page load — the renderer is built eagerly, so the warning shows up
 * even for players who never open the 3D view — and then falls back anyway.
 * This guards against the removed constant creeping back in.
 */

import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { SHADOW_MAP_TYPE } from '../../../js/ui/3d/SceneManager3D.js';

describe('3D renderer shadow map', () => {
  test('uses the shadow map type current three.js still supports', () => {
    expect(SHADOW_MAP_TYPE).toBe(THREE.PCFShadowMap);
  });

  test('does not use the constant three.js removed', () => {
    expect(SHADOW_MAP_TYPE).not.toBe(THREE.PCFSoftShadowMap);
  });
});
