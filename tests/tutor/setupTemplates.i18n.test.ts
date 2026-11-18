// Verifiziert, dass die Setup-Vorlagen aus `HintGenerator` in beiden Sprachen
// englische/deutsche Namen liefern. Die Vorlagen stehen nicht in `data-i18n`-
// Markern, sondern werden zur Laufzeit via `t()` übersetzt — darum prüft sie
// der i18n-Audit nicht ab.
import { describe, expect, test, afterEach } from 'vitest';
import { getSetupTemplates } from '../../js/tutor/HintGenerator.js';
import { setLocale } from '../../js/i18n.js';

const game = { initialPoints: 18 } as never;

afterEach(() => setLocale('de'));

describe('Setup-Vorlagen i18n', () => {
  test('deutsch: deutsche Namen und Beschreibungen', () => {
    setLocale('de');
    const templates = getSetupTemplates(game);
    expect(templates.length).toBeGreaterThan(0);
    // Stichprobe: die 18-Punkte-Vorlagen haben deutsche Namen.
    expect(templates.some(t => t.name.includes('Festung'))).toBe(true);
    expect(templates.some(t => t.description.includes('Kanzler'))).toBe(true);
  });

  test('englisch: englische Namen und Beschreibungen', () => {
    setLocale('en');
    const templates = getSetupTemplates(game);
    const names = templates.map(t => t.name).join(' | ');
    const descriptions = templates.map(t => t.description).join(' | ');
    expect(names).toContain('Fortress');
    expect(names).toContain('Royal Guard');
    expect(descriptions).toContain('Chancellor, queen and pawn for versatility.');
    expect(descriptions).not.toContain('Kanzler');
  });
});
