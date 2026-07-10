import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Effects from '../js/effects.js';

describe('Effects System (branch coverage additions)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="board-container"></div><div id="board-wrapper"></div>';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (global.navigator as any).vibrate = undefined;
  });

  test('spawn MOVE type creates 8 particles', () => {
    const ps = new Effects.ParticleSystem();
    ps.spawn(10, 10, 'MOVE');
    expect(ps.particles.length).toBe(8);
  });

  test('spawn TRAIL type creates 1 particle with trail styling', () => {
    const ps = new Effects.ParticleSystem();
    ps.spawn(10, 10, 'TRAIL', '#0f0');
    expect(ps.particles.length).toBe(1);
    const p = document.querySelector('.particle') as HTMLElement;
    expect(p.style.width).toBe('4px');
    expect(p.style.borderRadius).toBe('50%');
    expect(p.style.opacity).toBe('0.6');
  });

  test('spawn default type creates 15 particles with 3px size', () => {
    const ps = new Effects.ParticleSystem();
    ps.spawn(10, 10, 'unknown');
    expect(ps.particles.length).toBe(15);
    const p = document.querySelector('.particle') as HTMLElement;
    expect(p.style.width).toBe('3px');
  });

  test('spawn CAPTURE sets randomized width + boxShadow', () => {
    const ps = new Effects.ParticleSystem();
    ps.spawn(10, 10, 'CAPTURE', '#abc');
    const p = document.querySelector('.particle') as HTMLElement;
    expect(p.style.boxShadow).toContain('#abc');
  });

  test('spawn uses document.body when board-container is missing', () => {
    document.body.innerHTML = '';
    const ps = new Effects.ParticleSystem();
    expect(ps.container).toBe(document.body);
    ps.spawn(5, 5, 'MOVE');
    expect(ps.particles.length).toBe(8);
  });

  test('update early-returns and stops when no particles', () => {
    const ps = new Effects.ParticleSystem();
    expect(ps.animating).toBe(false);
    ps.update(); // no particles -> animating stays false, no rAF loop
    expect(ps.animating).toBe(false);
  });

  test('spawnTrail adds a TRAIL particle and triggers animation', () => {
    const ps = new Effects.ParticleSystem();
    ps.spawnTrail(20, 20, '#fff');
    expect(ps.particles.length).toBe(1);
    expect(ps.particles[0].type).toBe('TRAIL');
    expect(ps.animating).toBe(true);
    const p = document.querySelector('.particle') as HTMLElement;
    expect(p.style.boxShadow).toContain('#fff');
  });

  test('triggerVibration returns early when navigator.vibrate is unavailable', () => {
    (global.navigator as any).vibrate = undefined;
    // should not throw
    expect(() => Effects.triggerVibration('heavy')).not.toThrow();
  });

  test('triggerVibration default type is light', () => {
    (global.navigator as any).vibrate = vi.fn();
    Effects.triggerVibration();
    expect((global.navigator as any).vibrate).toHaveBeenCalledWith(20);
  });

  test('shakeScreen falls back to document.body when board-wrapper missing', () => {
    document.body.innerHTML = '';
    Effects.shakeScreen(5, 50);
    expect(document.body.style.transition).toBe('none');
    vi.advanceTimersByTime(100);
    // animating loop ran and reset transition
    expect(document.body.style.transition).toBe('');
  });

  test('shakeScreen resets transform and transition after duration', () => {
    const wrapper = document.getElementById('board-wrapper')!;
    Effects.shakeScreen(10, 50);
    expect(wrapper.style.transition).toBe('none');
    vi.advanceTimersByTime(100);
    expect(wrapper.style.transform).toBe('');
  });

  test('ConfettiSystem spawn positions particles at container center', () => {
    const cs = new Effects.ConfettiSystem();
    // spawn() sets container to #board-container (or document.body if absent)
    cs.spawn();
    expect(cs.particles.length).toBe(150);
    // particles are positioned at the center of the container rect
    const board = document.getElementById('board-container')!;
    const rect = board.getBoundingClientRect();
    const first = cs.particles[0];
    expect(first.x).toBe(rect.width / 2);
    expect(first.y).toBe(rect.height / 2);
  });

  test('ConfettiSystem spawn falls back to document.body when board-container is missing', () => {
    document.body.innerHTML = '';
    const cs = new Effects.ConfettiSystem();
    cs.spawn();
    expect(cs.particles.length).toBe(150);
    expect(cs.container).toBe(document.body);
  });

  // NOTE: the `window.innerWidth || 800` fallback inside ConfettiSystem.spawn()
  // only triggers when getBoundingClientRect is unavailable AND #board-container
  // is missing. In jsdom `document.body` always provides getBoundingClientRect,
  // so that defensive branch is effectively dead in test/browser environments.

  test('ConfettiSystem update early-returns when no particles', () => {
    const cs = new Effects.ConfettiSystem();
    expect(cs.animating).toBe(false);
    cs.update();
    expect(cs.animating).toBe(false);
  });

  test('FloatingTextManager show supports custom type class', () => {
    const ftm = new Effects.FloatingTextManager();
    ftm.show(1, 1, 'Combo!', 'combo');
    const el = document.querySelector('.floating-text.combo') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('Combo!');
  });

  test('FloatingTextManager uses document.body when board-container missing', () => {
    document.body.innerHTML = '';
    const ftm = new Effects.FloatingTextManager();
    expect(ftm.container).toBe(document.body);
    ftm.show(1, 1, 'x');
    expect(document.querySelector('.floating-text')).not.toBeNull();
  });
});
