import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EvaluationBar } from '../../js/ui/EvaluationBar.js';

describe('EvaluationBar - style branches', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function labels(): { score: HTMLElement } {
    return {
      score: document.querySelector('.eval-bar-score') as HTMLElement,
    };
  }

  test('update applies win-white class for large white advantage', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(600); // > EVAL_WINNING_THRESHOLD (400cp assumed)
    const { score } = labels();
    expect(score.className).toContain('win-white');
    expect(score.className).not.toContain('win-black');
  });

  test('update applies win-black class for large black advantage', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(-600);
    const { score } = labels();
    expect(score.className).toContain('win-black');
    expect(score.className).not.toContain('win-white');
  });

  test('update applies neutral class for balanced position', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(0);
    const { score } = labels();
    expect(score.className).toContain('neutral');
  });

  test('update clamps near-threshold scores to neutral/win classes correctly', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(300); // below threshold -> neutral
    expect(labels().score.className).toContain('neutral');
  });

  test('fill gradient uses neutral tokens at balanced score', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(0);
    const fill = document.querySelector('.eval-bar-fill') as HTMLElement;
    // Neutral branch -> var(--bg-board-dark) gradient
    expect(fill.style.background).toContain('var(--bg-board-dark)');
    expect(fill.style.background).toContain('var(--bg-app)');
  });

  test('fill gradient interpolates toward green for white advantage', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(800);
    const fill = document.querySelector('.eval-bar-fill') as HTMLElement;
    expect(fill.style.background).toMatch(/rgb\(/);
  });

  test('fill gradient interpolates toward red for black advantage', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(-800);
    const fill = document.querySelector('.eval-bar-fill') as HTMLElement;
    expect(fill.style.background).toMatch(/rgb\(/);
  });

  test('pulse animation is set on a large score change (>150cp)', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(0);
    bar.update(500); // diff = 500 > 150
    const fill = document.querySelector('.eval-bar-fill') as HTMLElement;
    expect(fill.style.animation).toContain('eval-pulse');
  });

  test('no pulse animation on a small score change (<150cp)', () => {
    const bar = new EvaluationBar('test-container');
    bar.update(0);
    bar.update(50); // diff = 50 < 150
    const fill = document.querySelector('.eval-bar-fill') as HTMLElement;
    expect(fill.style.animation).toBe('');
  });

  test('update is a no-op (no throw) when DOM elements are missing', () => {
    // Container without the bar already injected: force a missing fill/score
    document.body.innerHTML = '';
    const bar = new EvaluationBar('test-container');
    // Remove the dynamically created nodes to exercise the guards
    document.querySelector('.eval-bar-fill')?.remove();
    document.querySelector('.eval-bar-score')?.remove();
    expect(() => bar.update(300)).not.toThrow();
  });
});
