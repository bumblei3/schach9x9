/**
 * Input Handler for 3D Battle Chess
 * Handles mouse interactions and raycasting
 */

import * as THREE from 'three';
import type { SceneManager3D } from './SceneManager3D.js';
import type { PieceManager3D } from './PieceManager3D.js';

export class InputHandler3D {
  public sceneManager: SceneManager3D;
  public pieceManager: PieceManager3D;
  public raycaster: THREE.Raycaster;
  public mouse: THREE.Vector2;
  public clickHandler: (event: MouseEvent) => void;
  public enabled: boolean;

  constructor(sceneManager: SceneManager3D, pieceManager: PieceManager3D) {
    this.sceneManager = sceneManager;
    this.pieceManager = pieceManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clickHandler = this.onClick.bind(this);
    this.enabled = false;
  }

  enable(): void {
    if (this.enabled) return;
    if (this.sceneManager.renderer) {
      this.sceneManager.renderer.domElement.addEventListener('click', this.clickHandler);
    }
    this.enabled = true;
  }

  disable(): void {
    if (!this.enabled) return;
    if (this.sceneManager.renderer) {
      this.sceneManager.renderer.domElement.removeEventListener('click', this.clickHandler);
    }
    this.enabled = false;
  }

  onClick(event: MouseEvent): void {
    if (this.pieceManager.animating) return;
    if (!this.sceneManager.renderer || !this.sceneManager.camera) return;

    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

    // Objects to intersect: Board group children (squares) + Pieces
    const boardObjects = this.sceneManager.boardGroup ? this.sceneManager.boardGroup.children : [];
    const pieceObjects = Object.values(this.pieceManager.pieces);
    const allObjects = [...boardObjects, ...pieceObjects];

    const intersects = this.raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
      for (const intersect of intersects) {
        const obj = intersect.object;

        let target: THREE.Object3D | null = obj;
        while (target) {
          if (target.userData && target.userData.row !== undefined) {
            const clickEvent = new CustomEvent('board3dclick', {
              detail: {
                row: target.userData.row,
                col: target.userData.col,
                type: target.userData.type,
                color: target.userData.color,
              },
            });
            window.dispatchEvent(clickEvent);
            return; // Handled
          }
          target = target.parent;
          if (target === this.sceneManager.scene) break;
        }
      }
    }
  }

  dispose(): void {
    this.disable();
  }
}
