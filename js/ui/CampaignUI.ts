import { campaignManager } from '../campaign/CampaignManager.js';

export class CampaignUI {
    app: any;
    container: HTMLElement | null = null;

    constructor(app: any) {
        this.app = app;
        this.init();
    }

    init(): void {
        // Lazy create the overlay
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

        const levels = (campaignManager as any).getAllLevels();

        levels.forEach((level: any) => {
            const btn = document.createElement('button');
            btn.className = `campaign-level-card ${level.unlocked ? 'unlocked' : 'locked'} ${level.completed ? 'completed' : ''}`;

            btn.style.cssText = `
        background: ${level.unlocked ? 'var(--input-bg)' : '#1e1e2e'};
        border: 1px solid ${level.completed ? 'var(--accent-success)' : 'var(--border-color)'};
        padding: 1.5rem;
        border-radius: 12px;
        text-align: left;
        cursor: ${level.unlocked ? 'pointer' : 'not-allowed'};
        opacity: ${level.unlocked ? '1' : '0.5'};
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        transition: transform 0.2s, border-color 0.2s;
      `;

            if (level.unlocked) {
                btn.onmouseover = () => (btn.style.borderColor = 'var(--accent-primary)');
                btn.onmouseout = () =>
                (btn.style.borderColor = level.completed
                    ? 'var(--accent-success)'
                    : 'var(--border-color)');
                btn.onclick = () => {
                    this.hide();
                    this.app.startCampaignLevel(level.id);
                };
            }

            const icon = level.completed ? '✅' : level.unlocked ? '⚔️' : '🔒';

            let starHtml = '';
            if (level.unlocked) {
                starHtml = '<div style="margin-top: auto; color: gold; font-size: 1.2rem;">';
                for (let i = 1; i <= 3; i++) {
                    starHtml += i <= (level.stars || 0) ? '★' : '<span style="color: #444;">☆</span>';
                }
                starHtml += '</div>';
            }

            btn.innerHTML = `
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${icon}</div>
        <div style="font-weight: bold; color: var(--text-main);">${level.title || (level as any).name}</div>
        <div style="font-size: 0.9rem; color: var(--text-muted);">${(level.difficulty || 'unknown').toUpperCase()}</div>
        ${starHtml}
      `;

            grid.appendChild(btn);
        });
    }
}
