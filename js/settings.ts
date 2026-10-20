/**
 * Zentrale Settings-Konfiguration und -Persistenz.
 *
 * Der Store liegt unter dem localStorage-Key `store` als flaches JSON-Objekt.
 * `DEFAULT_SETTINGS` ist die Quelle für fehlende Schlüssel: ein vorhandener
 * Store wird damit ergänzt, ein leerer Store mit den Defaults gefüllt und
 * sofort geschrieben.
 *
 * Früher passierte hier beides nicht: bei leerem Store wurde nur der String
 * `"{}"` persistiert, und `getSettings()` gab danach `{}` zurück — der zweite
 * Aufruf hatte die Defaults wieder verloren. `saveSettings()` schrieb zudem
 * über `save()`/`set()`, Funktionen die es in diesem Modul nie gab.
 */

export const STORAGE_KEY = 'store';

export interface Settings {
  aiDifficulty: string;
  soundEnabled: boolean;
  soundMusicVolume: number;
  soundSfxVolume: number;
  threeEnabled: boolean;
  tutorialCompleted: boolean;
  hintsAutoBlunder: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  aiDifficulty: 'beginner',
  soundEnabled: true,
  soundMusicVolume: 0.7,
  soundSfxVolume: 0.8,
  threeEnabled: false,
  tutorialCompleted: false,
  hintsAutoBlunder: true /** Default Auto-Hint bei Blunder */,
};

/** Store Singleton — null bis zur ersten Abfrage. */
let store: Settings | null = null;

function persist(value: Settings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

/**
 * Aktuelle Settings: Defaults, überlagert mit dem gespeicherten Stand.
 *
 * Ein unlesbarer Store (kaputt oder von außen verändert) fällt auf die
 * Defaults zurück, statt die App beim Boot zu brechen.
 */
export function getSettings(): Settings {
  if (store) return store;

  let stored: Partial<Settings> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<Settings>;
  } catch {
    stored = {};
  }

  store = { ...DEFAULT_SETTINGS, ...stored };
  persist(store);
  return store;
}

/** Einzelnen Schlüssel setzen und sofort persistieren. */
export function saveSettings(key: keyof Settings, val: Settings[keyof Settings]): void {
  const next: Settings = { ...getSettings(), [key]: val };
  store = next;
  persist(next);
}

/**
 * Beim Boot aufrufen: legt den Store mit den Defaults an, falls er leer ist.
 *
 * No-op, sobald Werte vorliegen — gespeicherte Einstellungen werden nie
 * überschrieben.
 */
export function storeInit(): void {
  getSettings();
}
