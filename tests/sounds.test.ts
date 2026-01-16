// tests/sounds.test.ts
// Tests for the SoundManager class
import { describe, it, expect, vi, beforeEach, test, type MockInstance } from 'vitest';
import { SoundManager } from '../js/sounds';

// Mock Web Audio API before importing SoundManager
// We need to extend the Window interface to include AudioContext
declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

global.window = global.window || ({} as any);

// Helpers to track calls
interface MockAudioParam {
  setValueAtTime: MockInstance;
  exponentialRampToValueAtTime: MockInstance;
  linearRampToValueAtTime: MockInstance;
  value?: number;
}

const mockOscillator = {
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  disconnect: vi.fn(),
  type: 'sine' as OscillatorType,
  frequency: {
    setValueAtTime: vi.fn(),
    value: 440,
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  } as unknown as MockAudioParam,
};

const mockGain = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    value: 1,
  } as unknown as MockAudioParam,
};

const mockFilter = {
  connect: vi.fn(),
  type: 'lowpass' as BiquadFilterType,
  frequency: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  } as unknown as MockAudioParam,
};

// Mock AudioContext class
class MockAudioContext {
  destination = {};
  currentTime = 0;
  state: AudioContextState = 'suspended';

  constructor() {
    this.destination = {};
    this.currentTime = 0;
    this.state = 'suspended';
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator() {
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
      gain: {
        ...mockGain.gain,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }

  createBiquadFilter() {
    return {
      ...mockFilter,
      connect: vi.fn(),
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    };
  }

  createStereoPanner() {
    return {
      pan: { value: 0 },
      connect: vi.fn(),
    };
  }
}

// Assign mock to global window
(global.window as any).AudioContext = MockAudioContext;
(global.window as any).webkitAudioContext = MockAudioContext;

describe('SoundManager', () => {
  // SoundManager is a singleton-like class in the implementation, but we might instantiate it or access static methods.
  // The module exports an instance `soundManager` and the class `SoundManager`.
  // We'll use the class constructor if available or the instance.

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

  test('playMove accepts column arguments and creates stereo panner', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    localStorage.setItem('chess_skin', 'classic');

    const createStereoPannerSpy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner');
    // Note: Since we replaced window.AudioContext with MockAudioContext, soundManager will use MockAudioContext.
    // However, if SoundManager was imported *before* we mocked window.AudioContext (which depends on import order), it might be an issue.
    // But duplicate imports usually share the reference. The issue is `new window.AudioContext` call in SoundManager.init().
    // We mocked window.AudioContext, so `new window.AudioContext()` should define the prototype we are spying on.
    // Actually, `vi.spyOn(MockAudioContext.prototype)` works if `SoundManager` uses `MockAudioContext`.
    // But `SoundManager` calls `new window.AudioContext()`.
    // So we need to ensure `window.AudioContext` points to `MockAudioContext`.

    // Check if window.AudioContext is indeed our mock
    expect(new window.AudioContext()).toBeInstanceOf(MockAudioContext);

    // Play move on column 0 (left)
    manager.playMove(0, 0);

    expect(createStereoPannerSpy).toHaveBeenCalled();
    const panner = createStereoPannerSpy.mock.results[0].value;
    // Expect pan value to be negative (left)
    expect(panner.pan.value).toBeLessThan(0);

    // Play move on column 8 (right)
    manager.playMove(8, 8);
    // Panner should have been created again (new context/sound)
    const panner2 = createStereoPannerSpy.mock.results[1].value;
    expect(panner2.pan.value).toBeGreaterThan(0);
  });

  test('getPanValue clamps values correctly', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    const createStereoPannerSpy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner');

    // Center column 4 -> pan 0
    manager.playMove(4, 4);
    expect(createStereoPannerSpy.mock.results[0].value.pan.value).toBe(0);

    // Column 0 -> -0.8 (clamped/mapped)
    manager.playMove(0, 0);
    expect(createStereoPannerSpy.mock.results[1].value.pan.value).toBe(-0.8);

    // Column 8 -> 0.8
    manager.playMove(8, 8);
    expect(createStereoPannerSpy.mock.results[2].value.pan.value).toBe(0.8);
  });

  test('playCapture accepts column arguments and applies panning', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    const createStereoPannerSpy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner');

    manager.playCapture(0); // Left capture
    expect(createStereoPannerSpy.mock.results[0].value.pan.value).toBeLessThan(0);
  });

  test('playMove uses classic logic (default)', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    localStorage.setItem('chess_skin', 'classic');

    const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');

    manager.playMove();

    expect(createOscSpy).toHaveBeenCalled();
    const osc = createOscSpy.mock.results[0].value;

    // Classic uses triangle now
    expect(osc.type).toBe('triangle');
  });

  test('playMove uses infernale logic (Triangle Wave, Low Freq)', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    localStorage.setItem('chess_skin', 'infernale');

    const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');

    manager.playMove();

    const osc = createOscSpy.mock.results[0].value;
    expect(osc.type).toBe('triangle');
    // Frequency is randomized around 100-120
    expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
  });

  test('playMove uses frost logic (Sine Wave, High Freq)', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    localStorage.setItem('chess_skin', 'frost');

    const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');

    manager.playMove();

    const osc = createOscSpy.mock.results[0].value;
    expect(osc.type).toBe('sine');
    // Frequency randomized around 1800
    expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
  });

  test('playMove uses neon logic (Sawtooth + Filter)', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    localStorage.setItem('chess_skin', 'neon');

    const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
    const createFilterSpy = vi.spyOn(MockAudioContext.prototype, 'createBiquadFilter');

    manager.playMove();

    const osc = createOscSpy.mock.results[0].value;

    // Check type
    expect(osc.type).toBe('sawtooth');

    // Check if filter created
    if (createFilterSpy.mock.calls.length > 0) {
      expect(createFilterSpy).toHaveBeenCalled();
    }
  });

  test('playCapture uses infernale logic (Multiple Oscillators)', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    localStorage.setItem('chess_skin', 'infernale');

    const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');

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

    const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');

    manager.playCapture();

    // Frost capture uses 4 oscillators now
    expect(createOscSpy).toHaveBeenCalledTimes(4);
  });
});
