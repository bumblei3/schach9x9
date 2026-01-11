/**
 * NotificationUI.js
 * Manages Toast Notifications for user feedback.
 */

export class NotificationUI {
  constructor() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.createContainer();
    }
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    document.body.appendChild(this.container);
  }

  /**
   * Show a toast notification
   * @param {string} message - Main message
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {string} title - Optional title, defaults based on type
   * @param {number} duration - ms to show, default 3000
   */
  show(message, type = 'info', title = null, duration = 3000) {
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
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => this.hide(toast);

    // Auto close
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) this.hide(toast);
      }, duration);
    }

    this.container.appendChild(toast);
  }

  hide(toast) {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => {
      if (toast.parentElement) {
        toast.remove();
      }
    });
  }
}

export const notificationUI = new NotificationUI();
