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
  type: 'sine', // Added type property
  frequency: { setValueAtTime: jest.fn() },
};

const mockGain = {
  connect: jest.fn(),
  gain: {
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
};

global.window.AudioContext = class MockAudioContext {
  constructor() {
    this.destination = {};
    this.currentTime = 0;
  }
  createOscillator() {
    return {
      ...mockOscillator,
      frequency: {
        value: 440,
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
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

  test('initial settings are loaded from localStorage or defaults', () => {
    const manager = new SoundManager();
    expect(manager.enabled).toBe(true);
    expect(manager.volume).toBeCloseTo(0.3);
  });

  test('setVolume converts 0‑100 range to 0‑1 internally', () => {
    const manager = new SoundManager();
    manager.setVolume(75);
    expect(manager.volume).toBeCloseTo(0.75);
  });

  test('toggle flips the enabled flag and persists it', () => {
    const manager = new SoundManager();
    const initial = manager.enabled;
    manager.toggle();
    expect(manager.enabled).toBe(!initial);
    const saved = JSON.parse(localStorage.getItem('chess9x9-sound-settings'));
    expect(saved.enabled).toBe(!initial);
  });

  test('playMove does not throw when disabled', () => {
    const manager = new SoundManager();
    manager.enabled = false;
    expect(() => manager.playMove()).not.toThrow();
  });

  test('should play capture sound when enabled', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    expect(() => manager.playCapture()).not.toThrow();
  });

  test('should play check sound when enabled', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    expect(() => manager.playCheck()).not.toThrow();
  });

  test('should play game start sound when enabled', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    expect(() => manager.playGameStart()).not.toThrow();
  });

  test('should play game over sound when enabled', () => {
    const manager = new SoundManager();
    manager.enabled = true;
    expect(() => manager.playGameOver(true)).not.toThrow();
  });
});
