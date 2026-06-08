/**
 * Battle Animations for 3D Chess
 * Handles animated battle sequences when pieces capture each other
 * @module battleAnimations
 */

import * as THREE from 'three';
import { logger } from './logger.js';

interface BattlePiece {
  type: string;
  color: string;
}

/**
 * Battle Animator - choreographs piece capture animations
 */
export class BattleAnimator {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public originalCameraPos: THREE.Vector3 | null = null;
  public originalCameraTarget: THREE.Vector3 | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.originalCameraPos = null;
    this.originalCameraTarget = null;
  }

  /**
   * Play a battle sequence
   */
  public async playBattle(
    attacker: BattlePiece,
    defender: BattlePiece,
    attackerPos: THREE.Vector3 | { x: number; z: number } | { x: number; z: number },
    defenderPos: THREE.Vector3 | { x: number; z: number } | { x: number; z: number }
  ): Promise<void> {
    logger.info(`Battle: ${attacker.type} vs ${defender.type}`);

    // Save camera state
    this.saveCameraState();

    // Move camera to battle view
    await this.moveCameraToBattle(attackerPos, defenderPos);

    // Select and play battle animation
    const animation = this.selectBattleAnimation(attacker.type, defender.type);
    await this.executeBattleAnimation(animation, attacker, defender, attackerPos, defenderPos);

    // Restore camera
    await this.restoreCamera();
  }

  /**
   * Save current camera state
   */
  public saveCameraState(): void {
    this.originalCameraPos = this.camera.position.clone();
    this.originalCameraTarget = new THREE.Vector3(0, 0, 0);
  }

  /**
   * Move camera to battle viewpoint
   */
  public async moveCameraToBattle(
    attackerPos: THREE.Vector3 | { x: number; z: number },
    defenderPos: THREE.Vector3 | { x: number; z: number }
  ): Promise<void> {
    const midpoint = new THREE.Vector3(
      (attackerPos.x + defenderPos.x) / 2,
      0.5,
      (attackerPos.z + defenderPos.z) / 2
    );
    const cameraPos = new THREE.Vector3(midpoint.x + 3, 2, midpoint.z + 3);
    return this.animateCameraMove(cameraPos, midpoint, 800);
  }

  /**
   * Restore camera to original position
   */
  public async restoreCamera(): Promise<void> {
    if (!this.originalCameraPos) return;
    return this.animateCameraMove(this.originalCameraPos, this.originalCameraTarget!, 600);
  }

  /**
   * Animate camera movement
   */
  public animateCameraMove(
    targetPos: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number
  ): Promise<void> {
    const startPos = this.camera.position.clone();
    const startTime = Date.now();

    return new Promise(resolve => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased =
          progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        this.camera.position.lerpVectors(startPos, targetPos, eased);
        this.camera.lookAt(lookAt);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  /**
   * Select appropriate battle animation
   */
  public selectBattleAnimation(_attackerType: string, _defenderType: string): string {
    const animations = ['charge', 'strike', 'clash', 'overpower'];
    return animations[Math.floor(Math.random() * animations.length)];
  }

  /**
   * Execute the battle animation
   */
  public async executeBattleAnimation(
    animationType: string,
    _attacker: BattlePiece,
    _defender: BattlePiece,
    attackerPos: THREE.Vector3 | { x: number; z: number },
    defenderPos: THREE.Vector3 | { x: number; z: number }
  ): Promise<void> {
    switch (animationType) {
      case 'charge':
        await this.animateCharge(attackerPos, defenderPos);
        break;
      case 'strike':
        await this.animateStrike(attackerPos, defenderPos);
        break;
      case 'clash':
        await this.animateClash(attackerPos, defenderPos);
        break;
      case 'overpower':
        await this.animateOverpower(attackerPos, defenderPos);
        break;
      default:
        await this.animateCharge(attackerPos, defenderPos);
    }
    await this.animateDefeat(defenderPos);
  }

  /**
   * Charge animation - attacker rushes forward
   */
  public async animateCharge(
    attackerPos: THREE.Vector3 | { x: number; z: number },
    _defenderPos: THREE.Vector3 | { x: number; z: number }
  ): Promise<void> {
    const particles = this.createDustParticles(attackerPos);
    return new Promise(resolve => {
      setTimeout(() => {
        particles.forEach(p => this.scene.remove(p));
        resolve();
      }, 500);
    });
  }

  /**
   * Strike animation - quick attack
   */
  public async animateStrike(
    _attackerPos: THREE.Vector3 | { x: number; z: number },
    defenderPos: THREE.Vector3 | { x: number; z: number }
  ): Promise<void> {
    const flash = this.createFlashEffect(defenderPos);
    return new Promise(resolve => {
      setTimeout(() => {
        this.scene.remove(flash);
        resolve();
      }, 300);
    });
  }

  /**
   * Clash animation - both pieces engage
   */
  public async animateClash(
    attackerPos: THREE.Vector3 | { x: number; z: number },
    defenderPos: THREE.Vector3 | { x: number; z: number }
  ): Promise<void> {
    const sparks = this.createSparkParticles(
      (attackerPos.x + defenderPos.x) / 2,
      0.5,
      (attackerPos.z + defenderPos.z) / 2
    );
    return new Promise(resolve => {
      setTimeout(() => {
        sparks.forEach(s => this.scene.remove(s));
        resolve();
      }, 600);
    });
  }

  /**
   * Overpower animation - attacker dominates
   */
  public async animateOverpower(
    _attackerPos: THREE.Vector3 | { x: number; z: number },
    defenderPos: THREE.Vector3 | { x: number; z: number }
  ): Promise<void> {
    const shockwave = this.createShockwave(defenderPos);
    return new Promise(resolve => {
      const startTime = Date.now();
      const duration = 700;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        if (shockwave) {
          shockwave.scale.set(1 + progress * 2, 1, 1 + progress * 2);
          (shockwave.material as THREE.Material).opacity = 1 - progress;
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(shockwave);
          resolve();
        }
      };
      animate();
    });
  }

  /**
   * Defeat animation - defender is defeated
   */
  public async animateDefeat(defenderPos: THREE.Vector3 | { x: number; z: number }): Promise<void> {
    const smoke = this.createSmokeEffect(defenderPos);
    return new Promise(resolve => {
      setTimeout(() => {
        smoke.forEach(s => this.scene.remove(s));
        resolve();
      }, 800);
    });
  }

  /**
   * Create dust particle effects
   */
  public createDustParticles(position: THREE.Vector3 | { x: number; z: number }): THREE.Mesh[] {
    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const geometry = new THREE.SphereGeometry(0.05, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: 0xccaa88,
        transparent: true,
        opacity: 0.6,
      });
      const particle = new THREE.Mesh(geometry, material);
      particle.position.set(
        position.x + (Math.random() - 0.5) * 0.5,
        0.1,
        position.z + (Math.random() - 0.5) * 0.5
      );
      this.scene.add(particle);
      particles.push(particle);
    }
    return particles;
  }

  /**
   * Create flash effect
   */
  public createFlashEffect(position: THREE.Vector3 | { x: number; z: number }): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
    });
    const flash = new THREE.Mesh(geometry, material);
    flash.position.set(position.x, 0.5, position.z);
    this.scene.add(flash);
    return flash;
  }

  /**
   * Create spark particles
   */
  public createSparkParticles(x: number, y: number, z: number): THREE.Mesh[] {
    const sparks: THREE.Mesh[] = [];
    for (let i = 0; i < 15; i++) {
      const geometry = new THREE.SphereGeometry(0.03, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.9,
      });
      const spark = new THREE.Mesh(geometry, material);
      spark.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + Math.random() * 0.3,
        z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(spark);
      sparks.push(spark);
    }
    return sparks;
  }

  /**
   * Create shockwave effect
   */
  public createShockwave(position: THREE.Vector3 | { x: number; z: number }): THREE.Mesh {
    const geometry = new THREE.RingGeometry(0.2, 0.3, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const shockwave = new THREE.Mesh(geometry, material);
    shockwave.position.set(position.x, 0.05, position.z);
    shockwave.rotation.x = -Math.PI / 2;
    this.scene.add(shockwave);
    return shockwave;
  }

  /**
   * Create smoke effect
   */
  public createSmokeEffect(position: THREE.Vector3 | { x: number; z: number }): THREE.Mesh[] {
    const smoke: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const geometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.5,
      });
      const puff = new THREE.Mesh(geometry, material);
      puff.position.set(
        position.x + (Math.random() - 0.5) * 0.3,
        0.2 + Math.random() * 0.3,
        position.z + (Math.random() - 0.5) * 0.3
      );
      this.scene.add(puff);
      smoke.push(puff);
    }
    return smoke;
  }
}
