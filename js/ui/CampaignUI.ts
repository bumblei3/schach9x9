import { campaignManager } from '../campaign/CampaignManager.js';
import { Level } from '../campaign/types.js';

export class CampaignUI {
  app: any;
  container: HTMLElement | null = null;

  constructor(app: any) {
    this.app = app;
    this.init();
  }

  init(): void {
    if (!document.getElementById('campaign-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'campaign-overlay';
      overlay.className = 'fullscreen-overlay hidden';
      overlay.innerHTML = `
        <div class="campaign-content" style="background: var(--bg-panel); padding: 2rem; border-radius: 1rem; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative;">
          <div class="menu-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>Kampagne</h2>
            <button id="campaign-close-btn" class="close-icon-btn">×</button>
          </div>
          <div id="campaign-levels-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
            <!-- Levels injected here -->
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const closeBtn = document.getElementById('campaign-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.hide();
        });
      }
    }
    this.container = document.getElementById('campaign-overlay');
  }

  show(): void {
    this.renderLevels();
    if (this.container) this.container.classList.remove('hidden');
  }

  hide(): void {
    if (this.container) this.container.classList.add('hidden');
  }

  renderLevels(): void {
    const grid = document.getElementById('campaign-levels-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const levels = campaignManager.getAllLevels();

    levels.forEach((level: Level) => {
      const isUnlocked = campaignManager.isLevelUnlocked(level.id);
      const isCompleted = campaignManager.isLevelCompleted(level.id);

      const btn = document.createElement('button');
      btn.className = `campaign-level-card ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`;

      btn.style.cssText = `
        background: ${isUnlocked ? 'var(--input-bg)' : '#1a1a2e'};
        border: 2px solid ${isCompleted ? 'var(--accent-success)' : 'rgba(255,255,255,0.05)'};
        padding: 1.5rem;
        border-radius: 16px;
        text-align: left;
        cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
        opacity: ${isUnlocked ? '1' : '0.4'};
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      `;

      if (isUnlocked) {
        btn.onmouseover = () => {
          btn.style.borderColor = 'var(--accent-primary)';
          btn.style.transform = 'translateY(-5px)';
          btn.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
        };
        btn.onmouseout = () => {
          btn.style.borderColor = isCompleted ? 'var(--accent-success)' : 'rgba(255,255,255,0.05)';
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        };
        btn.onclick = () => {
          this.hide();
          if (this.app.startCampaignLevel) {
            this.app.startCampaignLevel(level.id);
          }
        };
      }

      const statusIcon = isCompleted ? '✅' : isUnlocked ? '⚔️' : '🔒';

      btn.innerHTML = `
        <div class="level-status-badge" style="
            position: absolute; top: 1rem; right: 1rem; 
            font-size: 1.2rem; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
        ">${statusIcon}</div>
        <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-primary); opacity: 0.8; margin-bottom: -0.2rem;">
            Mission ${levels.indexOf(level) + 1}
        </div>
        <div style="font-weight: 800; font-size: 1.25rem; color: var(--text-main); line-height: 1.2;">${level.title}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 5px;">
            <span style="opacity: 0.6;">Schwierigkeit:</span>
            <span style="color: ${this.getDifficultyColor(level.difficulty)}; font-weight: bold;">${level.difficulty.toUpperCase()}</span>
        </div>
        ${isCompleted ? '<div style="margin-top: 0.5rem; color: var(--accent-success); font-weight: bold; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;"><span>🏆</span> Abgeschlossen</div>' : ''}
      `;

      grid.appendChild(btn);
    });
  }

  private getDifficultyColor(diff: string): string {
    switch (diff) {
      case 'beginner':
        return '#a3e635';
      case 'easy':
        return '#4ade80';
      case 'medium':
        return '#fbbf24';
      case 'hard':
        return '#f87171';
      case 'expert':
        return '#c084fc';
      default:
        return 'var(--text-muted)';
    }
  }
}
