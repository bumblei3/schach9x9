

// Comprehensive Three.js Mock for Animations
// Comprehensive Three.js Mock for Animations
const mockThree = {
  Scene: vi.fn().mockImplementation(function () {
    return {
      add: vi.fn(),
      remove: vi.fn(),
      children: [],
    };
  }),
  PerspectiveCamera: vi.fn().mockImplementation(function () {
    return {
      position: new mockThree.Vector3(),
      lookAt: vi.fn(),
      quaternion: {
        clone: vi.fn(() => ({ copy: vi.fn() })),
        copy: vi.fn(),
      },
    };
  }),
  Vector3: vi.fn().mockImplementation(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }),
  Group: vi.fn().mockImplementation(function () {
    return {
      add: vi.fn(),
      remove: vi.fn(),
      position: new mockThree.Vector3(),
      rotation: new mockThree.Vector3(),
      children: [],
    };
  }),
  Mesh: vi.fn().mockImplementation(function () {
    return {
      position: new mockThree.Vector3(),
      scale: new mockThree.Vector3(),
      rotation: new mockThree.Vector3(),
      material: {
        opacity: 1,
        transparent: true,
        color: { setHex: vi.fn(), set: vi.fn() },
        dispose: vi.fn(),
      },
      geometry: { dispose: vi.fn() },
    };
  }),
  SphereGeometry: vi.fn(),
  RingGeometry: vi.fn(),
  CylinderGeometry: vi.fn(),
  TorusGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn().mockImplementation(function (p) {
    return p || {};
  }),
  AdditiveBlending: 1,
  DoubleSide: 2,
};

mockThree.Vector3.prototype = {
  set: vi.fn(),
  clone: function () {
    return new mockThree.Vector3(this.x, this.y, this.z);
  },
  copy: vi.fn(),
  sub: vi.fn(),
  add: vi.fn(),
  multiplyScalar: vi.fn(),
  addScaledVector: vi.fn(),
  lerp: vi.fn(),
  lerpVectors: vi.fn(),
  length: vi.fn(() => 1),
  normalize: vi.fn(function () {
    return this;
  }),
};

vi.mock('three', () => mockThree);

const { BattleAnimator } = await import('../js/battleAnimations.js');

describe('BattleAnimator Class', () => {
  let scene, camera, animator;

  beforeEach(() => {
    scene = new mockThree.Scene();
    camera = new mockThree.PerspectiveCamera();
    // Add lerpVectors to camera.position specifically since it's used there
    camera.position.lerpVectors = vi.fn();
    animator = new BattleAnimator(scene, camera);
    vi.clearAllMocks();

    // Mock Math.random to return 0 for first animation 'charge'
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    vi.useFakeTimers();
    animator.saveCameraState();
    expect(animator.originalCameraPos).toBeDefined();

    const restorePromise = animator.restoreCamera();

    // Progress the animation
    vi.advanceTimersByTime(700);

    await restorePromise;
    expect(camera.position.lerpVectors).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('should playBattle sequence', async () => {
    const attacker = { type: 'q', color: 'white' };
    const defender = { type: 'p', color: 'black' };
    const attackerPos = { x: 0, y: 0, z: 0 };
    const defenderPos = { x: 1, y: 0, z: 1 };

    // Mock internal methods to speed up test
    animator.moveCameraToBattle = vi.fn(() => Promise.resolve());
    animator.executeBattleAnimation = vi.fn(() => Promise.resolve());
    animator.restoreCamera = vi.fn(() => Promise.resolve());

    await animator.playBattle(attacker, defender, attackerPos, defenderPos);

    expect(animator.moveCameraToBattle).toHaveBeenCalled();
    expect(animator.executeBattleAnimation).toHaveBeenCalled();
    expect(animator.restoreCamera).toHaveBeenCalled();
  });

  test('should execute all battle animation types', async () => {
    const attacker = { type: 'q' };
    const defender = { type: 'p' };
    const pos = { x: 0, y: 0, z: 0 };

    animator.animateCharge = vi.fn(() => Promise.resolve());
    animator.animateStrike = vi.fn(() => Promise.resolve());
    animator.animateClash = vi.fn(() => Promise.resolve());
    animator.animateOverpower = vi.fn(() => Promise.resolve());
    animator.animateDefeat = vi.fn(() => Promise.resolve());

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
    vi.useFakeTimers();
    const pos = { x: 0, y: 0, z: 0 };

    // Test Charge
    const chargePromise = animator.animateCharge(pos, pos);
    vi.advanceTimersByTime(600);
    await chargePromise;

    // Test Strike
    const strikePromise = animator.animateStrike(pos, pos);
    vi.advanceTimersByTime(400);
    await strikePromise;

    // Test Clash
    const clashPromise = animator.animateClash(pos, pos);
    vi.advanceTimersByTime(700);
    await clashPromise;

    // Test Defeat
    const defeatPromise = animator.animateDefeat(pos);
    vi.advanceTimersByTime(900);
    await defeatPromise;

    expect(scene.remove).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('should run animateOverpower with RAF mock', async () => {
    const pos = { x: 0, y: 0, z: 0 };

    // Mock requestAnimationFrame to call the callback immediately
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(function (cb) {
      setTimeout(cb, 0);
      return 1;
    });

    const realDate = Date.now;
    let currentTime = Date.now();
    global.Date.now = vi.fn(() => currentTime);

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
