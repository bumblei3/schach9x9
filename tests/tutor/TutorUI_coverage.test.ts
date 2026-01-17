import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as TutorUI from '../../js/ui/TutorUI.js';

vi.mock('../../js/ui/ShopUI.js', () => ({
  updateShopUI: vi.fn(),
}));

describe('TutorUI Coverage', () => {
  let mockGame: any;
  let container: any;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="tutor-panel" class="hidden">
        <div id="tutor-suggestions"></div>
      </div>
      <div id="tutor-recommendations-container"></div>
      <button id="toggle-tutor-recommendations" data-initialized="false"></button>
      <div id="tutor-recommendations-section"></div>
    `;
    container = document.getElementById('tutor-recommendations-container');

    // Mock Game
    mockGame = {
      phase: 'PLAY',
      tutorController: {
        getSetupTemplates: vi.fn().mockReturnValue([
          {
            id: 'defensive',
            name: 'Defensive Festung',
            pieces: ['r', 'k', 'r'],
            isRecommended: true,
            description: 'Stabil',
          },
        ]),
        getTutorHints: vi.fn().mockResolvedValue([]),
        applySetupTemplate: vi.fn(),
      },
      getTutorHints: vi.fn().mockResolvedValue([]), // Required by TutorUI logic line 304
      turn: 'white',
      initialPoints: 40,
      analyzeMoveWithExplanation: vi.fn(),
      executeMove: vi.fn(),
      arrowRenderer: { clearArrows: vi.fn(), highlightMoves: vi.fn() },
    };

    vi.clearAllMocks();
  });

  describe('updateTutorRecommendations (Setup Header)', () => {
    it('should display templates in setup phase', () => {
      mockGame.phase = 'SETUP_WHITE_PIECES';

      TutorUI.updateTutorRecommendations(mockGame);

      expect(container.children.length).toBeGreaterThan(0);
      expect(container.innerHTML).toContain('Defensive Festung');
      expect(mockGame.tutorController.getSetupTemplates).toHaveBeenCalled();
    });

    it('should hide section if not in setup phase', () => {
      mockGame.phase = 'PLAY';
      const section = document.getElementById('tutor-recommendations-section');

      TutorUI.updateTutorRecommendations(mockGame);

      expect(section!.classList.contains('hidden')).toBe(true);
    });

    it('should handle template click', () => {
      mockGame.phase = 'SETUP_WHITE_PIECES';
      TutorUI.updateTutorRecommendations(mockGame);

      const card = container.querySelector('.setup-template-card') as HTMLElement;
      card.click();

      expect(mockGame.tutorController.applySetupTemplate).toHaveBeenCalledWith('defensive');
    });
  });

  describe('showTutorSuggestions - Setup Overlay', () => {
    beforeEach(() => {
      // Remove panel to force overlay path
      const panel = document.getElementById('tutor-panel');
      if (panel) panel.remove();
    });

    it('should show overlay with setups if in setup phase', async () => {
      mockGame.phase = 'SETUP_WHITE_PIECES';

      await TutorUI.showTutorSuggestions(mockGame);

      const overlay = document.getElementById('tutor-overlay')!;
      expect(overlay).not.toBeNull();
      expect(overlay.classList.contains('hidden')).toBe(false);
      expect(overlay.innerHTML).toContain('Defensive Festung');
    });

    it('should handle template click in overlay', async () => {
      mockGame.phase = 'SETUP_WHITE_PIECES';
      await TutorUI.showTutorSuggestions(mockGame);

      // Spy on confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const overlay = document.getElementById('tutor-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay!.classList.contains('hidden')).toBe(false);

      const card = document.querySelector('#tutor-hints-body .setup-template-card') as HTMLElement;
      expect(card).not.toBeNull();
      card.click();

      expect(mockGame.tutorController.applySetupTemplate).toHaveBeenCalledWith('defensive');
    });
  });

  describe('showTutorSuggestions - Play Phase', () => {
    it('should return early if no hints', async () => {
      (mockGame.tutorController.getTutorHints as any).mockResolvedValue([]);

      await TutorUI.showTutorSuggestions(mockGame);

      const suggestionsEl = document.getElementById('tutor-suggestions')!;
      expect(suggestionsEl.innerHTML).toContain('Keine Vorschläge');
    });

    it('should render hints with details button', async () => {
      const hint = {
        move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
        score: 150,
        notation: 'a1-b2',
        analysis: {
          category: 'good',
          qualityLabel: 'Guter Zug',
          questions: ['Warum gut?'],
          tacticalExplanations: ['Gabel!'],
          strategicExplanations: [],
          warnings: [],
        },
      };
      mockGame.getTutorHints = vi.fn().mockResolvedValue([hint]);
      mockGame.tutorController.getTutorHints = vi.fn().mockResolvedValue([hint]); // Fallback check in code logic might direct call

      await TutorUI.showTutorSuggestions(mockGame);

      // Play phase uses 'tutor-suggestions' in panel
      const panel = document.getElementById('tutor-suggestions')!;

      expect(panel.innerHTML).toContain('Guter Zug');
      expect(panel.innerHTML).toContain('Warum gut?');

      const showBtn = panel.querySelector('.show-details-btn') as HTMLElement;
      expect(showBtn).not.toBeNull();

      showBtn.click();
      // Details should be toggled (removed hidden class typically)
      const details = panel.querySelector('.suggestion-details')!;
      expect(details.classList.contains('hidden')).toBe(false);
    });
  });
});
