import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TalentTreeUI } from '../../js/ui/TalentTreeUI';
import { campaignManager } from '../../js/campaign/CampaignManager';
// @ts-ignore
import { showModal, showToast } from '../../js/ui/OverlayManager';

// Mock dependencies
vi.mock('../../js/campaign/CampaignManager', () => ({
  campaignManager: {
    getGold: vi.fn(() => 1000),
    getUnitXp: vi.fn(() => ({ level: 5, xp: 0, captures: 10 })),
    isTalentUnlocked: vi.fn(() => false),
    unlockTalent: vi.fn(() => true),
  },
}));

vi.mock('../../js/ui/OverlayManager', () => ({
  showModal: vi.fn(),
  showToast: vi.fn(),
}));

// Mock talents data if needed, or rely on real data if stable.
// Relying on real data (UNIT_TALENT_TREES) is better for integration-like unit test,
// ensuring we test against actual structure.

describe('TalentTreeUI', () => {
  let talentTreeUI: TalentTreeUI;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    // Reset singleton or new instance if exported class is not singleton-only
    // The module exports a singleton instance `talentTreeUI` but also the class.
    // We can instantiate the class to test isolation.
    talentTreeUI = new TalentTreeUI();

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should show modal with tabs and content', () => {
    talentTreeUI.show();
    expect(showModal).toHaveBeenCalled();
    const modalContent = (showModal as any).mock.calls[0][1];
    expect(modalContent).toContain('id="talent-ui-root"');
  });

  it('should render correct unit tabs', () => {
    // We need to simulate the DOM created by showModal to test subsequent rendering
    // since showModal is mocked, we must manually inject content if we want to query it,
    // OR we just test what `renderContent` returns if it was public/accessible.
    // However, `renderTabs` searches for `#talent-tabs` in document.

    // Let's inject the container that `showModal` would have put in DOM
    document.body.innerHTML = `
      <div id="talent-tabs"></div>
      <div id="talent-tree-view"></div>
      <div id="talent-info"></div>
      <div id="talent-gold"></div>
      <div id="unit-title"></div>
    `;

    // Access private method or call public show which triggers it via setTimeout 0
    // We can cast to any to call private methods for unit testing internal logic
    (talentTreeUI as any).renderTabs();

    const tabs = document.querySelectorAll('.talent-tab');
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs[0].textContent).toContain('Bauer'); // 'p' is usually first
  });

  it('should render talent tree nodes', () => {
    document.body.innerHTML = `
      <div id="talent-tabs"></div>
      <div id="talent-tree-view"></div>
      <div id="talent-info"></div>
      <div id="talent-gold"></div>
      <div id="unit-title"></div>
    `;

    // Ensure we are on a unit with talents (e.g. 'p')
    (talentTreeUI as any).currentUnitType = 'p';
    (talentTreeUI as any).renderTree();

    const treeContainer = document.getElementById('talent-tree-view');
    const nodes = treeContainer?.querySelectorAll('.talent-node');

    expect(nodes?.length).toBeGreaterThan(0);
    // Check if tiers are rendered
    expect(treeContainer?.innerHTML).toContain('Tier 1');
  });

  it('should select talent and show info', () => {
    document.body.innerHTML = `
      <div id="talent-tabs"></div>
      <div id="talent-tree-view"></div>
      <div id="talent-info"></div>
      <div id="talent-gold"></div>
      <div id="unit-title"></div>
    `;

    (talentTreeUI as any).currentUnitType = 'p';
    // 'p_scavenger' is a known talent ID from talents.ts
    const talentId = 'p_scavenger';

    (talentTreeUI as any).selectTalent(talentId);

    const infoPanel = document.getElementById('talent-info');
    expect(infoPanel?.innerHTML).toContain('Plünderer');
    expect(infoPanel?.innerHTML).toContain('Lernen'); // Should show buy button
  });

  it('should handle talent purchase', () => {
    // Setup generic DOM
    document.body.innerHTML = `
      <div id="talent-info"></div>
    `;

    (talentTreeUI as any).currentUnitType = 'p';
    const talentId = 'p_scavenger';

    // Call select to render button
    (talentTreeUI as any).selectTalent(talentId);

    const buyBtn = document.querySelector('.buy-talent-btn') as HTMLElement;
    expect(buyBtn).toBeTruthy();

    buyBtn.click();

    expect(campaignManager.unlockTalent).toHaveBeenCalledWith('p', talentId, 50);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('erlernt'), 'success');
  });

  it('should switch unit tabs', () => {
    document.body.innerHTML = `
      <div id="talent-tabs"></div>
      <div id="talent-tree-view"></div>
      <div id="talent-info"></div>
      <div id="talent-gold"></div>
      <div id="unit-title"></div>
    `;

    (talentTreeUI as any).renderTabs();

    // Find tab for Knight ('n')
    const knightTab = document.querySelector('[data-unit="n"]') as HTMLElement;
    expect(knightTab).toBeTruthy();

    knightTab.click();

    expect((talentTreeUI as any).currentUnitType).toBe('n');
    // Title should update
    const title = document.getElementById('unit-title');
    expect(title?.textContent).toContain('Talente');
  });
});
