import { describe, it, expect, vi, beforeEach } from 'vitest';

const dailyMock = vi.hoisted(() => ({
  isSolvedToday: vi.fn(() => false),
  formatStreakLabel: vi.fn(() => ''),
}));

vi.mock('../../js/dailyPuzzle.js', () => ({ dailyPuzzle: dailyMock }));

const { syncDailyPuzzleMenu } = await import('../../js/ui/dailyPuzzleMenu.js');

function featuredMenu(): void {
  document.body.innerHTML = `
    <div class="gamemode-grid gamemode-grid-featured">
      <div class="gamemode-card hidden" id="main-menu-continue-btn"></div>
      <div class="gamemode-card" id="campaign-start-btn"></div>
      <button class="gamemode-card" data-mode="classic"></button>
      <button class="gamemode-card" data-mode="daily-puzzle">
        <span id="daily-puzzle-badge" style="display: none"></span>
        <span id="daily-puzzle-streak" style="display: none"></span>
      </button>
    </div>
  `;
}

function visibleModes(): string[] {
  return [...document.querySelectorAll('.gamemode-grid-featured > .gamemode-card')]
    .filter(el => !el.classList.contains('hidden'))
    .map(el => el.getAttribute('data-mode') || el.id);
}

describe('syncDailyPuzzleMenu', () => {
  beforeEach(() => {
    featuredMenu();
    dailyMock.isSolvedToday.mockReset();
    dailyMock.formatStreakLabel.mockReset();
    dailyMock.isSolvedToday.mockReturnValue(false);
    dailyMock.formatStreakLabel.mockReturnValue('');
  });

  it('puts an unsolved daily card after Fortsetzen and ahead of Kampagne', () => {
    syncDailyPuzzleMenu();
    expect(visibleModes()).toEqual(['daily-puzzle', 'campaign-start-btn', 'classic']);
    expect(document.getElementById('daily-puzzle-badge')!.style.display).toBe('none');
  });

  it('keeps Fortsetzen first when a saved game is showing it', () => {
    document.getElementById('main-menu-continue-btn')!.classList.remove('hidden');
    syncDailyPuzzleMenu();
    const order = [...document.querySelectorAll('.gamemode-grid-featured > .gamemode-card')].map(
      el => el.getAttribute('data-mode') || el.id
    );
    expect(order).toEqual([
      'main-menu-continue-btn',
      'daily-puzzle',
      'campaign-start-btn',
      'classic',
    ]);
  });

  it('puts a solved daily card directly behind Klassisch', () => {
    dailyMock.isSolvedToday.mockReturnValue(true);
    dailyMock.formatStreakLabel.mockReturnValue('🔥 2 Tage · Best 2');
    document.getElementById('main-menu-continue-btn')!.classList.remove('hidden');
    syncDailyPuzzleMenu();
    const order = [...document.querySelectorAll('.gamemode-grid-featured > .gamemode-card')].map(
      el => el.getAttribute('data-mode') || el.id
    );
    expect(order).toEqual([
      'main-menu-continue-btn',
      'campaign-start-btn',
      'classic',
      'daily-puzzle',
    ]);
    expect(document.getElementById('daily-puzzle-badge')!.style.display).toBe('inline-block');
    expect(document.getElementById('daily-puzzle-streak')!.textContent).toBe('🔥 2 Tage · Best 2');
  });

  it('does nothing when the card is absent', () => {
    document.body.innerHTML = '<div id="main-menu"></div>';
    expect(() => syncDailyPuzzleMenu()).not.toThrow();
  });
});
