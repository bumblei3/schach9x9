import { ThemeManager } from '../js/ui/ThemeManager.js';
import { jest } from '@jest/globals';

describe('ThemeManager', () => {
    let themeManager;

    beforeEach(() => {
        // Clear storage and mocks
        localStorage.clear();
        document.body.removeAttribute('data-theme');
        themeManager = new ThemeManager();
    });

    test('should default to classic theme', () => {
        themeManager.init();
        expect(themeManager.currentTheme).toBe('classic');
        expect(document.body.getAttribute('data-theme')).toBe('classic');
    });

    test('should load theme from localStorage', () => {
        localStorage.setItem('chess9x9-theme', 'blue');
        themeManager.init();
        expect(themeManager.currentTheme).toBe('blue');
        expect(document.body.getAttribute('data-theme')).toBe('blue');
    });

    test('should set valid theme', () => {
        themeManager.init();
        themeManager.setTheme('green');

        expect(themeManager.currentTheme).toBe('green');
        expect(document.body.getAttribute('data-theme')).toBe('green');
        expect(localStorage.getItem('chess9x9-theme')).toBe('green');
    });

    test('should reject invalid theme', () => {
        themeManager.init();
        const originalTheme = themeManager.currentTheme;

        themeManager.setTheme('invalid-theme');

        expect(themeManager.currentTheme).toBe(originalTheme);
        expect(document.body.getAttribute('data-theme')).toBe(originalTheme);
    });

    test('should cycle themes correctly', () => {
        themeManager.init();
        // Start: classic
        themeManager.cycleTheme();
        expect(themeManager.currentTheme).toBe('blue');

        themeManager.cycleTheme();
        expect(themeManager.currentTheme).toBe('green');

        themeManager.cycleTheme();
        expect(themeManager.currentTheme).toBe('classic');
    });

    test('should dispatch themeChanged event', () => {
        themeManager.init();
        const mockCallback = jest.fn();
        window.addEventListener('themeChanged', mockCallback);

        themeManager.setTheme('blue');

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback.mock.calls[0][0].detail).toEqual({ theme: 'blue' });
    });
});
