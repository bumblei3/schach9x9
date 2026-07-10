import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { TooltipManager } from '../../js/ui/TooltipManager.js';

describe('TooltipManager - touch + edge branches', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    new TooltipManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function triggerWithTooltip(): HTMLElement {
    const el = document.createElement('button');
    el.setAttribute('data-tooltip', 'Tap Info');
    document.body.appendChild(el);
    return el;
  }

  test('pointerdown on element with data-tooltip shows tooltip and arms auto-hide timer', () => {
    const el = triggerWithTooltip();
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(false);
    expect(tooltip.textContent).toBe('Tap Info');

    // Auto-hide fires after 1600ms
    vi.advanceTimersByTime(1600);
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  test('pointerdown on element without data-tooltip does not show tooltip', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(true);
    expect(tooltip.textContent).toBe('');
  });

  test('pointerdown on element with empty data-tooltip does not show tooltip', () => {
    const el = document.createElement('div');
    el.setAttribute('data-tooltip', '');
    document.body.appendChild(el);
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  test('re-tapping resets the auto-hide timer (no premature hide)', () => {
    const el = triggerWithTooltip();
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    // Advance almost to the hide threshold, then tap again
    vi.advanceTimersByTime(1500);
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    // 1500ms later (would have hidden the first timer) it must still be visible
    vi.advanceTimersByTime(1500);
    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(false);

    // Now the second timer elapses -> hidden
    vi.advanceTimersByTime(200);
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  test('mouseout does not hide if the event target is not the active element', () => {
    const el = triggerWithTooltip();
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(false);

    // Dispatch mouseout from a DIFFERENT element -> should not hide
    const other = document.createElement('div');
    document.body.appendChild(other);
    other.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  test('show() sets visible opacity/transform and hide() reverses them', () => {
    const el = triggerWithTooltip();
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.style.opacity).toBe('1');
    expect(tooltip.style.transform).toBe('translateY(0)');

    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(tooltip.style.opacity).toBe('0');
    expect(tooltip.style.transform).toBe('translateY(4px)');
  });
});
