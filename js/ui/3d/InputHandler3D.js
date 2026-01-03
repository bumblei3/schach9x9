/**
 * Input Handler for 3D Battle Chess
 * Handles mouse interactions and raycasting
 */

import * as THREE from 'three';

export class InputHandler3D {
  constructor(sceneManager, pieceManager) {
    this.sceneManager = sceneManager;
    this.pieceManager = pieceManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clickHandler = this.onClick.bind(this);
    this.enabled = false;
  }

  enable() {
    if (this.enabled) return;
    this.sceneManager.renderer.domElement.addEventListener('click', this.clickHandler);
    this.enabled = true;
  }

  disable() {
    if (!this.enabled) return;
    this.sceneManager.renderer.domElement.removeEventListener('click', this.clickHandler);
    this.enabled = false;
  }

  onClick(event) {
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
        // Check for mesh which might be child of group (piece) or direct (square)
        // Pieces are groups usually, but raycast hits mesh. Need to traverse up to find userData?
        // In original code: obj.userData was used. Assuming pieces3D sets userData on children or we hit the mesh which has userData.
        // Actually createPiece3D sets userData on the Group. Raycast usually hits Mesh inside Group.
        // We need to find the parent with userData.

        let target = obj;
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

  dispose() {
    this.disable();
  }
}
