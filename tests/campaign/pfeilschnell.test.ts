import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignManager } from '../../js/campaign/CampaignManager.js';
import { pfeilschnellShop, shopPieceCost } from '../../js/campaign/pfeilschnell.js';
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

describe('Pfeilschnell shop price', () => {
  const hiring = {
    campaignMode: true,
    currentLevelId: 'boss_1',
    phase: 'SETUP_WHITE_KING',
    playerColor: 'white',
  };

  beforeEach(() => {
    vi.mocked(campaignManager.getLevel).mockReturnValue({ setupType: 'budget' } as never);
    vi.mocked(campaignManager.isTalentUnlocked).mockImplementation(
      (id: string) => id === 'b_pfeilschnell'
    );
  });

  it('prices the bishop at 2 on an Anwerbe-Kapitel', () => {
    expect(pfeilschnellShop(hiring)).toBe(true);
    expect(shopPieceCost('b', hiring)).toBe(2);
    expect(shopPieceCost('n', hiring)).toBe(3);
  });

  it('leaves the bishop at 3 without the talent or off a hiring chapter', () => {
    vi.mocked(campaignManager.isTalentUnlocked).mockReturnValue(false);
    expect(shopPieceCost('b', hiring)).toBe(3);
    vi.mocked(campaignManager.isTalentUnlocked).mockImplementation(
      (id: string) => id === 'b_pfeilschnell'
    );
    vi.mocked(campaignManager.getLevel).mockReturnValue({ setupType: 'fixed' } as never);
    expect(shopPieceCost('b', hiring)).toBe(3);
  });

  it('writes 2 on the bishop button before a purchase', () => {
    document.body.innerHTML = `
      <div id="shop-buttons" class="shop-grid">
        <button class="shop-item" data-piece="b" data-cost="3"><div class="shop-cost">3</div></button>
        <button class="shop-item" data-piece="n" data-cost="3"><div class="shop-cost">3</div></button>
      </div>
      <div id="selected-piece-display"></div>
    `;
    updateShopUI({ ...hiring, points: 30, turn: 'white', selectedShopPiece: null } as never);
    const bishop = document.querySelector<HTMLElement>('.shop-item[data-piece="b"]')!;
    expect(bishop.dataset.cost).toBe('2');
    expect(bishop.querySelector('.shop-cost')!.textContent).toBe('2');
    expect(document.querySelector('.shop-item[data-piece="n"] .shop-cost')!.textContent).toBe('3');
  });
});
