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
    // Message + title rendered as text nodes, not innerHTML
    expect(toast?.querySelector('.toast-message')?.textContent).toBe('Test Message');
    expect(toast?.querySelector('.toast-title')?.textContent).toBe('Success Title');
  });

  it('should use default title and icon for info type', () => {
    notificationUI.show('Info Message', 'info');
    const toast = document.querySelector('.toast-notification');

    expect(toast?.querySelector('.toast-title')?.textContent).toBe('Info');
    expect(toast?.querySelector('.toast-icon')?.textContent).toContain('ℹ️');
  });

  it('should escape user-supplied text (no HTML injection)', () => {
    // A message containing markup must be rendered as literal text, not parsed.
    const malicious = '<img src=x onerror=alert(1)>';
    notificationUI.show(malicious, 'warning', 'XSS Test');
    const toast = document.querySelector('.toast-notification');

    expect(toast?.querySelector('.toast-message')?.textContent).toBe(malicious);
    // No img element should have been created from the message
    expect(toast?.querySelector('.toast-message img')).toBeNull();
    expect(toast?.innerHTML).not.toContain('<img');
  });

  it('should set aria-live / role for screen readers (errors assertive)', () => {
    notificationUI.show('Info text', 'info');
    notificationUI.show('Error text', 'error');
    const toasts = document.querySelectorAll('.toast-notification');
    const infoToast = toasts[0] as HTMLElement;
    const errorToast = toasts[1] as HTMLElement;

    expect(infoToast.getAttribute('role')).toBe('status');
    expect(infoToast.getAttribute('aria-live')).toBe('polite');
    expect(errorToast.getAttribute('role')).toBe('alert');
    expect(errorToast.getAttribute('aria-live')).toBe('assertive');
  });

  it('should cap the number of visible toasts and drop the oldest', () => {
    for (let i = 1; i <= 6; i++) {
      notificationUI.show(`Toast ${i}`, 'info');
    }
    // Only the 4 most recent remain *active*; the two oldest are dismissed
    // (they keep the .hiding class until their fade-out animation ends).
    const active = document.querySelectorAll('.toast-notification:not(.hiding)');
    expect(active.length).toBe(4);
    const messages = Array.from(active).map(
      t => (t.querySelector('.toast-message') as HTMLElement).textContent
    );
    expect(messages).toEqual(['Toast 3', 'Toast 4', 'Toast 5', 'Toast 6']);
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
