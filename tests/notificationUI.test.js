
import { NotificationUI } from '../js/ui/NotificationUI.js';

describe('NotificationUI', () => {
  let notificationUI;

  beforeEach(() => {
    document.body.innerHTML = '';
    notificationUI = new NotificationUI();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should create container if not exists', () => {
    expect(document.getElementById('toast-container')).not.toBeNull();
  });

  test('should reuse existing container', () => {
    const container = document.getElementById('toast-container');
    notificationUI.show('Second message', 'info');
    expect(document.getElementById('toast-container')).toBe(container);
  });

  test('should show success toast', () => {
    notificationUI.show('Saved successfully', 'success');

    const toast = document.querySelector('.toast-success');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Saved successfully');
    expect(toast.textContent).toContain('Erfolg');
    expect(toast.textContent).toContain('✅');
  });

  test('should show warning toast', () => {
    notificationUI.show('Disk almost full', 'warning');

    const toast = document.querySelector('.toast-warning');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Warnung');
    expect(toast.textContent).toContain('⚠️');
  });

  test('should show error toast with longer duration', () => {
    notificationUI.show('Load failed', 'error');

    const toast = document.querySelector('.toast-error');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Fehler');

    // Error duration is 5000
    vi.advanceTimersByTime(3000);
    expect(document.contains(toast)).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(toast.classList.contains('hiding')).toBe(true);
  });

  test('should handle manual close', () => {
    notificationUI.show('Close me', 'info');
    const toast = document.querySelector('.toast-notification');
    const closeBtn = toast.querySelector('.toast-close');

    closeBtn.onclick();
    expect(toast.classList.contains('hiding')).toBe(true);
  });

  test('should remove from DOM after hide animation', () => {
    notificationUI.show('Hidden', 'info');
    const toast = document.querySelector('.toast-notification');

    notificationUI.hide(toast);
    expect(toast.classList.contains('hiding')).toBe(true);

    // Trigger animationend
    toast.dispatchEvent(new Event('animationend'));
    expect(document.contains(toast)).toBe(false);
  });

  test('should use custom title', () => {
    notificationUI.show('Message', 'info', 'Custom Title');
    const toast = document.querySelector('.toast-notification');
    expect(toast.textContent).toContain('Custom Title');
  });
});
