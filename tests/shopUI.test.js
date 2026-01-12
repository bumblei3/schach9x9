

// Mock config
vi.mock('../js/config.js', () => ({
  PIECE_VALUES: { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0, a: 800, c: 800, e: 1000 },
}));

// Mock BoardRenderer
vi.mock('../js/ui/BoardRenderer.js', () => ({
  getPieceText: piece => `Piece(${piece.type}, ${piece.color})`,
}));

// Mock TutorUI
vi.mock('../js/ui/TutorUI.js', () => ({
  updateTutorRecommendations: vi.fn(),
}));

const ShopUI = await import('../js/ui/ShopUI.js');
const { updateTutorRecommendations } = await import('../js/ui/TutorUI.js');

describe('ShopUI', () => {
  let game;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="shop-panel" class="hidden"></div>
      <div id="points-display"></div>
      <div id="tutor-points-display"></div>
      <div id="selected-piece-display"></div>
      <button id="finish-setup-btn"></button>
      <div class="shop-item" data-cost="100"></div>
      <div class="shop-item" data-cost="500"></div>
    `;

    game = {
      points: 200,
      tutorPoints: 50,
      turn: 'white',
      selectedShopPiece: null,
    };

    window.updateTutorRecommendations = updateTutorRecommendations;

    vi.clearAllMocks();
  });

  test('showShop toggles panel and body class', () => {
    ShopUI.showShop(game, true);
    expect(document.getElementById('shop-panel').classList.contains('hidden')).toBe(false);
    expect(document.body.classList.contains('setup-mode')).toBe(true);

    ShopUI.showShop(game, false);
    expect(document.getElementById('shop-panel').classList.contains('hidden')).toBe(true);
    expect(document.body.classList.contains('setup-mode')).toBe(false);
  });

  test('updateShopUI updates displays and item states', () => {
    ShopUI.updateShopUI(game);

    expect(document.getElementById('points-display').textContent).toBe('200');
    expect(document.getElementById('tutor-points-display').textContent).toBe('50');

    const items = document.querySelectorAll('.shop-item');
    expect(items[0].classList.contains('disabled')).toBe(false); // cost 100 < 200
    expect(items[1].classList.contains('disabled')).toBe(true); // cost 500 > 200

    expect(updateTutorRecommendations).toHaveBeenCalledWith(game);
  });

  test('updateShopUI reflects selected piece', () => {
    game.selectedShopPiece = 'p';
    ShopUI.updateShopUI(game);
    expect(document.getElementById('selected-piece-display').textContent).toContain(
      'Piece(p, white)'
    );

    game.selectedShopPiece = null;
    ShopUI.updateShopUI(game);
    expect(document.getElementById('selected-piece-display').textContent).toBe(
      'Wähle eine Figur zum Kaufen'
    );
  });
});
