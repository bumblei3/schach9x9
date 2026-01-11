/**
 * NotificationUI.ts
 * Manages Toast Notifications for user feedback.
 */

import type { ToastOptions } from '../types/ui.js';

export class NotificationUI {
    private container: HTMLElement | null = null;

    constructor() {
        if (typeof document !== 'undefined') {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.createContainer();
            }
        }
    }

    private createContainer(): void {
        if (typeof document === 'undefined') return;
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
    }

    /**
     * Show a toast notification
     * @param message - Main message
     * @param type - 'success', 'error', 'warning', 'info'
     * @param title - Optional title, defaults based on type
     * @param duration - ms to show, default 3000
     */
    public show(
        message: string,
        type: ToastOptions['type'] = 'info',
        title: string | null = null,
        duration: number = 3000
    ): void {
        if (typeof document === 'undefined') return;
        if (!this.container) this.createContainer();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;

        // Icons based on type
        let icon = 'ℹ️';
        let defaultTitle = 'Info';

        switch (type) {
            case 'success':
                icon = '✅';
                defaultTitle = 'Erfolg';
                break;
            case 'error':
                icon = '❌';
                defaultTitle = 'Fehler';
                duration = 5000;
                break;
            case 'warning':
                icon = '⚠️';
                defaultTitle = 'Warnung';
                break;
        }

        const finalTitle = title || defaultTitle;

        toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${finalTitle}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">×</button>
    `;

        // Close button logic
        const closeBtn = toast.querySelector('.toast-close') as HTMLButtonElement | null;
        if (closeBtn) {
            closeBtn.onclick = () => this.hide(toast);
        }

        // Auto close
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) this.hide(toast);
            }, duration);
        }

        this.container?.appendChild(toast);
    }

    public hide(toast: HTMLElement): void {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, { once: true });
    }
}

export const notificationUI = new NotificationUI();
