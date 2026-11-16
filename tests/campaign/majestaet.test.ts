import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignManager } from '../../js/campaign/CampaignManager.js';
import { majestaetShop, shopPieceCost } from '../../js/campaign/pfeilschnell.js';
import { updateShopUI } from '../../js/ui/ShopUI.js';

vi.mock('../../js/campaign/CampaignManager.js', () => ({
  campaignManager: {
    getLevel: vi.fn(),
    isTalentUnlocked: vi.fn(() => false),
  },
}));

vi.mock('../../js/ui/TutorUI.js', () => ({
  updateTutorRecommendations: vi.fn(),
}));

describe('Majestät shop price', () => {
  const hiring = {
    campaignMode: true,
    currentLevelId: 'boss_1',
    phase: 'SETUP_WHITE_KING',
    playerColor: 'white',
  };

  beforeEach(() => {
    vi.mocked(campaignManager.getLevel).mockReturnValue({ setupType: 'budget' } as never);
    vi.mocked(campaignManager.isTalentUnlocked).mockImplementation(
      (id: string) => id === 'q_majestaet'
    );
  });

  it('prices the queen at 7 on an Anwerbe-Kapitel', () => {
    expect(majestaetShop(hiring)).toBe(true);
    expect(shopPieceCost('q', hiring)).toBe(7);
    expect(shopPieceCost('r', hiring)).toBe(5);
  });

  it('leaves the queen at 9 without the talent or off a hiring chapter', () => {
    vi.mocked(campaignManager.isTalentUnlocked).mockReturnValue(false);
    expect(shopPieceCost('q', hiring)).toBe(9);
    vi.mocked(campaignManager.isTalentUnlocked).mockImplementation(
      (id: string) => id === 'q_majestaet'
    );
    vi.mocked(campaignManager.getLevel).mockReturnValue({ setupType: 'fixed' } as never);
    expect(shopPieceCost('q', hiring)).toBe(9);
  });

  it('writes 7 on the queen button before a purchase', () => {
    document.body.innerHTML = `
      <div id="shop-buttons" class="shop-grid">
        <button class="shop-item" data-piece="q" data-cost="9"><div class="shop-cost">9</div></button>
        <button class="shop-item" data-piece="r" data-cost="5"><div class="shop-cost">5</div></button>
      </div>
      <div id="selected-piece-display"></div>
    `;
    updateShopUI({ ...hiring, points: 30, turn: 'white', selectedShopPiece: null } as never);
    const queen = document.querySelector<HTMLElement>('.shop-item[data-piece="q"]')!;
    expect(queen.dataset.cost).toBe('7');
    expect(queen.querySelector('.shop-cost')!.textContent).toBe('7');
    expect(document.querySelector('.shop-item[data-piece="r"] .shop-cost')!.textContent).toBe('5');
  });
});
