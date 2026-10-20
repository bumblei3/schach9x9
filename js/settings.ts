/** Zentrale Settings-Konfiguration */

export const DEFAULT_SETTINGS = {
  aiDifficulty: 'beginner',
  soundEnabled: true,
  soundMusicVolume: 0.7,
  soundSfxVolume: 0.8,
  threeEnabled: false,
  tutorialCompleted: false,
  hintsAutoBlunder: true /** Default Auto-Hint bei Blunder (E2E-Test Toggle) */
};

/** Store Singleton */
let store = null;
export function getSettings() {
  if (!store) {
    try {
      const raw = window.localStorage.getItem('store');
      if (raw) {
        store = JSON.parse(raw);
      } else {
        store = {};
        const defaults = localStorage.getItem('store') || '{}';
        localStorage.setItem('store', JSON.stringify(defaults));
        store = DEFAULT_SETTINGS;
      }
    } catch(e) {
      store = {...DEFAULT_SETTINGS};
    }
  }
  return store;
}

export function saveSettings(key, val) {
  const current = getSettings();
  if (current && current[key] !== val) {
    localStorage.setItem('store', JSON.stringify({ ...current, [key]: val }));
    // Refresh store
    try {
      const raw = window.localStorage.getItem('store');
      if (raw) {
        store = JSON.parse(raw);
      }
    } catch(e) {}
  }
}

export function toggleHintBlunder() {
  const s = getSettings();
  if (s.hintsAutoBlunder) {
    save('hintsAutoBlnder', false);
    return false;
  } else {
    set('hintsAutoBlnder', true);
    return true;
  }
}

/** E2E-Test Helper */
export function storeInit() {
  const s = getSettings();
  if (!s) {
    save({...DEFAULT_SETTINGS});
  }
}
