/**
 * `js/settings.ts` — der Settings-Store.
 *
 * Früher war das Modul toter Code mit zwei Defekten: `saveSettings()` rief
 * `save()`/`set()` auf, die es nicht gibt, und bei leerem Store wurde nur
 * `"{}"` persistiert, sodass der zweite Aufruf die Defaults wieder verlor.
 * Beides ist hier gegen Regressionen abgesichert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '../js/settings.js';

/** Import frisch holen: das Modul hält den Store in einem Modul-Singleton. */
async function freshSettings() {
  vi.resetModules();
  return await import('../js/settings.js');
}

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('storeInit legt den Store mit den Defaults an, wenn er leer ist', async () => {
    const { storeInit, getSettings } = await freshSettings();

    storeInit();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(DEFAULT_SETTINGS);
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('getSettings ergänzt fehlende Schlüssel aus einem vorhandenen Store', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aiDifficulty: 'expert' }));

    const { getSettings } = await freshSettings();

    expect(getSettings().aiDifficulty).toBe('expert');
    expect(getSettings().soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
    expect(getSettings().tutorialCompleted).toBe(DEFAULT_SETTINGS.tutorialCompleted);
  });

  it('gespeicherte Werte bleiben über zwei Aufrufe hinweg erhalten', async () => {
    // Regression: beim ersten Aufruf wurde nur "{}" geschrieben, der zweite
    // Aufruf fand einen (leeren) Store und gab {} zurück.
    const first = await freshSettings();
    first.getSettings();

    const second = await freshSettings();
    second.getSettings();

    expect(second.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('storeInit überschreibt vorhandene Einstellungen nicht', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ threeEnabled: true }));

    const { storeInit, getSettings } = await freshSettings();
    storeInit();

    expect(getSettings().threeEnabled).toBe(true);
  });

  it('saveSettings persistiert und aktualisiert den Store', async () => {
    const { saveSettings, getSettings } = await freshSettings();
    saveSettings('soundEnabled', false);

    expect(getSettings().soundEnabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '').soundEnabled).toBe(false);
    // Nicht angefasste Schlüssel bleiben unverändert.
    expect(getSettings().soundSfxVolume).toBe(DEFAULT_SETTINGS.soundSfxVolume);
  });

  it('kaputter Store fällt auf die Defaults zurück, statt zu werfen', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    const { getSettings } = await freshSettings();

    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(DEFAULT_SETTINGS);
  });

  it('ist nach dem Import von App.ts erreichbar (Store-Init am Boot)', async () => {
    // App.ts ruft storeInit() auf; der Import darf den Store nicht brechen.
    const app = await import('../js/App.js');
    expect(typeof app.App).toBe('function');
  });
});
