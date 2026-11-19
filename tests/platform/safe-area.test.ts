/**
 * Safe-Area-Insets: die README wirbt mit "Safe-Area-Inset für Notched Devices".
 *
 * `env(safe-area-inset-*)` hat **nur** eine Wirkung, wenn das Viewport-Meta
 * `viewport-fit=cover` setzt — sonst rechnet der Browser die Werte immer mit 0.
 * Genau das war der Fall: `css/layout.css`, `css/board.css` und
 * `css/tutorial.css` verwenden die Insets an Aktionsleiste, Panels und
 * Tutorial-Overlay, aber `index.html` ließ `viewport-fit=cover` weg, sodass auf
 * einem notched iPhone nichts davon ankam.
 *
 * Im Headless-Chromium sind die Insets ohnehin 0 (kein echter Notch), deshalb
 * prüft dieser Spec die Voraussetzung statisch und sperrt sie.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lies = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Safe-Area-Voraussetzungen', () => {
  it('Viewport-Meta erlaubt cover (sonst sind alle env()-Insets 0)', () => {
    const html = lies('index.html');
    const meta = /<meta\s+name="viewport"\s+content="([^"]+)"\s*\/?>/i.exec(html);
    expect(meta, 'Viewport-Meta nicht gefunden').not.toBeNull();
    expect(meta![1]).toContain('viewport-fit=cover');
  });

  it('layout.css nutzt die Insets für Aktionsleiste/Panels', () => {
    const css = lies('css/layout.css');
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/env\(safe-area-inset-top\)/);
  });

  it('board.css schützt die Brettgeometrie vor Notch und Home-Indikator', () => {
    const css = lies('css/board.css');
    expect(css).toMatch(/env\(safe-area-inset-top\)/);
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it('PWA-Rahmen vorhanden (Manifest + Theme-Farbe)', () => {
    const html = lies('index.html');
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/name="theme-color"/);
  });
});
