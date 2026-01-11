import { jest } from '@jest/globals';
import { errorManager } from '../js/utils/ErrorManager.js';
import { notificationUI } from '../js/ui/NotificationUI.js';
import { logger } from '../js/logger.js';

// Use spyOn for notificationUI
jest.spyOn(notificationUI, 'show').mockImplementation(() => { });

// Spy on logger instead of mocking entire module to avoid ESM issues
jest.spyOn(logger, 'error').mockImplementation(() => { });
jest.spyOn(logger, 'warn').mockImplementation(() => { });
jest.spyOn(logger, 'info').mockImplementation(() => { });


describe('ErrorManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
      <div id="error-overlay">
        <div class="content"></div>
      </div>
    `;
        // Reset initialized state if possible or assume singleton per test
    });

    test('should handle critical errors by showing overlay', () => {
        const error = new Error('Critical Failure');
        errorManager.handleError(error, { critical: true });

        expect(logger.error).toHaveBeenCalled();
        const overlay = document.getElementById('error-overlay');
        expect(overlay.style.display).toBe('flex');
        expect(overlay.style.display).toBe('flex');
        const details = document.getElementById('error-details-content');
        expect(details.textContent).toContain('Critical Failure');
    });

    test('should handle non-critical errors by showing toast', () => {
        const error = new Error('Minor Glitch');
        errorManager.handleError(error, { critical: false });

        expect(logger.error).toHaveBeenCalled();
        expect(notificationUI.show).toHaveBeenCalledWith(
            'Minor Glitch',
            'error',
            expect.stringContaining('Fehler')
        );
    });

    test('should handle warnings by showing toast', () => {
        errorManager.warning('Disk Full');

        expect(logger.warn).toHaveBeenCalled();
        expect(notificationUI.show).toHaveBeenCalledWith(
            'Disk Full',
            'warning',
            expect.stringContaining('Warnung')
        );
    });
});
