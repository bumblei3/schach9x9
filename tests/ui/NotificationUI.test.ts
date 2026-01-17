import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationUI } from '../../js/ui/NotificationUI';

describe('NotificationUI', () => {
    let notificationUI: NotificationUI;

    beforeEach(() => {
        document.body.innerHTML = '';
        // Re-instantiate to test fresh state
        notificationUI = new NotificationUI();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should create container on initialization', () => {
        const container = document.getElementById('toast-container');
        expect(container).toBeTruthy();
    });

    it('should show toast notification with correct message and type', () => {
        notificationUI.show('Test Message', 'success', 'Success Title');
        const toast = document.querySelector('.toast-notification');

        expect(toast).toBeTruthy();
        expect(toast?.classList.contains('toast-success')).toBe(true);
        expect(toast?.innerHTML).toContain('Test Message');
        expect(toast?.innerHTML).toContain('Success Title');
    });

    it('should use default title and icon for info type', () => {
        notificationUI.show('Info Message', 'info');
        const toast = document.querySelector('.toast-notification');

        expect(toast?.innerHTML).toContain('Info');
        expect(toast?.innerHTML).toContain('ℹ️');
    });

    it('should auto-close after duration', () => {
        notificationUI.show('Auto Close', 'info', null, 1000);
        const toast = document.querySelector('.toast-notification') as HTMLElement;

        expect(toast).toBeTruthy();

        // Advance timer past duration
        vi.advanceTimersByTime(1100);

        // Should have added 'hiding' class
        expect(toast.classList.contains('hiding')).toBe(true);

        // Trigger animation end to remove
        toast.dispatchEvent(new Event('animationend'));
        expect(document.querySelector('.toast-notification')).toBeNull();
    });

    it('should close on button click', () => {
        notificationUI.show('Click Close', 'error');
        const closeBtn = document.querySelector('.toast-close') as HTMLElement;
        const toast = document.querySelector('.toast-notification') as HTMLElement;

        expect(closeBtn).toBeTruthy();
        closeBtn.click();

        expect(toast.classList.contains('hiding')).toBe(true);
    });

    it('should create container on show if deleted', () => {
        // Manually remove container
        const container = document.getElementById('toast-container');
        container?.remove();

        notificationUI.show('Resurrect Container');
        expect(document.getElementById('toast-container')).toBeTruthy();
    });
});
