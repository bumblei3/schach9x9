import { campaignManager } from '../campaign/CampaignManager.js';
import { Level } from '../campaign/types.js';
import { CAMPAIGN_PERKS } from '../campaign/campaignData.js';
import { showToast } from './OverlayManager.js';

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
        <div class="campaign-content" style="background: var(--bg-panel); padding: 2rem; border-radius: 1rem; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; position: relative; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
          <div class="menu-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
            <div>
              <h2 style="margin: 0; font-size: 2rem; background: linear-gradient(135deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Kampagne</h2>
              <div id="campaign-gold-display" style="color: #ffd700; font-weight: bold; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; margin-top: 5px;">
                <span>💰</span> <span id="campaign-gold-value">0</span> Gold
              </div>
            </div>
            <div style="display: flex; gap: 1rem;">
              <button id="campaign-army-toggle" class="btn-secondary" style="background: rgba(99,102,241,0.1); color: #818cf8; border-color: rgba(99,102,241,0.2);">⚔️ Deine Armee</button>
              <button id="campaign-shop-toggle" class="btn-secondary" style="background: rgba(255,215,0,0.1); color: #ffd700; border-color: rgba(255,215,0,0.2);">🛒 Shop</button>
              <button id="campaign-close-btn" class="close-icon-btn">×</button>
            </div>
          </div>

          <div id="campaign-main-view">
            <div id="campaign-levels-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem;">
              <!-- Levels injected here -->
            </div>
          </div>

          <div id="campaign-shop-view" class="hidden">
             <div class="shop-header" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
                <button id="campaign-shop-back" class="btn-icon">←</button>
                <h3 style="margin: 0; color: #ffd700;">Söldner-Shop</h3>
                <p style="margin: 0; opacity: 0.6; font-size: 0.9rem;">Erwirb Vorteile für deine Truppen.</p>
             </div>
             <div id="campaign-perks-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem;">
                <!-- Perks injected here -->
             </div>
          </div>

          <div id="campaign-army-view" class="hidden">
             <div class="army-header" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
                <button id="campaign-army-back" class="btn-icon">←</button>
                <h3 style="margin: 0; color: #818cf8;">Deine Armee</h3>
                <p style="margin: 0; opacity: 0.6; font-size: 0.9rem;">Verbessere deine Einheiten durch Erfahrung.</p>
             </div>
             <div id="campaign-army-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem;">
                <!-- Units injected here -->
             </div>
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

      const shopToggle = document.getElementById('campaign-shop-toggle');
      if (shopToggle) {
        shopToggle.addEventListener('click', () => {
          this.toggleShop(true);
        });
      }

      const shopBack = document.getElementById('campaign-shop-back');
      if (shopBack) {
        shopBack.addEventListener('click', () => {
          this.switchView('levels');
        });
      }

      const armyToggle = document.getElementById('campaign-army-toggle');
      if (armyToggle) {
        armyToggle.addEventListener('click', () => {
          this.switchView('army');
        });
      }

      const armyBack = document.getElementById('campaign-army-back');
      if (armyBack) {
        armyBack.addEventListener('click', () => {
          this.switchView('levels');
        });
      }
    }
    this.container = document.getElementById('campaign-overlay');
  }

  show(): void {
    this.switchView('levels'); // Default to levels
    this.updateGoldDisplay();
    this.renderLevels();
    if (this.container) this.container.classList.remove('hidden');
  }

  hide(): void {
    if (this.container) this.container.classList.add('hidden');
  }

  switchView(view: 'levels' | 'shop' | 'army'): void {
    const mainView = document.getElementById('campaign-main-view');
    const shopView = document.getElementById('campaign-shop-view');
    const armyView = document.getElementById('campaign-army-view');

    if (!mainView || !shopView || !armyView) return;

    mainView.classList.add('hidden');
    shopView.classList.add('hidden');
    armyView.classList.add('hidden');

    if (view === 'shop') {
      shopView.classList.remove('hidden');
      this.renderPerks();
    } else if (view === 'army') {
      armyView.classList.remove('hidden');
      this.renderArmy();
    } else {
      mainView.classList.remove('hidden');
      this.renderLevels();
    }
  }

  toggleShop(showShop: boolean): void {
    this.switchView(showShop ? 'shop' : 'levels');
  }

  updateGoldDisplay(): void {
    const goldValue = document.getElementById('campaign-gold-value');
    if (goldValue) {
      const gold = campaignManager.getGold() ?? 0;
      goldValue.textContent = gold.toString();
    }
  }

  renderLevels(): void {
    const grid = document.getElementById('campaign-levels-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const levels = campaignManager.getAllLevels();

    levels.forEach((level: Level) => {
      const isUnlocked = campaignManager.isLevelUnlocked(level.id);
      const isCompleted = campaignManager.isLevelCompleted(level.id);
      const stars = campaignManager.getLevelStars(level.id);

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
      const starRating = isCompleted ? `<div class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>` : '';

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
        ${starRating}
        ${isCompleted ? '<div style="margin-top: 0.5rem; color: var(--accent-success); font-weight: bold; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;"><span>🏆</span> Abgeschlossen</div>' : ''}
      `;

      grid.appendChild(btn);
    });
  }

  renderPerks(): void {
    const grid = document.getElementById('campaign-perks-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const unlockedPerks = campaignManager.getUnlockedPerks();

    CAMPAIGN_PERKS.forEach((perk: any) => {
      const isUnlocked = unlockedPerks.includes(perk.id);
      const canAfford = campaignManager.getGold() >= perk.cost;

      const card = document.createElement('div');
      card.className = `perk-card ${isUnlocked ? 'purchased' : 'available'}`;
      card.style.cssText = `
        background: var(--input-bg);
        border: 2px solid ${isUnlocked ? '#ffd700' : 'rgba(255,255,255,0.05)'};
        padding: 1.5rem;
        border-radius: 12px;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        position: relative;
      `;

      card.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">${perk.icon}</div>
        <div style="font-weight: bold; font-size: 1.1rem; color: var(--text-main); line-height: 1.2;">${perk.name}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${perk.description}</div>
        <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
          ${isUnlocked
          ? '<span style="color: #ffd700; font-weight: bold;">AKTIVIERT</span>'
          : `<span style="color: #ffd700; font-weight: bold;">💰 ${perk.cost}</span>`
        }
          ${!isUnlocked
          ? `<button class="buy-perk-btn btn-primary" data-id="${perk.id}" ${canAfford ? '' : 'disabled'} style="padding: 5px 15px; font-size: 0.8rem;">Kaufen</button>`
          : ''
        }
        </div>
      `;

      if (!isUnlocked && canAfford) {
        const buyBtn = card.querySelector('.buy-perk-btn');
        buyBtn?.addEventListener('click', () => {
          this.buyPerk(perk);
        });
      }

      grid.appendChild(card);
    });
  }

  buyPerk(perk: any): void {
    if (campaignManager.isPerkUnlocked(perk.id)) return;

    // Attempt purchase
    if (campaignManager.spendGold(perk.cost)) {
      campaignManager.unlockPerk(perk.id);
      this.updateGoldDisplay();
      this.renderPerks();
      showToast(`${perk.name} erfolgreich gekauft!`, 'success');
    } else {
      showToast(`Nicht genug Gold!`, 'error');
    }
  }

  renderArmy(): void {
    const grid = document.getElementById('campaign-army-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const unitTypes = ['p', 'n', 'b', 'r', 'q', 'k'];
    const names: any = { p: 'Infanterie (Bauer)', n: 'Kavallerie (Springer)', b: 'Priester (Läufer)', r: 'Burgwache (Turm)', q: 'General (Dame)', k: 'König (Anführer)' };
    const icons: any = { p: '🛡️', n: '🐎', b: '✨', r: '🏰', q: '👑', k: '🔱' };

    const state = (campaignManager as any).state;

    unitTypes.forEach(type => {
      const xp = campaignManager.getUnitXp(type);
      const isChampion = state.championType === type;

      const card = document.createElement('div');
      card.className = `army-unit-card ${isChampion ? 'is-champion' : ''}`;
      card.style.cssText = `
        background: var(--input-bg);
        border: 2px solid ${isChampion ? '#f59e0b' : 'rgba(255,255,255,0.05)'};
        padding: 1.5rem;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        position: relative;
        box-shadow: ${isChampion ? '0 0 15px rgba(245,158,11,0.3)' : 'none'};
      `;

      const nextLevelXp = xp.level * 100;
      const progressPercent = Math.min(100, (xp.xp / nextLevelXp) * 100);

      card.innerHTML = `
        ${isChampion ? '<div style="position: absolute; top: 10px; right: 10px; font-size: 1.2rem;">👑</div>' : ''}
        <div style="font-size: 2rem; margin-bottom: 0.2rem;">${icons[type]}</div>
        <div style="font-weight: bold; font-size: 1.1rem; color: var(--text-main);">${names[type]}</div>
        <div style="font-size: 0.85rem; color: #818cf8; font-weight: bold;">LEVEL ${xp.level} ${xp.level >= 2 ? (xp.level >= 3 ? '(ELITE)' : '(VETERAN)') : ''}</div>
        
        <div class="xp-bar-container" style="background: rgba(0,0,0,0.3); height: 8px; border-radius: 4px; margin-top: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
           <div class="xp-bar-fill" style="background: linear-gradient(90deg, #818cf8, #6366f1); height: 100%; width: ${progressPercent}%;"></div>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 2px;">
           <span>${xp.xp} XP</span>
           <span>nächstes Level: ${nextLevelXp}</span>
        </div>

        <div style="margin-top: auto; padding-top: 1rem; display: flex; flex-direction: column; gap: 8px;">
           <button class="champion-btn btn-secondary" 
                   style="width: 100%; font-size: 0.8rem; border-color: ${isChampion ? '#f59e0b' : 'rgba(255,255,255,0.1)'}; color: ${isChampion ? '#f59e0b' : 'inherit'};"
                   ${isChampion ? 'disabled' : ''}>
             ${isChampion ? 'DEIN CHAMPION' : 'ALS CHAMPION WÄHLEN'}
           </button>
           <button class="talents-btn btn-secondary" style="width: 100%; font-size: 0.8rem; border-color: rgba(78, 205, 196, 0.3); color: #4ecdc4;">
             🔮 TALENTBAUM
           </button>
        </div>
      `;

      if (!isChampion) {
        const btn = card.querySelector('.champion-btn');
        btn?.addEventListener('click', () => {
          campaignManager.setChampion(type);
          this.renderArmy();
          showToast(`${names[type]} ist jetzt dein Champion!`, 'success');
        });
      }

      const talentsBtn = card.querySelector('.talents-btn');
      talentsBtn?.addEventListener('click', () => {
        import('./TalentTreeUI.js').then(module => {
          module.talentTreeUI.show(type);
        });
      });

      grid.appendChild(card);
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
