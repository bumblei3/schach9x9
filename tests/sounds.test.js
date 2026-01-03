// sounds.test.js
// Tests for the SoundManager class
import { jest } from '@jest/globals';

// Mock Web Audio API before importing SoundManager
global.window = global.window || {};

// Create a mock AudioContext
const mockOscillator = {
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  type: 'sine',
  frequency: {
    setValueAtTime: jest.fn(),
    value: 440,
    exponentialRampToValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
  },
};

const mockGain = {
  connect: jest.fn(),
  gain: {
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
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
    jest.clearAllMocks();
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
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    const mockGetItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access');
    });

    new SoundManager();
    expect(spy).toHaveBeenCalled();
    mockGetItem.mockRestore();
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

  test('AudioContext unlock interaction', async () => {
    new SoundManager();
    const event = new Event('pointerdown');
    window.dispatchEvent(event);
    await new Promise(r => setTimeout(r, 0));
  });
});
