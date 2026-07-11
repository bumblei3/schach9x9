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
   * @param message - Main message (rendered as text, never HTML)
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

    // Check if container still exists in DOM
    if (!this.container || !document.body.contains(this.container)) {
      this.createContainer();
    }

    // Icons + default title based on type
    let icon = 'ℹ️';
    let defaultTitle = 'Info';
    let effectiveDuration = duration;

    switch (type) {
      case 'success':
        icon = '✅';
        defaultTitle = 'Erfolg';
        break;
      case 'error':
        icon = '❌';
        defaultTitle = 'Fehler';
        effectiveDuration = 5000;
        break;
      case 'warning':
        icon = '⚠️';
        defaultTitle = 'Warnung';
        break;
    }

    const finalTitle = title || defaultTitle;

    // Build the toast via DOM nodes (not innerHTML) so user-supplied text is
    // never parsed as HTML — prevents XSS / broken rendering of special chars.
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    // Announce non-intrusively to screen readers; errors use assertive.
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = icon;

    const contentEl = document.createElement('div');
    contentEl.className = 'toast-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = finalTitle;

    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;

    contentEl.append(titleEl, messageEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => this.hide(toast);

    toast.append(iconEl, contentEl, closeBtn);

    // Stacking cap: keep at most MAX_TOASTS visible, drop the oldest.
    const MAX_TOASTS = 4;
    const existing = this.container
      ? Array.from(this.container.querySelectorAll('.toast-notification'))
      : [];
    while (existing.length >= MAX_TOASTS) {
      const oldest = existing.shift();
      if (oldest) this.hide(oldest as HTMLElement);
    }

    this.container?.appendChild(toast);

    // Auto close
    if (effectiveDuration > 0) {
      setTimeout(() => {
        if (toast.parentElement) this.hide(toast);
      }, effectiveDuration);
    }
  }

  public hide(toast: HTMLElement): void {
    toast.classList.add('hiding');
    toast.addEventListener(
      'animationend',
      () => {
        if (toast.parentElement) {
          toast.remove();
        }
      },
      { once: true }
    );
  }
}

export const notificationUI = new NotificationUI();
