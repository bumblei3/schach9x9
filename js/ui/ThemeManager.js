/**
 * Manages visual themes for the application.
 * Persists user preference in localStorage.
 */
import { logger } from '../logger.js';

export class ThemeManager {
  constructor() {
    this.currentTheme = 'classic';
    this.themes = ['classic', 'blue', 'green'];
  }

  /**
   * Initializes the theme manager.
   * Loads saved theme from storage.
   */
  init() {
    const savedTheme = localStorage.getItem('chess9x9-theme');
    if (savedTheme && this.themes.includes(savedTheme)) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('classic');
    }
    logger.info(`ThemeManager initialized with theme: ${this.currentTheme}`);
  }

  /**
   * Sets the active theme.
   * @param {string} themeName - 'classic', 'blue', or 'green'
   */
  setTheme(themeName) {
    if (!this.themes.includes(themeName)) {
      logger.warn(`Attempted to set invalid theme: ${themeName}`);
      return;
    }

    this.currentTheme = themeName;
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('chess9x9-theme', themeName);

    // Dispatch event for other components if needed
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: themeName } }));
  }

  /**
   * Cycles to the next theme.
   */
  cycleTheme() {
    const currentIndex = this.themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.setTheme(this.themes[nextIndex]);
  }
}
