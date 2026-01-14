// sounds.test.js
// Tests for the SoundManager class

// Mock Web Audio API before importing SoundManager
global.window = global.window || {};

// Helpers to track calls
const mockOscillator = {
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  disconnect: vi.fn(),
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

const mockFilter = {
  connect: vi.fn(),
  type: 'lowpass',
  frequency: {
    setValueAtTime: vi.fn(),
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
    // Return a fresh mock object each time to track individual calls
    return {
      ...mockOscillator,
      frequency: {
        ...mockOscillator.frequency,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  createGain() {
    return {
      ...mockGain,
      gain: { ...mockGain.gain, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  createBiquadFilter() {
    return {
      ...mockFilter,
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
    };
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
    expect(manager.audioContext).toBeNull();
  });

  describe('Skin-Specific Audio', () => {
    test('playMove uses classic logic (default)', () => {
      const manager = new SoundManager();
      manager.enabled = true;
      localStorage.setItem('chess_skin', 'classic');

      // Spy on AudioContext creation
      const createOscSpy = vi.spyOn(window.AudioContext.prototype, 'createOscillator');

      manager.playMove();

      expect(createOscSpy).toHaveBeenCalled();
      const osc = createOscSpy.mock.results[0].value;

      // Classic uses default sine, starting at 800Hz
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(800, expect.any(Number));
    });

    test('playMove uses infernale logic (Triangle Wave, Low Freq)', () => {
      const manager = new SoundManager();
      manager.enabled = true;
      localStorage.setItem('chess_skin', 'infernale');

      const createOscSpy = vi.spyOn(window.AudioContext.prototype, 'createOscillator');

      manager.playMove();

      const osc = createOscSpy.mock.results[0].value;
      expect(osc.type).toBe('triangle');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(120, expect.any(Number));
    });

    test('playMove uses frost logic (Sine Wave, High Freq)', () => {
      const manager = new SoundManager();
      manager.enabled = true;
      localStorage.setItem('chess_skin', 'frost');

      const createOscSpy = vi.spyOn(window.AudioContext.prototype, 'createOscillator');

      manager.playMove();

      const osc = createOscSpy.mock.results[0].value;
      expect(osc.type).toBe('sine');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(1800, expect.any(Number));
    });

    test('playMove uses neon logic (Sawtooth + Filter)', () => {
      const manager = new SoundManager();
      manager.enabled = true;
      localStorage.setItem('chess_skin', 'neon');

      const createOscSpy = vi.spyOn(window.AudioContext.prototype, 'createOscillator');
      const createFilterSpy = vi.spyOn(window.AudioContext.prototype, 'createBiquadFilter');

      manager.playMove();

      const osc = createOscSpy.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
      expect(createFilterSpy).toHaveBeenCalled(); // Neon uses a filter
    });

    test('playCapture uses infernale logic (Multiple Oscillators)', () => {
      const manager = new SoundManager();
      manager.enabled = true;
      localStorage.setItem('chess_skin', 'infernale');

      const createOscSpy = vi.spyOn(window.AudioContext.prototype, 'createOscillator');

      manager.playCapture();

      // Infernale capture uses 2 oscillators
      expect(createOscSpy).toHaveBeenCalledTimes(2);
      const osc1 = createOscSpy.mock.results[0].value;
      const osc2 = createOscSpy.mock.results[1].value;

      expect(osc1.type).toBe('sawtooth');
      expect(osc2.type).toBe('square');
    });

    test('playCapture uses frost logic (Shattering, Multiple High Freq)', () => {
      const manager = new SoundManager();
      manager.enabled = true;
      localStorage.setItem('chess_skin', 'frost');

      const createOscSpy = vi.spyOn(window.AudioContext.prototype, 'createOscillator');

      manager.playCapture();

      // Frost capture uses 3 oscillators for shattering effect
      expect(createOscSpy).toHaveBeenCalledTimes(3);
      // const osc = createOscSpy.mock.results[0].value;
      // Frequency should be around 2000+
      // Since it's randomized, we just check call existence, or range if possible.
      // But simply checking call count is good enough to prove specific path was taken.
    });
  });
});
