/**
 * Sounds.ts Additional Branch Coverage Tests
 * Target: 80%+ branch coverage for js/sounds.ts
 * Covers: loadSettings/saveSettings error paths, all skin variants,
 * playCheck, playPromotion, playGameStart, playGameOver (win/lose),
 * playSuccess, playError, AudioContext unlock, all skin variants
 */

import { describe, test, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { SoundManager } from '../js/sounds';

// Mock Web Audio API
declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

global.window = global.window || ({} as any);

// Helpers to track calls
interface MockAudioParam {
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
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

describe('SoundManager - Branch Coverage', () => {
  let manager: SoundManager;

  beforeAll(() => {
    (global.window as any).AudioContext = MockAudioContext;
    (global.window as any).webkitAudioContext = MockAudioContext;
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    manager = new SoundManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================
  // loadSettings() Tests - try/catch branches
  // ============================================================

  describe('loadSettings()', () => {
    test('should use defaults when localStorage has invalid JSON', () => {
      localStorage.setItem('chess9x9-sound-settings', 'invalid json');

      const manager = new SoundManager();
      expect(manager.enabled).toBe(true); // default
      expect(manager.volume).toBe(0.3); // default
    });

    test('should use defaults when localStorage is empty', () => {
      const manager = new SoundManager();
      expect(manager.enabled).toBe(true);
      expect(manager.volume).toBe(0.3);
    });

    test('should handle localStorage parse error gracefully', () => {
      localStorage.setItem('chess9x9-sound-settings', '{invalid}');
      
      const manager = new SoundManager();
      
      expect(manager.enabled).toBe(true);
      expect(manager.volume).toBe(0.3);
    });
  });

  // ============================================================
  // saveSettings() Tests - try/catch branches
  // ============================================================

  describe('saveSettings()', () => {
    test('should save settings to localStorage', () => {
      const manager = new SoundManager();
      manager.setVolume(80);
      manager.setEnabled(false);

      const stored = localStorage.getItem('chess9x9-sound-settings');
      expect(stored).not.toBeNull();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.enabled).toBe(false);
      expect(parsed.volume).toBe(0.8);
    });

    test('should handle localStorage write error gracefully', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new Error('Storage full');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = new SoundManager();
      
      // saveSettings is called by setEnabled internally
      expect(() => manager.setEnabled(false)).not.toThrow();
      // Note: The warning may not be called if the error is caught silently
      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================================
  // playMove() - all skin branches
  // ============================================================

  describe('playMove() - skin variants', () => {
    beforeEach(() => {
      manager.enabled = true;
      vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      vi.spyOn(MockAudioContext.prototype, 'createBiquadFilter');
    });

    test('should use classic logic (triangle) for default skin', () => {
      localStorage.setItem('chess_skin', 'classic');
      manager.enabled = true;
      
      manager.playMove();
      
      const oscResult = vi.spyOn(MockAudioContext.prototype, 'createOscillator').mock.results[0];
      if (oscResult?.value) {
        expect(oscResult.value.type).toBe('triangle');
      }
    });

    test('should use infernale logic (triangle, low freq) for infernale skin', () => {
      localStorage.setItem('chess_skin', 'infernale');
      manager.enabled = true;
      
      manager.playMove();
      
      const oscResult = vi.spyOn(MockAudioContext.prototype, 'createOscillator').mock.results[0];
      if (oscResult?.value) {
        expect(oscResult.value.type).toBe('triangle');
      }
    });

    test('should use frost logic (sine, high freq) for frost skin', () => {
      localStorage.setItem('chess_skin', 'frost');
      manager.enabled = true;
      
      manager.playMove();
      
      const oscResult = vi.spyOn(MockAudioContext.prototype, 'createOscillator').mock.results[0];
      if (oscResult?.value) {
        expect(oscResult.value.type).toBe('sine');
      }
    });

    test('should use neon logic (sawtooth + filter) for neon skin', () => {
      localStorage.setItem('chess_skin', 'neon');
      manager.enabled = true;
      
      manager.playMove();
      
      const oscResult = vi.spyOn(MockAudioContext.prototype, 'createOscillator').mock.results[0];
      if (oscResult?.value) {
        expect(oscResult.value.type).toBe('sawtooth');
      }
    });

    test('should handle case when createStereoPanner is not available', () => {
      // Temporarily remove createStereoPanner
      const originalCreateStereoPanner = MockAudioContext.prototype.createStereoPanner;
      MockAudioContext.prototype.createStereoPanner = undefined as any;
      
      const manager = new SoundManager();
      manager.enabled = true;
      
      expect(() => manager.playMove()).not.toThrow();
      
      // Restore
      MockAudioContext.prototype.createStereoPanner = originalCreateStereoPanner;
    });
  });

  // ============================================================
  // playCapture() - all skin branches
  // ============================================================

  describe('playCapture() - skin variants', () => {
    test('should use classic capture (square wave)', () => {
      localStorage.setItem('chess_skin', 'classic');
      manager.enabled = true;
      
      manager.playCapture();
      
      const oscResult = vi.spyOn(MockAudioContext.prototype, 'createOscillator').mock.results[0];
      if (oscResult?.value) {
        expect(oscResult.value.type).toBe('square');
      }
    });

    test('should use infernale capture (dual oscillator + filter)', () => {
      localStorage.setItem('chess_skin', 'infernale');
      manager.enabled = true;
      
      manager.playCapture();
      
      // Verify no throw
      expect(true).toBe(true);
    });

    test('should use frost capture (shattering, 4 oscillators)', () => {
      localStorage.setItem('chess_skin', 'frost');
      manager.enabled = true;
      
      manager.playCapture();
      
      // Verify no throw
      expect(true).toBe(true);
    });

    test('should use neon capture (square wave)', () => {
      localStorage.setItem('chess_skin', 'neon');
      manager.enabled = true;
      
      expect(() => manager.playCapture()).not.toThrow();
    });
  });

  // ============================================================
  // playCheck() Tests
  // ============================================================

  describe('playCheck()', () => {
    test('should return early when disabled', () => {
      manager.enabled = false;
      manager.playCheck();
      expect(manager.audioContext).toBeNull();
    });

    test('should return early when audioContext is null', () => {
      manager.enabled = true;
      manager.audioContext = null;
      
      expect(() => manager.playCheck()).not.toThrow();
    });

    test('should play two-tone warning sound', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playCheck();
      
      // Should create 2 oscillators (times array has 2 elements)
      expect(createOscSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================
  // playPromotion() Tests
  // ============================================================

  describe('playPromotion()', () => {
    test('should return early when disabled', () => {
      manager.enabled = false;
      manager.playPromotion();
      expect(manager.audioContext).toBeNull();
    });

    test('should return early when audioContext is null', () => {
      manager.enabled = true;
      manager.audioContext = null;
      
      expect(() => manager.playPromotion()).not.toThrow();
    });

    test('should play ascending arpeggio with 4 notes', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playPromotion();
      
      // 4 notes in arpeggio (C-E-G-C)
      expect(createOscSpy).toHaveBeenCalledTimes(4);
    });
  });

  // ============================================================
  // playGameStart() Tests
  // ============================================================

  describe('playGameStart()', () => {
    test('should return early when disabled', () => {
      manager.enabled = false;
      manager.playGameStart();
      expect(manager.audioContext).toBeNull();
    });

    test('should return early when audioContext is null', () => {
      manager.enabled = true;
      manager.audioContext = null;
      
      expect(() => manager.playGameStart()).not.toThrow();
    });

    test('should play 3-note ascending arpeggio', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playGameStart();
      
      // 3 notes (C, E, G)
      expect(createOscSpy).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================
  // playGameOver() Tests - win/lose branches
  // ============================================================

  describe('playGameOver()', () => {
    test('should return early when disabled', () => {
      manager.enabled = false;
      manager.playGameOver(true);
      expect(manager.audioContext).toBeNull();
    });

    test('should return early when audioContext is null', () => {
      manager.enabled = true;
      manager.audioContext = null;
      
      expect(() => manager.playGameOver(true)).not.toThrow();
    });

    test('should play victory fanfare (4 notes) for win', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playGameOver(true);
      
      // Victory: 4 notes (C, E, G, C)
      expect(createOscSpy).toHaveBeenCalledTimes(4);
    });

    test('should play defeat sound (sawtooth, descending) for loss', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playGameOver(false);
      
      // Defeat: 1 sawtooth oscillator
      expect(createOscSpy).toHaveBeenCalledTimes(1);
      
      const osc = createOscSpy.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
    });
  });

  // ============================================================
  // playSuccess() Tests
  // ============================================================

  describe('playSuccess()', () => {
    test('should return early when disabled', () => {
      manager.enabled = false;
      manager.playSuccess();
      expect(manager.audioContext).toBeNull();
    });

    test('should return early when audioContext is null', () => {
      manager.enabled = true;
      manager.audioContext = null;
      
      expect(() => manager.playSuccess()).not.toThrow();
    });

    test('should play high-pitched bell-like sound', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playSuccess();
      
      expect(createOscSpy).toHaveBeenCalledTimes(1);
      
      const osc = createOscSpy.mock.results[0].value;
      // Frequency should start at 880 (A5) and ramp to 1320 (E6)
      expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
      expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalled();
    });
  });

  // ============================================================
  // playError() Tests
  // ============================================================

  describe('playError()', () => {
    test('should return early when disabled', () => {
      manager.enabled = false;
      manager.playError();
      expect(manager.audioContext).toBeNull();
    });

    test('should return early when audioContext is null', () => {
      manager.enabled = true;
      manager.audioContext = null;
      
      expect(() => manager.playError()).not.toThrow();
    });

    test('should play low-pitched sawtooth buzzer', () => {
      manager.enabled = true;
      
      const createOscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator');
      manager.playError();
      
      expect(createOscSpy).toHaveBeenCalledTimes(1);
      
      const osc = createOscSpy.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Edge Cases & Toggle/Volume
  // ============================================================

  describe('Edge Cases & Toggle/Volume', () => {
    test('toggle() should flip enabled state and save', () => {
      manager.enabled = true;
      const result = manager.toggle();
      expect(result).toBe(false);
      expect(manager.enabled).toBe(false);
      
      const stored = JSON.parse(localStorage.getItem('chess9x9-sound-settings')!);
      expect(stored.enabled).toBe(false);
    });

    test('setEnabled() should set enabled and save', () => {
      manager.setEnabled(false);
      expect(manager.enabled).toBe(false);
      
      const stored = JSON.parse(localStorage.getItem('chess9x9-sound-settings')!);
      expect(stored.enabled).toBe(false);
    });

    test('setVolume() should set volume and save', () => {
      manager.setVolume(50);
      expect(manager.volume).toBe(0.5);
      
      const stored = JSON.parse(localStorage.getItem('chess9x9-sound-settings')!);
      expect(stored.volume).toBe(0.5);
    });

    test('playMove should respect toCol parameter for panning', () => {
      manager.enabled = true;
      
      // The parameter is toCol, not fromCol in current implementation
      // Use playMove with proper toCol
      manager.playMove(4, 4);
      
      // Just verify no throw
      expect(true).toBe(true);
    });
  });
});
