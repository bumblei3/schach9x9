import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignUI } from '../../js/ui/CampaignUI';
import { campaignManager } from '../../js/campaign/CampaignManager';

vi.mock('../../js/campaign/CampaignManager', () => ({
  campaignManager: {
    getAllLevels: vi.fn(),
    isLevelUnlocked: vi.fn(),
    isLevelCompleted: vi.fn(),
    completeLevel: vi.fn(),
    getLevel: vi.fn(),
    getLevelStars: vi.fn(() => 0),
    getGold: vi.fn(() => 0),
    getUnlockedPerks: vi.fn(() => []),
    buyPerk: vi.fn(() => false),
  },
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
});
