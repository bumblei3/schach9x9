// Das Tutorial wird zur Laufzeit per `t()` übersetzt, steht aber nicht in
// `data-i18n`-Markern — darum prüft es der i18n-Audit strukturell nicht ab.
// Der Auto-Start lässt sich im CDP-Browser nicht auslösen (`navigator.webdriver`),
// also absichert ein Test beide Sprachen.
import { describe, expect, test, afterEach } from 'vitest';
import { Tutorial } from '../../js/tutorial.js';
import { setLocale } from '../../js/i18n.js';

afterEach(() => setLocale('de'));

/** Das Tutorial baut sein Overlay selbst; für die Methoden-Aufrufe genügt das Markup. */
function mountTutorialDom(): void {
  document.body.innerHTML = `
    <div id="tutorial-overlay">
      <div id="tutorial-content">
        <div id="tutorial-steps"></div>
        <div id="tutorial-footer">
          <button id="tutorial-prev"></button>
          <button id="tutorial-next"></button>
          <button id="tutorial-close"></button>
        </div>
      </div>
      <span id="tutorial-current-step">1</span>
      <span id="tutorial-total-steps">1</span>
    </div>`;
  expect(document.getElementById('tutorial-steps')).not.toBeNull();
}

describe('Tutorial-Prosa i18n', () => {
  test('Quick-Start: deutsche Titel und Inhalte', () => {
    mountTutorialDom();
    setLocale('de');
    const steps = new Tutorial({ mode: 'quick' }).createQuickStartSteps();
    expect(steps.length).toBe(4);
    expect(steps[0].title).toContain('Willkommen');
    expect(steps[0].content).toContain('Erzbischof');
    expect(steps[2].content).toContain('Startaufstellung');
  });

  test('Quick-Start: englische Titel und Inhalte', () => {
    mountTutorialDom();
    setLocale('en');
    const steps = new Tutorial({ mode: 'quick' }).createQuickStartSteps();
    expect(steps[0].title).toContain('Welcome');
    expect(steps[0].content).toContain('Bishop + Knight');
    expect(steps[0].content).toContain('Archbishop');
    expect(steps[2].content).toContain('starting setup');
    expect(steps[2].content).not.toContain('Startaufstellung');
  });

  test('Tour: deutsche und englische Titel', () => {
    mountTutorialDom();
    setLocale('de');
    const de = new Tutorial({ mode: 'full' }).createSteps();
    expect(de[0].title).toContain('Willkommen zu Schach 9x9');
    setLocale('en');
    const en = new Tutorial({ mode: 'full' }).createSteps();
    expect(en[0].title).toContain('Welcome to 9x9 Chess');
    expect(en.map(s => s.title).join('|')).toContain('The Nightrider');
  });
});
