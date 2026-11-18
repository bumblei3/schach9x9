/**
 * i18n-Marker-Audit.
 *
 * Die Prüfung lief beim i18n-Piloten von Hand in einem Wegwerf-Skript — und
 * fand dabei zwei Fehler, die längst ausgeliefert waren: `data-i18n="classic"`
 * stand sowohl an der Standard-8×8-Kartenbeschreibung („Klassisches Schach mit
 * Rochade und En passant…“) als auch an der Zeitsteuerung „Klassisch 30“, und
 * `applyI18n` ersetzt den Text durch „Klassisch“. Nur ein Test, der die
 * *deutsche* Karte prüft, hat den ersten gesehen (`e2e/standard8x8.spec.ts`).
 *
 * Die Semantik hier ist exakt die von `translateElement` (js/i18n.ts):
 *   - ohne Kind-Elemente  → `textContent` muss dem deutschen Eintrag gleichen
 *   - mit Kind-Elementen   → der erste nicht-leere Textknoten muss es tun
 * Ein grober „Gesamttext des Elements“-Vergleich würde Container wie
 * `Eröffnung: …` oder `⚙️ Einstellungen` fälschlich melden.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { de, en } from '../js/i18n.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/**
 * Schlüssel, die zur Laufzeit per `t('…')` genutzt werden. Die Schale markiert
 * nur `index.html`; dynamische Texte (Statuspille, Game-over-Overlay, Modals)
 * liegen in `js/` und müssen gleich mit auditiert werden, sonst gelten sie als
 * „toter Wörterbuch-Eintrag".
 */
function keysUsedInJs(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        walk(p);
      } else if (p.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        // `[a-zA-Z0-9._-]` statt `[a-zA-Z0-9.]`: Schlüssel wie
        // `achievement.first_win.name` enthalten Unterstriche und wären sonst
        // still nicht als genutzt gelten — der Audit hätte sie als „tot"
        // gemeldet und die Übersetzung faktisch unsichtbar abgeschaltet.
        for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9._-]+)['"]/g)) found.add(m[1]);
        // Schlüssel in Zuordnungstabellen (z. B. `LEVEL_I18N_KEYS` in
        // `campaignData.ts`) stehen nicht in einem `t()`-Aufruf. Gezählt wird
        // nur, was tatsächlich ein Wörterbuch-Key ist — ein toter Eintrag
        // fiele damit weiterhin auf.
        for (const m of src.matchAll(/['"]([a-z][a-z0-9]*(?:\.[a-zA-Z0-9_-]+)+)['"]/g)) {
          if (m[1] in de) found.add(m[1]);
        }
      }
    }
  };
  walk(resolve(process.cwd(), 'js'));
  return found;
}

/** Erster nicht-leere direkte Textknoten — das ist es, was translateElement ersetzt. */
function firstMeaningfulTextNode(el: Element): string {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()) {
      return node.textContent.trim();
    }
  }
  return '';
}

/** Fließtext-Normalisierung: der Browser bricht Zeilenumbrüche weich um, und
 *  `translateElement` schreibt den Eintrag ohnehin als eine Zeile. */
function norm(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function renderedGerman(el: Element): string {
  return el.childElementCount === 0
    ? norm(el.textContent ?? '')
    : norm(firstMeaningfulTextNode(el));
}

function described(el: Element): string {
  const id = el.id ? `#${el.id}` : '';
  const cls = el.getAttribute('class') ? `.${el.getAttribute('class')!.split(' ').join('.')}` : '';
  return `<${el.tagName.toLowerCase()}${id}${cls}>`;
}

describe('i18n: Marker vs. Wörterbuch', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = html;
    root = document.body;
  });

  test('jeder Marker zeigt auf einen existierenden Schlüssel', () => {
    const keys = Object.keys(de);
    const unknown: string[] = [];
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const key = el.getAttribute('data-i18n')!;
      if (!keys.includes(key)) unknown.push(`${described(el)} → „${key}“`);
    }
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) {
        const key = el.getAttribute(`data-i18n-${attr}`)!;
        if (!keys.includes(key)) unknown.push(`${described(el)} → ${attr} „${key}“`);
      }
    }
    expect(unknown).toEqual([]);
  });

  test('der deutsche Text jedes Elements stimmt mit dem Wörterbuch überein', () => {
    const wrong: string[] = [];
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const key = el.getAttribute('data-i18n')!;
      const want = norm(de[key as keyof typeof de]);
      if (renderedGerman(el) !== want.trim()) {
        wrong.push(`${described(el)} [${key}] → „${renderedGerman(el)}“ statt „${want.trim()}“`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('übersetzte Attribute stimmen mit dem Wörterbuch überein', () => {
    const wrong: string[] = [];
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) {
        const key = el.getAttribute(`data-i18n-${attr}`)!;
        const want = norm(de[key as keyof typeof de]);
        const got = norm(el.getAttribute(attr) ?? '');
        if (got !== want)
          wrong.push(`${described(el)} [${attr}/${key}] → „${got}“ statt „${want}“`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('kein toter Wörterbuch-Eintrag ohne Marker', () => {
    const used = new Set<string>(keysUsedInJs());
    for (const el of root.querySelectorAll('[data-i18n]')) used.add(el.getAttribute('data-i18n')!);
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) {
        used.add(el.getAttribute(`data-i18n-${attr}`)!);
      }
    }
    const orphans = Object.keys(de).filter(k => !used.has(k));
    expect(orphans).toEqual([]);
  });

  test('en deckt jeden Schlüssel mit nicht-leerem Text ab', () => {
    const missing: string[] = [];
    for (const key of Object.keys(de)) {
      const value = en[key as keyof typeof de];
      if (!value || !value.trim()) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});
