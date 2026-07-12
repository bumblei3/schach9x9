/**
 * AchievementUI.ts
 * UI component for displaying and managing achievements
 */

import { achievementsManager, type Achievement } from '../achievements.js';
import { logger } from '../logger.js';

let isInitialized = false;
let achievementsContainer: HTMLElement | null = null;

/**
 * Creates the achievement card element
 */
function createAchievementCard(ach: Achievement): HTMLElement {
  const card = document.createElement('div');
  card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
  card.dataset.achievementId = ach.id;

  const progressBar =
    ach.progress !== undefined && ach.target !== undefined
      ? `<div class="achievement-progress">
         <div class="achievement-progress-bar" style="width: ${Math.min(100, (ach.progress / ach.target) * 100)}%"></div>
         <span class="achievement-progress-text">${ach.progress}/${ach.target}</span>
       </div>`
      : '';

  card.innerHTML = `
    <div class="achievement-icon">${getAchievementIcon(ach.id)}</div>
    <div class="achievement-info">
      <div class="achievement-name">${ach.name}</div>
      <div class="achievement-description">${ach.description}</div>
      ${progressBar}
    </div>
    <div class="achievement-status">
      ${ach.unlocked ? '✓' : '🔒'}
    </div>
  `;

  return card;
}

/**
 * Returns an emoji/icon for each achievement
 */
function getAchievementIcon(id: string): string {
  const icons: Record<string, string> = {
    first_win: '🏆',
    win_streak_5: '🔥',
    ten_wins: '⭐',
    checkmate_in_5: '⚡',
    promote_pawn: '♟️',
    win_with_king_only: '👑',
  };
  return icons[id] || '🏅';
}

/**
 * Renders all achievements to the container
 */
function renderAchievements(): void {
  if (!achievementsContainer) return;

  const achievements = achievementsManager.getAll();
  achievementsContainer.innerHTML = '';

  // Sort: unlocked first, then by progress
  const sorted = [...achievements].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return b.unlocked ? -1 : 1;
    const aProg = a.progress && a.target ? a.progress / a.target : 0;
    const bProg = b.progress && b.target ? b.progress / b.target : 0;
    return bProg - aProg;
  });

  if (!achievementsContainer) return;

  const container = achievementsContainer;
  sorted.forEach(ach => {
    const card = createAchievementCard(ach);
    container.appendChild(card);
  });

  // Update stats
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const statsEl = document.getElementById('achievements-stats');
  if (statsEl) {
    statsEl.textContent = `${unlockedCount} / ${totalCount} freigeschaltet`;
  }
}

/**
 * Shows the achievements modal/panel
 */
export function showAchievementsPanel(): void {
  if (!isInitialized) {
    initializeAchievementsUI();
  }

  const modal = document.getElementById('achievements-modal');
  if (modal) {
    modal.classList.remove('hidden');
    renderAchievements();
  }
}

/**
 * Hides the achievements modal/panel
 */
export function hideAchievementsPanel(): void {
  const modal = document.getElementById('achievements-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Initializes the achievements UI
 */
function initializeAchievementsUI(): void {
  if (isInitialized) return;

  // Create modal if it doesn't exist
  let modal = document.getElementById('achievements-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'achievements-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>🏆 Erfolge</h2>
          <button class="modal-close" id="achievements-close-btn" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body">
          <div id="achievements-stats" class="achievements-stats">0 / 0 freigeschaltet</div>
          <div id="achievements-container" class="achievements-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  achievementsContainer = document.getElementById('achievements-container');

  // Close button
  const closeBtn = document.getElementById('achievements-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideAchievementsPanel);
  }

  // Close on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      hideAchievementsPanel();
    }
  });

  // ESC key to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      hideAchievementsPanel();
    }
  });

  isInitialized = true;
  logger.info('[AchievementUI] Initialized');
}

/**
 * Adds a button to the main menu to open achievements
 */
export function addAchievementsButton(): void {
  const mainMenu = document.getElementById('main-menu');
  if (!mainMenu) return;

  // Check if button already exists
  if (document.getElementById('achievements-menu-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'achievements-menu-btn';
  btn.className = 'menu-btn';
  btn.textContent = '🏆 Erfolge';
  btn.addEventListener('click', showAchievementsPanel);

  // Insert before the last button (usually Settings/Info)
  const buttons = mainMenu.querySelectorAll('.menu-btn');
  if (buttons.length > 0) {
    const lastBtn = buttons[buttons.length - 1];
    mainMenu.insertBefore(btn, lastBtn);
  } else {
    mainMenu.appendChild(btn);
  }
}

// Auto-add button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addAchievementsButton);
} else {
  addAchievementsButton();
}
