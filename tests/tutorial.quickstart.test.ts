import { describe, test, expect, beforeEach, afterEach } from 'vitest';
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
        </div>
        <div id="tutorial-footer">
          <span id="tutorial-current-step"></span>
          <span id="tutorial-total-steps"></span>
          <button id="tutorial-prev">Zurück</button>
          <button id="tutorial-next">Weiter ▶</button>
        </div>
      </div>
    </div>
  `;
}

describe('Tutorial quick-start (Phase A)', () => {
  beforeEach(() => {
    localStorage.clear();
    mountOverlay();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('quick mode has exactly 3 steps covering pieces, setup, shop', () => {
    const t = new Tutorial({ mode: 'quick' });
    expect(t.steps).toHaveLength(3);
    const blob = t.steps.map(s => s.title + s.content).join(' ');
    expect(blob).toMatch(/Erzbischof|Feenfiguren/i);
    expect(blob).toMatch(/König|Setup/i);
    expect(blob).toMatch(/Shop|Upgrade/i);
  });

  test('full mode still includes fairy demos', () => {
    const t = new Tutorial({ mode: 'full' });
    expect(t.steps.length).toBeGreaterThan(3);
    expect(t.steps.some(s => /Erzbischof/i.test(s.title))).toBe(true);
    expect(t.steps.some(s => /Setup|König/i.test(s.title))).toBe(true);
  });

  test('shouldAutoShow is false when navigator.webdriver is true', () => {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => true });
    try {
      expect(Tutorial.isAutomatedBrowser()).toBe(true);
      expect(Tutorial.shouldAutoShow()).toBe(false);
    } finally {
      if (desc) Object.defineProperty(Navigator.prototype, 'webdriver', desc);
      else delete (navigator as { webdriver?: boolean }).webdriver;
    }
  });
});
