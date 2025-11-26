// sounds.test.js
// Tests for the SoundManager class

describe('SoundManager', () => {
  let SoundManager;

  beforeAll(async () => {
    // Dynamically import the module after it has been exported
    const mod = await import('./sounds.js');
    SoundManager = mod.SoundManager;
  });

  test('initial settings are loaded from localStorage or defaults', () => {
    // Ensure defaults when nothing is stored
    localStorage.clear();
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
    // Verify that the value was saved to localStorage
    const saved = JSON.parse(localStorage.getItem('chess9x9-sound-settings'));
    expect(saved.enabled).toBe(!initial);
  });

  test('playMove does not throw when disabled', () => {
    const manager = new SoundManager();
    manager.enabled = false;
    expect(() => manager.playMove()).not.toThrow();
  });
});
