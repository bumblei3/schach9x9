import { jest } from '@jest/globals';

// Comprehensive Three.js Mock for Animations
const mockThree = {
  Scene: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  })),
  PerspectiveCamera: jest.fn().mockImplementation(() => ({
    position: new mockThree.Vector3(),
    lookAt: jest.fn(),
    quaternion: {
      clone: jest.fn(() => ({ copy: jest.fn() })),
      copy: jest.fn()
    }
  })),
  Vector3: jest.fn().mockImplementation(function (x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }),
  Group: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    position: new mockThree.Vector3(),
    rotation: new mockThree.Vector3(),
    children: []
  })),
  Mesh: jest.fn().mockImplementation(() => ({
    position: new mockThree.Vector3(),
    scale: new mockThree.Vector3(),
    rotation: new mockThree.Vector3(),
    material: {
      opacity: 1,
      transparent: true,
      color: { setHex: jest.fn(), set: jest.fn() },
      dispose: jest.fn()
    },
    geometry: { dispose: jest.fn() }
  })),
  SphereGeometry: jest.fn(),
  RingGeometry: jest.fn(),
  CylinderGeometry: jest.fn(),
  TorusGeometry: jest.fn(),
  MeshBasicMaterial: jest.fn().mockImplementation((p) => p),
  AdditiveBlending: 1,
  DoubleSide: 2
};

mockThree.Vector3.prototype = {
  set: jest.fn(),
  clone: function () {
    return new mockThree.Vector3(this.x, this.y, this.z);
  },
  copy: jest.fn(),
  sub: jest.fn(),
  add: jest.fn(),
  multiplyScalar: jest.fn(),
  addScaledVector: jest.fn(),
  lerp: jest.fn(),
  lerpVectors: jest.fn(),
  length: jest.fn(() => 1),
  normalize: jest.fn(function () { return this; })
};

jest.unstable_mockModule('three', () => mockThree);

const { BattleAnimator } = await import('../js/battleAnimations.js');

describe('BattleAnimator Class', () => {
  let scene, camera, animator;

  beforeEach(() => {
    scene = new mockThree.Scene();
    camera = new mockThree.PerspectiveCamera();
    // Add lerpVectors to camera.position specifically since it's used there
    camera.position.lerpVectors = jest.fn();
    animator = new BattleAnimator(scene, camera);
    jest.clearAllMocks();

    // Mock Math.random to return 0 for first animation 'charge'
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    Math.random.mockRestore();
  });

  test('should initialize correctly', () => {
    expect(animator.scene).toBe(scene);
    expect(animator.camera).toBe(camera);
  });

  test('should selectBattleAnimation based on random pool', () => {
    // With Math.random = 0, it should be 'charge'
    expect(animator.selectBattleAnimation('q', 'p')).toBe('charge');
  });

  test('should save and restore camera state', async () => {
    jest.useFakeTimers();
    animator.saveCameraState();
    expect(animator.originalCameraPos).toBeDefined();

    const restorePromise = animator.restoreCamera();

    // Progress the animation
    jest.advanceTimersByTime(700);

    await restorePromise;
    expect(camera.position.lerpVectors).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('should playBattle sequence', async () => {
    const attacker = { type: 'q', color: 'white' };
    const defender = { type: 'p', color: 'black' };
    const attackerPos = { x: 0, y: 0, z: 0 };
    const defenderPos = { x: 1, y: 0, z: 1 };

    // Mock internal methods to speed up test
    animator.moveCameraToBattle = jest.fn(() => Promise.resolve());
    animator.executeBattleAnimation = jest.fn(() => Promise.resolve());
    animator.restoreCamera = jest.fn(() => Promise.resolve());

    await animator.playBattle(attacker, defender, attackerPos, defenderPos);

    expect(animator.moveCameraToBattle).toHaveBeenCalled();
    expect(animator.executeBattleAnimation).toHaveBeenCalled();
    expect(animator.restoreCamera).toHaveBeenCalled();
  });

  test('should execute all battle animation types', async () => {
    const attacker = { type: 'q' };
    const defender = { type: 'p' };
    const pos = { x: 0, y: 0, z: 0 };

    animator.animateCharge = jest.fn(() => Promise.resolve());
    animator.animateStrike = jest.fn(() => Promise.resolve());
    animator.animateClash = jest.fn(() => Promise.resolve());
    animator.animateOverpower = jest.fn(() => Promise.resolve());
    animator.animateDefeat = jest.fn(() => Promise.resolve());

    await animator.executeBattleAnimation('charge', attacker, defender, pos, pos);
    expect(animator.animateCharge).toHaveBeenCalled();

    await animator.executeBattleAnimation('strike', attacker, defender, pos, pos);
    expect(animator.animateStrike).toHaveBeenCalled();

    await animator.executeBattleAnimation('clash', attacker, defender, pos, pos);
    expect(animator.animateClash).toHaveBeenCalled();

    await animator.executeBattleAnimation('overpower', attacker, defender, pos, pos);
    expect(animator.animateOverpower).toHaveBeenCalled();

    expect(animator.animateDefeat).toHaveBeenCalledTimes(4);
  });

  test('should run actual animations with fake timers', async () => {
    jest.useFakeTimers();
    const pos = { x: 0, y: 0, z: 0 };

    // Test Charge
    const chargePromise = animator.animateCharge(pos, pos);
    jest.advanceTimersByTime(600);
    await chargePromise;

    // Test Strike
    const strikePromise = animator.animateStrike(pos, pos);
    jest.advanceTimersByTime(400);
    await strikePromise;

    // Test Clash
    const clashPromise = animator.animateClash(pos, pos);
    jest.advanceTimersByTime(700);
    await clashPromise;

    // Test Defeat
    const defeatPromise = animator.animateDefeat(pos);
    jest.advanceTimersByTime(900);
    await defeatPromise;

    expect(scene.remove).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('should run animateOverpower with RAF mock', async () => {
    const pos = { x: 0, y: 0, z: 0 };

    // Mock requestAnimationFrame to call the callback immediately
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      setTimeout(cb, 0);
      return 1;
    });

    const realDate = Date.now;
    let currentTime = Date.now();
    global.Date.now = jest.fn(() => currentTime);

    const overpowerPromise = animator.animateOverpower(pos, pos);

    // Jump time to finish
    currentTime += 800;

    await overpowerPromise;

    expect(scene.remove).toHaveBeenCalled();
    rafSpy.mockRestore();
    global.Date.now = realDate;
  });

  test('should create various visual effects', () => {
    const pos = { x: 0, y: 0, z: 0 };

    animator.createDustParticles(pos);
    animator.createFlashEffect(pos);
    animator.createSparkParticles(1, 1, 1);
    animator.createShockwave(pos);
    animator.createSmokeEffect(pos);

    expect(scene.add).toHaveBeenCalled();
    expect(mockThree.RingGeometry).toHaveBeenCalled();
  });
});
