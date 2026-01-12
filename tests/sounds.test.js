// sounds.test.js
// Tests for the SoundManager class


// Mock Web Audio API before importing SoundManager
global.window = global.window || {};

// Create a mock AudioContext
const mockOscillator = {
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  type: 'sine',
  frequency: {
    setValueAtTime: vi.fn(),
    value: 440,
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
};

const mockGain = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    value: 1,
  },
};

global.window.AudioContext = class MockAudioContext {
  constructor() {
    this.destination = {};
    this.currentTime = 0;
    this.state = 'suspended';
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    return {
      ...mockOscillator,
      frequency: { ...mockOscillator.frequency },
    };
  }
  createGain() {
    return mockGain;
  }
};

describe('SoundManager', () => {
  let SoundManager;

  beforeAll(async () => {
    const mod = await import('../js/sounds.js');
    SoundManager = mod.SoundManager;
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('initial settings and persistence', () => {
    const manager = new SoundManager();
    expect(manager.enabled).toBe(true);
    manager.setVolume(50);
    expect(manager.volume).toBeCloseTo(0.5);

    manager.setEnabled(false);
    expect(manager.enabled).toBe(false);
  });

  test('loadSettings error handling', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(function () {});
    const mockGetItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function () {
      throw new Error('access');
    });

    new SoundManager();
    expect(spy).toHaveBeenCalled();
    mockGetItem.mockRestore();
    spy.mockRestore();
  });

  test('saveSettings error handling', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(function () {});
    const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function () {
      throw new Error('quota');
    });

    const manager = new SoundManager();
    manager.saveSettings();
    expect(spy).toHaveBeenCalled();
    mockSetItem.mockRestore();
    spy.mockRestore();
  });

  test('playback functions while enabled', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    expect(() => manager.playMove()).not.toThrow();
    expect(() => manager.playCapture()).not.toThrow();
    expect(() => manager.playCheck()).not.toThrow();
    expect(() => manager.playGameStart()).not.toThrow();
    expect(() => manager.playGameOver(true)).not.toThrow();
    expect(() => manager.playSuccess()).not.toThrow();
    expect(() => manager.playError()).not.toThrow();
  });

  test('playback functions do nothing when disabled', () => {
    const manager = new SoundManager();
    manager.enabled = false;

    // Should return early without creating AudioContext
    manager.playMove();
    manager.playCapture();
    manager.playCheck();
    manager.playGameStart();
    manager.playGameOver(true);
    manager.playSuccess();
    manager.playError();

    // AudioContext should not be initialized
    expect(manager.audioContext).toBeNull();
  });

  test('playGameOver plays defeat sound', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    expect(() => manager.playGameOver(false)).not.toThrow();
  });

  test('toggle toggles enabled state and returns new state', () => {
    const manager = new SoundManager();
    expect(manager.enabled).toBe(true);

    const result1 = manager.toggle();
    expect(result1).toBe(false);
    expect(manager.enabled).toBe(false);

    const result2 = manager.toggle();
    expect(result2).toBe(true);
    expect(manager.enabled).toBe(true);
  });

  test('loadSettings parses saved settings correctly', () => {
    // Pre-set some settings in localStorage
    localStorage.setItem(
      'chess9x9-sound-settings',
      JSON.stringify({
        enabled: false,
        volume: 0.8,
      })
    );

    const manager = new SoundManager();
    // Note: constructor removes settings first, so this tests the code path
    // We need to manually call loadSettings after setting the storage
    localStorage.setItem(
      'chess9x9-sound-settings',
      JSON.stringify({
        enabled: false,
        volume: 0.8,
      })
    );
    manager.loadSettings();

    expect(manager.enabled).toBe(false);
    expect(manager.volume).toBe(0.8);
  });

  test('loadSettings uses defaults for missing properties', () => {
    localStorage.setItem('chess9x9-sound-settings', JSON.stringify({}));

    const manager = new SoundManager();
    manager.loadSettings();

    expect(manager.enabled).toBe(true);
    expect(manager.volume).toBe(0.3);
  });

  test('AudioContext unlock interaction', async () => {
    new SoundManager();
    const event = new Event('pointerdown');
    window.dispatchEvent(event);
    await new Promise(r => setTimeout(r, 0));
  });

  test('init does not recreate AudioContext if already exists', () => {
    const manager = new SoundManager();
    manager.init();
    const ctx1 = manager.audioContext;
    manager.init();
    const ctx2 = manager.audioContext;
    expect(ctx1).toBe(ctx2);
  });
});
