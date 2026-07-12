import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Tests for the Tutorial first-run gating (show once, then persist).
 * @jest-environment jsdom
 */
import { Tutorial } from '../js/tutorial.js';

function mountOverlay(): void {
  document.body.innerHTML = `
    <div id="tutorial-overlay" class="fullscreen-overlay hidden">
      <div class="tutorial-content">
        <div id="tutorial-header">
          <h2 id="tutorial-title"></h2>
          <button id="tutorial-close">×</button>
        </div>
        <div id="tutorial-body">
          <div id="tutorial-steps"></div>
          <div id="tutorial-content"></div>
          <div id="tutorial-demo"></div>
        </div>
        <div id="tutorial-footer">
          <div id="tutorial-step-indicator">
            <span id="tutorial-current-step"></span> / <span id="tutorial-total-steps"></span>
          </div>
          <div id="tutorial-navigation">
            <button id="tutorial-prev">Zurück</button>
            <button id="tutorial-next">Weiter ▶</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

describe('Tutorial - first-run gating', () => {
  beforeEach(() => {
    localStorage.clear();
    mountOverlay();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('shouldAutoShow returns true on a fresh (no storage) run', () => {
    expect(Tutorial.shouldAutoShow()).toBe(true);
  });

  test('shouldAutoShow returns false once the tutorial has been seen', () => {
    Tutorial.markSeen();
    expect(Tutorial.shouldAutoShow()).toBe(false);
  });

  test('markSeen persists the seen flag in localStorage', () => {
    expect(localStorage.getItem('schach9x9_tutorial_seen')).toBeNull();
    Tutorial.markSeen();
    expect(localStorage.getItem('schach9x9_tutorial_seen')).toBe('1');
  });

  test('constructor builds steps on the very first run (overlay shown via show())', () => {
    const t = new Tutorial();
    // Steps are built during construction on first run
    expect(t.steps.length).toBeGreaterThan(0);
    // show() is what makes the overlay visible (called by gameController on first run)
    t.show();
    const overlay = document.getElementById('tutorial-overlay')!;
    expect(overlay.classList.contains('hidden')).toBe(false);
  });

  test('constructor builds UI on subsequent runs but does NOT auto-show', () => {
    Tutorial.markSeen();
    const t = new Tutorial();
    // UI is always built (steps exist) regardless of first-run state
    expect(t.steps.length).toBeGreaterThan(0);
    // but the overlay stays hidden until show() is explicitly called
    const overlay = document.getElementById('tutorial-overlay')!;
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  test('close() marks the tutorial as seen', () => {
    const t = new Tutorial();
    t.close();
    expect(localStorage.getItem('schach9x9_tutorial_seen')).toBe('1');
    const overlay = document.getElementById('tutorial-overlay')!;
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  test('markSeen is resilient to a throwing localStorage', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => Tutorial.markSeen()).not.toThrow();
    spy.mockRestore();
  });
});
