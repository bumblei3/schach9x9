
import * as Effects from '../js/effects.js';

describe('Effects System', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="board-container"></div><div id="board-wrapper"></div>';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('ParticleSystem spawn and update', () => {
    const ps = new Effects.ParticleSystem();
    ps.spawn(100, 100, 'CAPTURE', '#ff0000');
    expect(ps.particles.length).toBe(25);

    // Simulate animation frame
    ps.update();
    expect(ps.animating).toBe(true);

    // Fade out particles
    for (let i = 0; i < 100; i++) {
      ps.update();
    }
    expect(ps.particles.length).toBe(0);
    expect(ps.animating).toBe(false);
  });

  test('FloatingTextManager show', () => {
    const ftm = new Effects.FloatingTextManager();
    ftm.show(50, 50, '+10', 'score');
    const el = document.querySelector('.floating-text');
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('+10');

    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.floating-text')).toBeNull();
  });

  test('ConfettiSystem spawn and update', () => {
    const cs = new Effects.ConfettiSystem();
    // Initialize container manually for test since it's lazy-loaded
    cs.container = document.createElement('div');
    cs.container.getBoundingClientRect = () => ({ width: 1000, height: 1000 });

    cs.spawn();
    expect(cs.particles.length).toBe(150);

    cs.update();
    expect(cs.animating).toBe(true);

    // Fade out
    for (let i = 0; i < 200; i++) {
      cs.update();
    }
    expect(cs.particles.length).toBe(0);
  });

  test('triggerVibration', () => {
    global.navigator.vibrate = vi.fn();
    Effects.triggerVibration('heavy');
    expect(global.navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);

    Effects.triggerVibration('medium');
    expect(global.navigator.vibrate).toHaveBeenCalledWith(50);

    Effects.triggerVibration('light');
    expect(global.navigator.vibrate).toHaveBeenCalledWith(20);
  });

  test('shakeScreen', () => {
    Effects.shakeScreen(10, 100);
    // Request animation frame is called
    expect(document.getElementById('board-wrapper').style.transition).toBe('none');

    vi.advanceTimersByTime(200);
    // It should reset
  });
});
