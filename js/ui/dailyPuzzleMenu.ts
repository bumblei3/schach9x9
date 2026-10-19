/**
 * Featured-menu placement for the daily puzzle.
 *
 * Unsolved today: the card sits immediately after Fortsetzen (or first, if
 * Fortsetzen is not in this grid). Solved today: it sits directly after
 * Klassisch 9×9. Fortsetzen itself is never moved.
 */

import { dailyPuzzle } from '../dailyPuzzle.js';

export function syncDailyPuzzleMenu(): void {
  if (typeof document.querySelector !== 'function') return;

  const card = document.querySelector<HTMLElement>('.gamemode-card[data-mode="daily-puzzle"]');
  const grid = card?.parentElement;
  if (!card || !grid) return;

  const solved = dailyPuzzle.isSolvedToday();
  const badge = document.getElementById('daily-puzzle-badge');
  if (badge) badge.style.display = solved ? 'inline-block' : 'none';

  const streakEl = document.getElementById('daily-puzzle-streak');
  if (streakEl) {
    const label = dailyPuzzle.formatStreakLabel();
    streakEl.textContent = label;
    streakEl.style.display = label ? 'inline-block' : 'none';
  }

  const continueBtn = document.getElementById('main-menu-continue-btn');
  const classic = grid.querySelector<HTMLElement>('.gamemode-card[data-mode="classic"]');

  if (!solved) {
    if (continueBtn && continueBtn.parentElement === grid) {
      continueBtn.insertAdjacentElement('afterend', card);
    } else {
      grid.prepend(card);
    }
    return;
  }

  if (classic) classic.insertAdjacentElement('afterend', card);
}
