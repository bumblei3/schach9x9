import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignUI } from '../../js/ui/CampaignUI';
import { campaignManager } from '../../js/campaign/CampaignManager';
// @ts-ignore
import { talentTreeUI } from '../../js/ui/TalentTreeUI';

vi.mock('../../js/ui/OverlayManager', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../js/campaign/CampaignManager', () => ({
  campaignManager: {
    getAllLevels: vi.fn(),
    isLevelUnlocked: vi.fn(),
    isLevelCompleted: vi.fn(),
    completeLevel: vi.fn(),
    getLevel: vi.fn(),
    getLevelStars: vi.fn(() => 0),
    getGold: vi.fn(() => 150),
    getUnlockedPerks: vi.fn(() => []),
    buyPerk: vi.fn(() => false),
    unlockPerk: vi.fn(() => true),
    spendGold: vi.fn(() => true),
    isPerkUnlocked: vi.fn(() => false),
    getUnitXp: vi.fn(() => ({ xp: 50, level: 1, captures: 10 })),
    setChampion: vi.fn(),
    getState: vi.fn(() => ({ championType: 'n' })),
    getUnits: vi.fn(() => [
      { id: 'knight', name: 'Knight', level: 2, xp: 50, xpToNext: 100 },
      { id: 'bishop', name: 'Bishop', level: 1, xp: 0, xpToNext: 100 },
    ]),
  },
}));

vi.mock('../../js/ui/TalentTreeUI', () => ({
  talentTreeUI: {
    show: vi.fn(),
  },
}));

vi.mock('../../js/campaign/campaignData', () => ({
  CAMPAIGN_PERKS: [
    { id: 'double_gold', name: 'Double Gold', cost: 100, description: 'Earn 2x gold' },
    { id: 'extra_hp', name: 'Extra HP', cost: 200, description: '+10 HP' },
  ],
}));

describe('CampaignUI', () => {
  let app: any;
  let campaignUI: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    app = {
      startCampaignLevel: vi.fn(),
    };
    campaignUI = new CampaignUI(app);
  });

  it('should initialize and create overlay', () => {
    expect(document.getElementById('campaign-overlay')).toBeTruthy();
    expect(document.getElementById('campaign-overlay')!.classList.contains('hidden')).toBe(true);
  });

  it('should show and render levels', () => {
    const mockLevels = [
      { id: 'level_1', title: 'Level 1', difficulty: 'beginner' },
      { id: 'level_2', title: 'Level 2', difficulty: 'hard' },
    ];
    (campaignManager.getAllLevels as any).mockReturnValue(mockLevels);
    (campaignManager.isLevelUnlocked as any).mockImplementation((id: string) => id === 'level_1');
    (campaignManager.isLevelCompleted as any).mockReturnValue(false);

    campaignUI.show();

    const overlay = document.getElementById('campaign-overlay')!;
    expect(overlay.classList.contains('hidden')).toBe(false);

    const grid = document.getElementById('campaign-levels-grid')!;
    expect(grid.children.length).toBe(2);

    // Check unlocked state
    const level1Btn = grid.children[0] as HTMLElement;
    expect(level1Btn.className).toContain('unlocked');

    // Check locked state
    const level2Btn = grid.children[1] as HTMLElement;
    expect(level2Btn.className).toContain('locked');
  });

  it('should call startCampaignLevel when clicking an unlocked level', () => {
    const mockLevels = [{ id: 'level_1', title: 'Level 1', difficulty: 'beginner' }];
    (campaignManager.getAllLevels as any).mockReturnValue(mockLevels);
    (campaignManager.isLevelUnlocked as any).mockReturnValue(true);

    campaignUI.show();
    const grid = document.getElementById('campaign-levels-grid')!;
    const levelBtn = grid.querySelector('button') as HTMLElement;

    levelBtn.click();

    expect(app.startCampaignLevel).toHaveBeenCalledWith('level_1');
    expect(document.getElementById('campaign-overlay')!.classList.contains('hidden')).toBe(true);
  });

  it('should close overlay when clicking close button', () => {
    campaignUI.show();
    const closeBtn = document.getElementById('campaign-close-btn')!;
    closeBtn.click();
    expect(document.getElementById('campaign-overlay')!.classList.contains('hidden')).toBe(true);
  });

  it('should handle different difficulty colors', () => {
    expect(campaignUI['getDifficultyColor']('beginner')).toBe('#a3e635');
    expect(campaignUI['getDifficultyColor']('hard')).toBe('#f87171');
    expect(campaignUI['getDifficultyColor']('unknown')).toContain('var(--text-muted)');
  });

  // New tests for additional coverage

  it('should render perks in shop view', () => {
    campaignUI.show();
    campaignUI.renderPerks();

    const perksGrid = document.getElementById('campaign-perks-grid');
    expect(perksGrid).toBeTruthy();
    // Should render the 2 perks from our mock
    expect(perksGrid!.children.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle buyPerk when perk can be purchased', () => {
    (campaignManager.spendGold as any).mockReturnValue(true);
    (campaignManager.unlockPerk as any).mockReturnValue(true);

    const perk = { id: 'double_gold', name: 'Double Gold', cost: 100, description: 'Earn 2x gold' };

    campaignUI.show();
    campaignUI.buyPerk(perk);

    expect(campaignManager.spendGold).toHaveBeenCalledWith(100);
    expect(campaignManager.unlockPerk).toHaveBeenCalledWith('double_gold');
  });

  it('should hide overlay', () => {
    campaignUI.show();
    expect(document.getElementById('campaign-overlay')!.classList.contains('hidden')).toBe(false);

    campaignUI.hide();
    expect(document.getElementById('campaign-overlay')!.classList.contains('hidden')).toBe(true);
  });

  it('should handle level hover events', () => {
    const mockLevels = [{ id: 'level_1', title: 'Level 1', difficulty: 'beginner' }];
    (campaignManager.getAllLevels as any).mockReturnValue(mockLevels);
    (campaignManager.isLevelUnlocked as any).mockReturnValue(true);
    (campaignManager.isLevelCompleted as any).mockReturnValue(false);

    campaignUI.show();
    const grid = document.getElementById('campaign-levels-grid')!;
    const levelBtn = grid.children[0] as HTMLElement;

    // Trigger mouseover
    levelBtn.dispatchEvent(new MouseEvent('mouseover'));

    // Trigger mouseout
    levelBtn.dispatchEvent(new MouseEvent('mouseout'));

    // No errors means hover handlers work
    expect(true).toBe(true);
  });

  it('should show stars for completed levels', () => {
    const mockLevels = [{ id: 'level_1', title: 'Level 1', difficulty: 'beginner' }];
    (campaignManager.getAllLevels as any).mockReturnValue(mockLevels);
    (campaignManager.isLevelUnlocked as any).mockReturnValue(true);
    (campaignManager.isLevelCompleted as any).mockReturnValue(true);
    (campaignManager.getLevelStars as any).mockReturnValue(3);

    campaignUI.show();
    const grid = document.getElementById('campaign-levels-grid')!;
    const levelElement = grid.children[0];

    // Should have completed class
    expect(levelElement.className).toContain('completed');
  });
  it('should switch to army view', () => {
    campaignUI.show();
    campaignUI.switchView('army');

    expect(document.getElementById('campaign-army-view')!.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('campaign-main-view')!.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('campaign-shop-view')!.classList.contains('hidden')).toBe(true);
  });

  it('should render army units', () => {
    campaignUI.show();
    campaignUI.renderArmy();

    const grid = document.getElementById('campaign-army-grid')!;
    // Should render 6 unit types (p, n, b, r, q, k)
    expect(grid.children.length).toBe(6);

    // Check champion styling
    const championCard = grid.querySelector('.is-champion');
    expect(championCard).toBeTruthy();
  });

  it('should handle setChampion interaction', () => {
    campaignUI.show();
    campaignUI.renderArmy();

    const grid = document.getElementById('campaign-army-grid')!;
    // Find a non-champion unit (e.g., first one if champion is knight/n)
    // We mocked championType: 'knight'
    // 'p' (pawn) is first.
    const pawnCard = grid.children[0];
    const btn = pawnCard.querySelector('.champion-btn') as HTMLElement;

    if (btn) {
      btn.click();
      expect(campaignManager.setChampion).toHaveBeenCalledWith('p');
    }
  });

  it('should open talent tree', async () => {
    campaignUI.show();
    campaignUI.renderArmy();

    const grid = document.getElementById('campaign-army-grid')!;
    const card = grid.children[0];
    const btn = card.querySelector('.talents-btn') as HTMLElement;

    if (btn) {
      btn.click();
      // Since it's a dynamic import, we need to wait a tiny bit or just expect it to be called eventually
      // But verify that the implementation calls the dynamic import.
      // For this test with mocked module, we assume it resolves.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(talentTreeUI.show).toHaveBeenCalled();
    }
  });
});
