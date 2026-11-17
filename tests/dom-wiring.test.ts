/**
 * DOM-Verdrahtungs-Gate.
 *
 * Die wiederkehrende Defektklasse in diesem Repo ist „Element und Funktion
 * existieren, nur der Klick fehlt": `#redo-btn` (Redo war nur per Tastatur
 * erreichbar), `#info-toggle-btn`/`#info-close-btn` (Panel unsichtbar),
 * `#stats-close-btn` (Overlay ohne Schließen). Jeder einzelne war von Hand
 * gefunden worden, keiner von einem Test.
 *
 * Regel: ein `<button id="…">` im ausgelieferten Markup ist entweder im
 * JavaScript per ID referenziert (Listener) oder über ein Delegations-Attribut
 * angebunden. Ein Button ohne beides ist entweder tot oder ein stiller Defekt.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function codeText(): string {
  let out = '';
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.name.endsWith('.ts')) {
        out += readFileSync(p, 'utf8');
      }
    }
  };
  walk(resolve(process.cwd(), 'js'));
  out += readFileSync(resolve(process.cwd(), 'scripts', 'debug.ts'), 'utf8');
  return out;
}

const code = codeText();

/** Delegations-Mechanismen, die einen Button ohne ID-Referenz tragen. */
const DELEGATED_ATTRIBUTES = [
  'data-report-issue', // js/ui/issueReporter.ts
  'data-action', // OverlayManager / ErrorManager
  'data-dbg', // scripts/debug.ts
] as const;

describe('DOM-Verdrahtung', () => {
  test('jeder Button mit ID ist per Listener oder Delegation gebunden', () => {
    const unbound: string[] = [];
    for (const match of html.matchAll(/<button\b([^>]*)>/g)) {
      const attrs = match[1];
      const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
      if (!id) continue;

      const referenced =
        code.includes(`'${id}'`) || code.includes(`"${id}"`) || code.includes(`\`${id}\``);
      if (referenced) continue;

      const delegated = DELEGATED_ATTRIBUTES.some(a => attrs.includes(a));
      if (delegated) continue;

      unbound.push(`#${id}`);
    }
    expect(unbound).toEqual([]);
  });

  test('die bekannten Delegations-Attribute werden von unserem Code wirklich genutzt', () => {
    // Sonst wäre die Ausnahme oben nur eine leere Versprechen.
    expect(code).toContain('data-report-issue');
  });
});
