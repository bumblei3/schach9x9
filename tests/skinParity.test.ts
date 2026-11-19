/**
 * Parität der Skin-Listen: 2D-Sets, 3D-Presets, Auswahl-Markup.
 *
 * `frost` existierte im 2D-Set (`js/assets/pieces/frost.ts`), in
 * `getAvailableSkins()` und als `<option>` im Auswahl-Markup — aber nicht in
 * den 3D-`SKIN_PRESETS`. `createPiece3D` fiel für „Frost" still auf
 * `SKIN_PRESETS.classic` zurück, also sah im 3D-Modus nichts anders aus als
 * bei „Classic". Kein Test hat das gefangen, weil jeder Test nur eine der
 * drei Listen prüft.
 *
 * Der Markup wird als Text gelesen, nicht im Browser: die Liste steht in
 * `index.html` und ist für die Parität ausschlaggebend, nicht das Rendering.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIECE_SETS, getAvailableSkins } from '../js/assets/pieces/index.js';
import { SKIN_PRESETS } from '../js/pieces3D.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Skin-Listen-Parität', () => {
  test('2D-Sets und 3D-Presets haben dieselben Skins', () => {
    const zwoDimensional = Object.keys(PIECE_SETS).sort();
    const dreiD = Object.keys(SKIN_PRESETS).sort();

    expect(dreiD, `3D-Presets ohne 2D-Gegenstück oder umgekehrt: 2D=${zwoDimensional}, 3D=${dreiD}`)
      .toEqual(zwoDimensional);
  });

  test('getAvailableSkins() nennt genau die 2D-Skins', () => {
    const liste = getAvailableSkins().map(s => s.id).sort();
    expect(liste).toEqual(Object.keys(PIECE_SETS).sort());
  });

  test('jede Skin-Option im Markup hat ein 3D-Preset', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const optionen = new Set(
      [...html.matchAll(/value="([a-z]+)" data-i18n="skin\.[a-z]+"/g)].map(m => m[1])
    );
    expect(optionen.size, 'keine Skin-Optionen im Markup gefunden').toBeGreaterThan(0);

    const fehlend = [...optionen].filter(id => !(id in SKIN_PRESETS));
    expect(fehlend, `Skin im Markup ohne 3D-Preset: ${fehlend.join(', ')}`).toEqual([]);
  });

  test('jedes 3D-Preset hat eine Markup-Option', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const optionen = new Set(
      [...html.matchAll(/value="([a-z]+)" data-i18n="skin\.[a-z]+"/g)].map(m => m[1])
    );

    const fehlend = Object.keys(SKIN_PRESETS).filter(id => !optionen.has(id));
    expect(fehlend, `3D-Preset ohne Markup-Option: ${fehlend.join(', ')}`).toEqual([]);
  });

  test('jedes 3D-Preset liefert weiße und schwarze Materialien', () => {
    for (const [name, preset] of Object.entries(SKIN_PRESETS)) {
      expect(preset.white, `${name}: weißes Material fehlt`).toBeTruthy();
      expect(preset.black, `${name}: schwarzes Material fehlt`).toBeTruthy();
      expect(preset.white.base.color, `${name}: weiße Basisfarbe`).toBeGreaterThanOrEqual(0);
      expect(preset.black.base.color, `${name}: schwarze Basisfarbe`).toBeGreaterThanOrEqual(0);
    }
  });
});
