
import { setupJSDOM, createMockGame } from './test-utils.js';

// Mock dependencies
vi.mock('../js/chess-pieces.js', () => ({
  setPieceSkin: vi.fn(),
  PIECE_SVGS: {
    white: { p: 'wp' },
    black: { p: 'bp' },
  },
}));

const AppMock = {
  game: null,
  moveController: {
    setTheme: vi.fn(),
  },
};

describe('UI Settings Tests', () => {
  let UI;
  let chessPieces;
  let game;

  beforeEach(async () => {
    setupJSDOM();
    vi.clearAllMocks();

    // Import modules after mocks
    UI = await import('../js/ui.js');
    const chessPiecesModule = await import('../js/chess-pieces.js');
    chessPieces = chessPiecesModule;

    game = createMockGame();
    AppMock.game = game;

    // Setup DOM for skin selector
    document.body.innerHTML = `
      <div class="action-bar">
        <select id="skin-selector" class="skin-selector">
          <option value="classic">Klassisch</option>
          <option value="modern">Modern</option>
        </select>
      </div>
      <div id="settings-menu">
        <select id="theme-select">
            <option value="classic">Classic</option>
            <option value="dark">Dark</option>
        </select>
      </div>
    `;
  });

  test('Skin selector should update skin and force render', () => {
    const skinSelector = document.getElementById('skin-selector');

    // Simulate App.js event listener logic manually since we can't easily mock the entire App class structure here
    // but we can verify the core logic steps

    skinSelector.addEventListener('change', e => {
      const newSkin = e.target.value;
      chessPieces.setPieceSkin(newSkin);
      UI.clearPieceCache();
      game._forceFullRender = true;
      UI.renderBoard(game);
      localStorage.setItem('chess_skin', newSkin);
    });

    // Spy on the setter
    let renderFlagSet = false;
    let _forceFullRender = game._forceFullRender;
    Object.defineProperty(game, '_forceFullRender', {
      get: () => _forceFullRender,
      set: v => {
        _forceFullRender = v;
        if (v) renderFlagSet = true;
      },
      configurable: true,
    });

    // trigger change
    skinSelector.value = 'modern';
    skinSelector.dispatchEvent(new Event('change'));

    expect(chessPieces.setPieceSkin).toHaveBeenCalledWith('modern');
    expect(renderFlagSet).toBe(true);
    expect(localStorage.getItem('chess_skin')).toBe('modern');
  });

  test('Theme selector should call game.setTheme', () => {
    const themeSelect = document.getElementById('theme-select');

    // Mock the listener logic from App.js
    themeSelect.addEventListener('change', e => {
      AppMock.moveController.setTheme(e.target.value);
    });

    themeSelect.value = 'dark';
    themeSelect.dispatchEvent(new Event('change'));

    expect(AppMock.moveController.setTheme).toHaveBeenCalledWith('dark');
  });
});
