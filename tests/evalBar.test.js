/**
 * Unit tests for EvaluationBar
 */
import { EvaluationBar } from '../js/ui/EvaluationBar.js';

describe('EvaluationBar', () => {
  let container;

  beforeEach(() => {
    // Setup DOM
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should initialize and insert into DOM', () => {
    const _evalBar = new EvaluationBar('test-container');
    const wrapper = document.querySelector('.evaluation-bar-wrapper');
    expect(wrapper).not.toBeNull();
    expect(container.contains(wrapper)).toBe(true);
  });

  test('should show correct percentage for neutral position', () => {
    const evalBar = new EvaluationBar('test-container');
    evalBar.update(0);

    const fill = document.querySelector('.eval-bar-fill');
    expect(fill.style.height).toBe('50%');

    const score = document.querySelector('.eval-bar-score');
    expect(score.textContent).toBe('0.0');
  });

  test('should show correct percentage for white advantage', () => {
    const evalBar = new EvaluationBar('test-container');
    evalBar.update(200); // +2.0

    const fill = document.querySelector('.eval-bar-fill');
    // 50 + (200/1000)*50 = 50 + 10 = 60%
    expect(fill.style.height).toBe('60%');

    const score = document.querySelector('.eval-bar-score');
    expect(score.textContent).toBe('+2.0');
  });

  test('should show correct percentage for black advantage', () => {
    const evalBar = new EvaluationBar('test-container');
    evalBar.update(-400); // -4.0

    const fill = document.querySelector('.eval-bar-fill');
    // 50 + (-400/1000)*50 = 50 - 20 = 30%
    expect(fill.style.height).toBe('30%');

    const score = document.querySelector('.eval-bar-score');
    expect(score.textContent).toBe('-4.0');
  });

  test('should clamp extreme scores', () => {
    const evalBar = new EvaluationBar('test-container');
    evalBar.update(2000); // way above 1000

    const fill = document.querySelector('.eval-bar-fill');
    expect(fill.style.height).toBe('100%');

    evalBar.update(-5000); // way below -1000
    expect(fill.style.height).toBe('0%');
  });

  test('visible property should toggle display', () => {
    const evalBar = new EvaluationBar('test-container');
    evalBar.show(false);
    expect(document.querySelector('.evaluation-bar-wrapper').style.display).toBe('none');

    evalBar.show(true);
    expect(document.querySelector('.evaluation-bar-wrapper').style.display).toBe('flex');
  });
});
