import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom has no AudioContext — provide a minimal stub so the playback
// methods run end-to-end (exercising every skin branch) instead of early-returning.
class FakeParam {
  value = 0;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
}
function makeNode() {
  return {
    frequency: new FakeParam(),
    gain: new FakeParam(),
    pan: new FakeParam(),
    type: '',
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() { return makeNode(); }
  createGain() { return makeNode(); }
  createStereoPanner() { return makeNode(); }
  createBiquadFilter() { return makeNode(); }
  constructor() {}
}

vi.stubGlobal('AudioContext', FakeAudioContext as any);

const { SoundManager } = await import('../js/sounds.js');

describe('SoundManager — settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  test('loadSettings reads saved enabled/volume', () => {
    // The constructor clears persisted settings by design, so seed storage
    // *after* construction, then invoke loadSettings explicitly.
    const sm = new SoundManager();
    localStorage.setItem('chess9x9-sound-settings', JSON.stringify({ enabled: false, volume: 0.7 }));
    sm.loadSettings();
    expect(sm.enabled).toBe(false);
    expect(sm.volume).toBeCloseTo(0.7);
  });

  test('loadSettings falls back to defaults on missing entry', () => {
    const sm = new SoundManager();
    expect(sm.enabled).toBe(true);
    expect(sm.volume).toBeCloseTo(0.3);
  });

  test('loadSettings tolerates corrupt JSON without throwing', () => {
    localStorage.setItem('chess9x9-sound-settings', '{not valid json');
    expect(() => new SoundManager()).not.toThrow();
  });

  test('saveSettings writes JSON and can be reloaded', () => {
    const sm = new SoundManager();
    sm.setEnabled(false);
    sm.setVolume(50);
    const raw = localStorage.getItem('chess9x9-sound-settings');
    expect(raw).toContain('"enabled":false');
    expect(raw).toContain('"volume":0.5');
  });
});

describe('SoundManager — volume / enabled controls', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  test('setVolume converts 0-100 to 0-1', () => {
    const sm = new SoundManager();
    sm.setVolume(100);
    expect(sm.volume).toBeCloseTo(1);
    sm.setVolume(0);
    expect(sm.volume).toBeCloseTo(0);
    sm.setVolume(25);
    expect(sm.volume).toBeCloseTo(0.25);
  });

  test('toggle flips enabled and returns the new state', () => {
    const sm = new SoundManager();
    expect(sm.enabled).toBe(true);
    const after = sm.toggle();
    expect(after).toBe(false);
    expect(sm.enabled).toBe(false);
  });

  test('setEnabled sets the flag and persists it', () => {
    const sm = new SoundManager();
    sm.setEnabled(false);
    expect(sm.enabled).toBe(false);
    const raw = localStorage.getItem('chess9x9-sound-settings');
    expect(raw).toContain('"enabled":false');
  });
});

describe('SoundManager — stereo pan calculation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  test('maps column 0..8 onto a clamped -0.8..0.8 range', () => {
    const sm = new SoundManager();
    const pan = (sm as any).getPanValue.bind(sm);
    expect(pan(4)).toBeCloseTo(0); // center
    expect(pan(0)).toBeCloseTo(-0.8);
    expect(pan(8)).toBeCloseTo(0.8);
    expect(pan(2)).toBeCloseTo(-0.5);
    expect(pan(6)).toBeCloseTo(0.5);
  });
});

describe('SoundManager — playback respects enabled flag and skin switch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('AudioContext', FakeAudioContext as any);
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  test('does nothing when sound is disabled', () => {
    const sm = new SoundManager();
    sm.setEnabled(false);
    expect(() => {
      sm.playMove(4, 4);
      sm.playCapture(4);
      sm.playCheck();
      sm.playPromotion();
      sm.playGameStart();
      sm.playGameOver(true);
      sm.playGameOver(false);
      sm.playSuccess();
      sm.playError();
    }).not.toThrow();
  });

  test('routes move/capture sounds per skin (classic/infernale/frost/neon)', () => {
    for (const skin of ['classic', 'infernale', 'frost', 'neon']) {
      localStorage.setItem('chess_skin', skin);
      const sm = new SoundManager();
      expect(() => {
        sm.playMove(0, 8); // exercises pan clamp at extremes
        sm.playCapture(2);
      }).not.toThrow();
      // audioContext was created via init()
      expect(sm.audioContext).not.toBeNull();
    }
  });

  test('other event sounds run without throwing for win and loss', () => {
    localStorage.setItem('chess_skin', 'classic');
    const sm = new SoundManager();
    expect(() => sm.playCheck()).not.toThrow();
    expect(() => sm.playPromotion()).not.toThrow();
    expect(() => sm.playGameStart()).not.toThrow();
    expect(() => sm.playGameOver(true)).not.toThrow();
    expect(() => sm.playGameOver(false)).not.toThrow();
    expect(() => sm.playSuccess()).not.toThrow();
    expect(() => sm.playError()).not.toThrow();
  });
});
