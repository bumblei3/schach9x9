import { describe, test, expect, beforeEach } from 'vitest';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningTrainerMenu } from '../js/ui/OpeningTrainerMenu.js';

function makeManager(streak = 0): OpeningTrainerManager {
  const book = new OpeningBook({ positions: {} });
  return new OpeningTrainerManager(book, {
    streak,
    attempts: streak,
    correct: streak,
    solvedHashes: [],
  });
}

describe('OpeningTrainerMenu', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  test('renders a start button + progress text without throwing', () => {
    const mgr = makeManager();
    expect(() => new OpeningTrainerMenu(container, mgr, () => {})).not.toThrow();

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.textContent).toMatch(/start/i);

    // Some progress readout should be present.
    expect(container.textContent).toBeTruthy();
  });

  test('clicking the start button invokes the onStart callback', () => {
    const mgr = makeManager();
    let called = false;
    const menu = new OpeningTrainerMenu(container, mgr, () => {
      called = true;
    });

    const button = container.querySelector('button')!;
    button.click();
    expect(called).toBe(true);

    menu.destroy();
  });

  test('progress readout reflects manager.progress (streak)', () => {
    const mgr = makeManager(3);
    new OpeningTrainerMenu(container, mgr, () => {});

    const text = container.textContent ?? '';
    expect(text).toContain('3');
    expect(text.toLowerCase()).toContain('streak');
  });

  test('destroy() is safe to call and removes the start listener', () => {
    const mgr = makeManager();
    let called = false;
    const menu = new OpeningTrainerMenu(container, mgr, () => {
      called = true;
    });

    const button = container.querySelector('button')!;
    menu.destroy();
    // After destroy the root is detached and the start listener removed.
    expect(container.querySelector('button')).toBeNull();
    button.click();
    expect(called).toBe(false);
  });

  test('updateProgress re-renders when root is missing', () => {
    const mgr = makeManager(2);
    // Build a detached menu (root never attached to container).
    const menu = new OpeningTrainerMenu(document.createElement('div'), mgr, () => {});
    // updateProgress with no root must not throw and must fall back to render.
    expect(() => menu.updateProgress()).not.toThrow();
  });

  test('updateProgress appends when no existing progress node', () => {
    const mgr = makeManager(4);
    const menu = new OpeningTrainerMenu(container, mgr, () => {});
    // Remove the progress node to force the appendChild branch.
    container.querySelector('.opening-trainer-progress')?.remove();
    expect(() => menu.updateProgress()).not.toThrow();
    expect(container.textContent).toContain('Streak: 4');
  });
});
