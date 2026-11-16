import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignManager } from '../../js/campaign/CampaignManager.js';
import { festungShop, shopPieceCost } from '../../js/campaign/pfeilschnell.js';
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

describe('Festung shop price', () => {
  const hiring = {
    campaignMode: true,
    currentLevelId: 'boss_1',
    phase: 'SETUP_WHITE_KING',
    playerColor: 'white',
  };

  beforeEach(() => {
    vi.mocked(campaignManager.getLevel).mockReturnValue({ setupType: 'budget' } as never);
    vi.mocked(campaignManager.isTalentUnlocked).mockImplementation(
      (id: string) => id === 'r_festung'
    );
  });

  it('prices the rook at 3 on an Anwerbe-Kapitel', () => {
    expect(festungShop(hiring)).toBe(true);
    expect(shopPieceCost('r', hiring)).toBe(3);
    expect(shopPieceCost('b', hiring)).toBe(3);
  });

  it('leaves the rook at 5 without the talent or off a hiring chapter', () => {
    vi.mocked(campaignManager.isTalentUnlocked).mockReturnValue(false);
    expect(shopPieceCost('r', hiring)).toBe(5);
    vi.mocked(campaignManager.isTalentUnlocked).mockImplementation((id: string) => id === 'r_festung');
    vi.mocked(campaignManager.getLevel).mockReturnValue({ setupType: 'fixed' } as never);
    expect(shopPieceCost('r', hiring)).toBe(5);
  });

  it('writes 3 on the rook button before a purchase', () => {
    document.body.innerHTML = `
      <div id="shop-buttons" class="shop-grid">
        <button class="shop-item" data-piece="r" data-cost="5"><div class="shop-cost">5</div></button>
        <button class="shop-item" data-piece="b" data-cost="3"><div class="shop-cost">3</div></button>
      </div>
      <div id="selected-piece-display"></div>
    `;
    updateShopUI({ ...hiring, points: 30, turn: 'white', selectedShopPiece: null } as never);
    const rook = document.querySelector<HTMLElement>('.shop-item[data-piece="r"]')!;
    expect(rook.dataset.cost).toBe('3');
    expect(rook.querySelector('.shop-cost')!.textContent).toBe('3');
    expect(document.querySelector('.shop-item[data-piece="b"] .shop-cost')!.textContent).toBe('3');
  });
});
