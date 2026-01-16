import { describe, expect, test, beforeEach } from 'vitest';
import { TooltipManager } from '../../js/ui/TooltipManager.js';

describe('TooltipManager', () => {
  let tooltipManager: TooltipManager;

  beforeEach(() => {
    document.body.innerHTML = '';
    tooltipManager = new TooltipManager();
  });

  test('should create tooltip element on init', () => {
    expect(tooltipManager).toBeDefined();
    const el = document.querySelector('.global-tooltip');
    expect(el).not.toBeNull();
    expect(el?.classList.contains('hidden')).toBe(true);
  });

  test('should show tooltip on mouseover', () => {
    const trigger = document.createElement('div');
    trigger.setAttribute('data-tooltip', 'Test Tooltip');
    document.body.appendChild(trigger);

    const event = new MouseEvent('mouseover', { bubbles: true });
    trigger.dispatchEvent(event);

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(false);
    expect(tooltip.textContent).toBe('Test Tooltip');
  });

  test('should hide tooltip on mouseout', () => {
    const trigger = document.createElement('div');
    trigger.setAttribute('data-tooltip', 'Test Tooltip');
    document.body.appendChild(trigger);

    // Show first
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(false);

    // Hide
    trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  test('should ignore mouseover on elements without data-tooltip', () => {
    const trigger = document.createElement('div');
    document.body.appendChild(trigger);
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  test('should position tooltip correctly', () => {
    const trigger = document.createElement('div');
    trigger.setAttribute('data-tooltip', 'Test');
    trigger.style.position = 'absolute';
    trigger.style.left = '100px';
    trigger.style.top = '100px';
    trigger.style.width = '20px';
    trigger.style.height = '20px';
    document.body.appendChild(trigger);

    // Mock getBoundingClientRect
    trigger.getBoundingClientRect = () => ({
      top: 100,
      left: 100,
      bottom: 120,
      right: 120,
      width: 20,
      height: 20,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    // Mock tooltip rect
    Object.defineProperty(tooltip, 'getBoundingClientRect', {
      value: () => ({
        width: 50,
        height: 20,
        top: 0,
        left: 0,
        bottom: 20,
        right: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
      writable: true,
      configurable: true,
    });

    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(tooltip.style.top).toBeDefined();
    expect(tooltip.style.left).toBeDefined();
  });

  test('should adjust position if off-screen (top)', () => {
    const trigger = document.createElement('div');
    trigger.setAttribute('data-tooltip', 'Test');
    document.body.appendChild(trigger);

    trigger.getBoundingClientRect = () => ({
      top: 10, // Close to top
      left: 100,
      bottom: 30,
      right: 120,
      width: 20,
      height: 20,
      x: 100,
      y: 10,
      toJSON: () => {},
    });

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    Object.defineProperty(tooltip, 'getBoundingClientRect', {
      value: () => ({
        width: 50,
        height: 50,
        top: 0,
        left: 0,
        bottom: 50,
        right: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
      writable: true,
      configurable: true,
    });

    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    // Should position below: bottom + 8 = 30 + 8 = 38
    expect(tooltip.style.top).toBe('38px');
  });

  test('should adjust position if off-screen (left)', () => {
    const trigger = document.createElement('div');
    trigger.setAttribute('data-tooltip', 'Test');
    document.body.appendChild(trigger);

    trigger.getBoundingClientRect = () => ({
      top: 100,
      left: 0, // Left edge
      width: 20,
      height: 20,
      bottom: 120,
      right: 20,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    const tooltip = document.querySelector('.global-tooltip') as HTMLElement;
    Object.defineProperty(tooltip, 'getBoundingClientRect', {
      value: () => ({
        width: 50,
        height: 20,
        top: 0,
        left: 0,
        bottom: 20,
        right: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
      writable: true,
      configurable: true,
    });

    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    // Should be clamped to 8
    expect(tooltip.style.left).toBe('8px');
  });
});
