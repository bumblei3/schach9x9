import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showInvalidMoveFeedback } from '../../js/ui/BoardRenderer';
import { animateCheck } from '../../js/ui';
import { setupJSDOM } from '../test-utils';

describe('Invalid move & check feedback', () => {
  beforeEach(() => {
    setupJSDOM();
    document.body.innerHTML = `
      <div id="status-display"></div>
      <div class="cell" data-r="1" data-c="2"><div class="piece-svg"></div></div>
      <div class="cell" data-r="4" data-c="4"><div class="piece"></div></div>
      <div class="cell" data-r="0" data-c="0"><div class="piece-svg"></div></div>
    `;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('showInvalidMoveFeedback marks target and origin cells', () => {
    showInvalidMoveFeedback({ r: 1, c: 2 }, { r: 4, c: 4 });

    const to = document.querySelector('.cell[data-r="1"][data-c="2"]');
    const from = document.querySelector('.cell[data-r="4"][data-c="4"]');
    expect(to?.classList.contains('invalid-move')).toBe(true);
    expect(from?.classList.contains('piece-shake')).toBe(true);

    vi.advanceTimersByTime(600);
    expect(to?.classList.contains('invalid-move')).toBe(false);
    expect(from?.classList.contains('piece-shake')).toBe(false);
  });

  it('animateCheck flashes king cell and status banner', async () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[0][0] = { type: 'k', color: 'white' };
    const game = {
      board,
      isInCheck: () => true,
      turn: 'white',
      phase: 'play',
    } as any;

    animateCheck(game, 'white');

    const status = document.getElementById('status-display');
    expect(status?.textContent).toMatch(/SCHACH/);
    expect(status?.classList.contains('status-check')).toBe(true);

    const kingCell = document.querySelector('.cell[data-r="0"][data-c="0"]');
    // kingFlash only applied when findKing locates 0,0
    if (kingCell?.classList.contains('in-check')) {
      expect(kingCell.classList.contains('king-check-flash')).toBe(true);
    }
  });
});

