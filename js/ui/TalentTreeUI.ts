
import { UNIT_TALENT_TREES } from '../campaign/talents.js';
import { campaignManager } from '../campaign/CampaignManager.js';
import { showModal, showToast } from './OverlayManager.js';

export class TalentTreeUI {
    private currentUnitType: string = 'p';

    public show(unitType?: string): void {
        if (unitType) this.currentUnitType = unitType;
        const content = this.renderContent();

        showModal('Einheiten & Talente', content, [
            { text: 'Schließen', class: 'btn-secondary', callback: () => { } }
        ]);

        setTimeout(() => {
            this.renderTabs();
            this.renderTree();
        }, 0);
    }

    private renderContent(): string {
        // Custom width for talent tree
        const style = `<style>
      .talent-tabs { display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px; }
      .talent-tab { padding: 8px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
      .talent-tab.active { background: var(--accent-primary); border-color: var(--accent-highlight); box-shadow: 0 0 10px rgba(78, 205, 196, 0.3); }
      .talent-tab:hover { background: rgba(255,255,255,0.1); }
      
      .talent-tree-container { display: flex; flex-direction: column; gap: 30px; position: relative; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 8px; min-height: 400px; }
      .talent-tier { display: flex; justify-content: center; position: relative; }
      .talent-tier::before { content: attr(data-label); position: absolute; left: 0; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: var(--text-muted); writing-mode: vertical-rl; text-orientation: mixed; }
      
      .talent-node { width: 60px; height: 60px; background: #2a2a2a; border: 2px solid #444; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: all 0.3s; z-index: 2; }
      .talent-node.unlocked { border-color: #ffd700; background: #3a3000; box-shadow: 0 0 15px rgba(255, 215, 0, 0.2); }
      .talent-node.available { border-color: #4ecdc4; animation: pulse-border 2s infinite; }
      .talent-node.locked { opacity: 0.5; filter: grayscale(1); }
      
      .talent-icon { font-size: 1.5rem; }
      
      .talent-connector { position: absolute;width: 2px; background: #444; z-index: 1; }
      /* Simple vertical connectors would need JS calculation or grid, skipping for now */

      .talent-info-panel { height: 120px; padding: 15px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 5px; }
      .talent-name { font-weight: bold; color: #ffd700; font-size: 1.1rem; }
      .talent-desc { font-size: 0.9rem; color: #ccc; }
      .talent-cost { color: #888; font-size: 0.85rem; margin-top: auto; }
      .talent-action { margin-left: auto; }
    </style>`;

        return `
      ${style}
      <div id="talent-ui-root">
        <div class="talent-tabs" id="talent-tabs"></div>
        <div class="talent-header" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <h3 id="unit-title" style="margin: 0;">Einheiten-Talente</h3>
            <div class="player-gold-display">💰 <span id="talent-gold">${campaignManager.getGold()}</span></div>
        </div>
        <div class="talent-tree-container" id="talent-tree-view">
           <!-- Tree nodes go here -->
        </div>
        <div class="talent-info-panel" id="talent-info">
            <div style="text-align: center; color: var(--text-muted); padding-top: 30px;">Wähle ein Talent aus, um Details zu sehen.</div>
        </div>
      </div>
    `;
    }

    private renderTabs(): void {
        const container = document.getElementById('talent-tabs');
        if (!container) return;

        const units = [
            { id: 'p', icon: '♟️', name: 'Bauer' },
            { id: 'n', icon: '♞', name: 'Springer' },
            { id: 'b', icon: '♝', name: 'Läufer' },
            { id: 'r', icon: '♜', name: 'Turm' },
            { id: 'q', icon: '♛', name: 'Dame' },
            { id: 'k', icon: '♚', name: 'König' }
            // Special units can be added later
        ];

        container.innerHTML = units.map(u => `
        <div class="talent-tab ${this.currentUnitType === u.id ? 'active' : ''}" data-unit="${u.id}">
            <span>${u.icon}</span>
            <span>${u.name}</span>
        </div>
    `).join('');

        container.querySelectorAll('.talent-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const unit = (e.currentTarget as HTMLElement).dataset.unit;
                if (unit) {
                    this.currentUnitType = unit;
                    this.renderTabs(); // re-render to update active class
                    this.renderTree();
                }
            });
        });
    }

    private renderTree(): void {
        const container = document.getElementById('talent-tree-view');
        const goldDisplay = document.getElementById('talent-gold');
        const unitTitle = document.getElementById('unit-title');

        if (!container) return;
        if (goldDisplay) goldDisplay.textContent = campaignManager.getGold().toString();

        const tree = UNIT_TALENT_TREES[this.currentUnitType];
        const unitXp = campaignManager.getUnitXp(this.currentUnitType);

        if (unitTitle) unitTitle.textContent = `Talente: Level ${unitXp.level}`;

        if (!tree || tree.talents.length === 0) {
            container.innerHTML = '<div style="margin: auto; color: #888;">Keine Talente verfügbar für diese Einheit.</div>';
            return;
        }

        // Group by tier
        const tiers = [1, 2, 3];
        let html = '';

        tiers.forEach(tier => {
            const talents = tree.talents.filter(t => t.tier === tier);
            if (talents.length > 0) {
                html += `<div class="talent-tier" data-label="Tier ${tier}" style="margin-bottom: 40px; display: flex; gap: 40px; justify-content: center;">`;
                talents.forEach(t => {
                    const isUnlocked = campaignManager.isTalentUnlocked(t.id);
                    // Available if not unlocked, previous tier reqs met (simplified: just level req)
                    // And we could check specific parent dependency if we wanted a real tree connected structure.
                    // For now: Level Requirement is the main gate.
                    const isLevelMet = unitXp.level >= t.reqLevel;
                    const isAvailable = !isUnlocked && isLevelMet;
                    let statusClass = 'locked';
                    if (isUnlocked) statusClass = 'unlocked';
                    else if (isAvailable) statusClass = 'available';

                    html += `
                    <div class="talent-node ${statusClass}" data-id="${t.id}">
                        <div class="talent-icon">${t.icon}</div>
                        ${isUnlocked ? '<div style="position: absolute; bottom: -5px; right: -5px; font-size: 10px;">✅</div>' : ''}
                    </div>
                `;
                });
                html += `</div>`;
            }
        });

        container.innerHTML = html;

        // Attach listeners
        container.querySelectorAll('.talent-node').forEach(node => {
            node.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLElement).dataset.id;
                if (id) this.selectTalent(id);
            });
        });
    }

    private selectTalent(talentId: string): void {
        const tree = UNIT_TALENT_TREES[this.currentUnitType];
        const talent = tree.talents.find(t => t.id === talentId);
        const infoPanel = document.getElementById('talent-info');

        if (!talent || !infoPanel) return;

        const isUnlocked = campaignManager.isTalentUnlocked(talentId);
        const unitXp = campaignManager.getUnitXp(this.currentUnitType);
        const canAfford = campaignManager.getGold() >= talent.cost;
        const levelMet = unitXp.level >= talent.reqLevel;

        let actionButton = '';
        if (isUnlocked) {
            actionButton = '<span style="color: #ffd700; font-weight: bold;">Bereits erlernt</span>';
        } else if (!levelMet) {
            actionButton = `<span style="color: #666;">Benötigt Level ${talent.reqLevel}</span>`;
        } else {
            const btnClass = canAfford ? 'btn-primary' : 'btn-secondary disabled';
            actionButton = `<button class="${btnClass} buy-talent-btn" ${!canAfford ? 'disabled' : ''}>Lernen (${talent.cost} Gold)</button>`;
        }

        infoPanel.innerHTML = `
        <div style="display: flex; gap: 15px; align-items: start;">
            <div style="font-size: 2rem; background: #222; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${talent.icon}</div>
            <div style="flex: 1;">
                <div class="talent-name">${talent.name}</div>
                <div class="talent-desc">${talent.description}</div>
                <div class="talent-cost">Tier ${talent.tier} • Level ${talent.reqLevel}</div>
            </div>
            <div class="talent-action">
                ${actionButton}
            </div>
        </div>
    `;

        const buyBtn = infoPanel.querySelector('.buy-talent-btn');
        if (buyBtn && !buyBtn.hasAttribute('disabled')) {
            buyBtn.addEventListener('click', () => {
                if (campaignManager.unlockTalent(this.currentUnitType, talent.id, talent.cost)) {
                    showToast(`${talent.name} erlernt!`, 'success');
                    this.renderTree(); // refresh status
                    this.selectTalent(talent.id); // refresh logic
                } else {
                    showToast('Nicht genug Gold!', 'error');
                }
            });
        }
    }
}

export const talentTreeUI = new TalentTreeUI();
