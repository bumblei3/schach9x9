import { jest } from '@jest/globals';

// Mock config
jest.unstable_mockModule('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: {
    PLAY: 'play',
    SETUP_WHITE_PIECES: 'setup_white',
    SETUP_BLACK_PIECES: 'setup_black',
  },
  PIECE_VALUES: { p: 100 },
}));

const TutorUI = await import('../../js/ui/TutorUI.js');

describe('TutorUI Component', () => {
  let game;

  beforeEach(() => {
    document.body.innerHTML = `
            <div id="tutor-panel" class="hidden"><div id="tutor-suggestions"></div></div>
            <div id="tutor-recommendations-section" class="hidden">
                <div id="tutor-recommendations-container"></div>
                <button id="toggle-tutor-recommendations"></button>
            </div>
            <div class="suggestion-highlight"></div>
        `;

    game = {
      phase: 'play',
      turn: 'white',
      tutorController: {
        getSetupTemplates: jest.fn(() => [
          {
            id: 'template1',
            name: 'Template 1',
            description: 'Desc 1',
            pieces: ['p', 'n'],
            cost: 10,
          },
        ]),
        applySetupTemplate: jest.fn(),
        getTutorHints: jest.fn(() => [
          {
            move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
            notation: 'a1',
            index: 0,
            analysis: {
              category: 'excellent',
              qualityLabel: 'Top Move',
              tacticalExplanations: ['Tactical'],
              strategicExplanations: ['Strategic'],
              warnings: ['Warning'],
              questions: ['Why?'],
            },
            score: 100,
          },
        ]),
      },
      getTutorHints: jest.fn(() => [
        {
          move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
          notation: 'a1',
          index: 0,
          analysis: {
            category: 'excellent',
            qualityLabel: 'Top Move',
            tacticalExplanations: ['Tactical'],
            strategicExplanations: ['Strategic'],
            warnings: ['Warning'],
            questions: ['Why?'],
          },
          score: 100,
        },
      ]),
      executeMove: jest.fn(),
      analyzeMoveWithExplanation: jest.fn((_move, _score) => ({
        category: 'excellent',
        qualityLabel: 'Top Move',
        tacticalExplanations: [],
        strategicExplanations: [],
        warnings: [],
        questions: [],
      })),
      getScoreDescription: jest.fn(_score => ({
        emoji: '🔥',
        label: 'Super',
        color: '#ff0000',
      })),
      arrowRenderer: {
        clearArrows: jest.fn(),
        highlightMove: jest.fn(),
      },
    };

    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
    window.PIECE_SVGS = null;
  });

  describe('updateTutorRecommendations', () => {
    test('should return if elements are missing', () => {
      document.body.innerHTML = '';
      TutorUI.updateTutorRecommendations(game);
      expect(game.tutorController.getSetupTemplates).not.toHaveBeenCalled();
    });

    test('should hide tutor section if not in setup phase', () => {
      game.phase = 'play';
      TutorUI.updateTutorRecommendations(game);
      const section = document.getElementById('tutor-recommendations-section');
      expect(section.classList.contains('hidden')).toBe(true);
    });

    test('should show tutor section and initialize toggle in setup phase', () => {
      game.phase = 'setup_white';
      TutorUI.updateTutorRecommendations(game);

      const section = document.getElementById('tutor-recommendations-section');
      expect(section.classList.contains('hidden')).toBe(false);

      const toggleBtn = document.getElementById('toggle-tutor-recommendations');
      expect(toggleBtn.dataset.initialized).toBe('true');

      const container = document.getElementById('tutor-recommendations-container');
      container.classList.add('hidden');
      toggleBtn.click();
      expect(container.classList.contains('hidden')).toBe(false);
      expect(toggleBtn.textContent).toContain('ausblenden');

      toggleBtn.click();
      expect(container.classList.contains('hidden')).toBe(true);
      expect(toggleBtn.textContent).toContain('anzeigen');
    });

    test('should render templates correctly for black pieces', () => {
      game.phase = 'setup_black';
      TutorUI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container.children.length).toBe(1);
    });

    test('should render templates with PIECE_SVGS if available', () => {
      window.PIECE_SVGS = { white: { p: '<svg>pawn</svg>', n: '<svg>knight</svg>' } };
      game.phase = 'setup_white';
      TutorUI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container.innerHTML).toContain('<svg>knight</svg>');
    });

    test('should handle missing PIECE_SVGS keys', () => {
      window.PIECE_SVGS = { white: {} }; // Missing 'p' and 'n'
      game.phase = 'setup_white';
      TutorUI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container.textContent).toContain('♞');
    });

    test('should apply template on click after confirmation', () => {
      game.phase = 'setup_white';
      TutorUI.updateTutorRecommendations(game);

      const card = document.querySelector('.setup-template-card');
      card.click();

      expect(window.confirm).toHaveBeenCalled();
      expect(game.tutorController.applySetupTemplate).toHaveBeenCalledWith('template1');
    });

    test('should not apply template if confirmation is cancelled', () => {
      window.confirm = jest.fn(() => false);
      game.phase = 'setup_white';
      TutorUI.updateTutorRecommendations(game);

      const card = document.querySelector('.setup-template-card');
      card.click();

      expect(game.tutorController.applySetupTemplate).not.toHaveBeenCalled();
    });
  });

  describe('showTutorSuggestions', () => {
    test('should show overlay if panel/elements are missing', () => {
      document.body.innerHTML = ''; // Force overlay path
      TutorUI.showTutorSuggestions(game);

      const overlay = document.getElementById('tutor-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.classList.contains('hidden')).toBe(false);

      const hintsBody = document.getElementById('tutor-hints-body');
      expect(hintsBody.children.length).toBe(1);
      expect(hintsBody.textContent).toContain('a1');
    });

    test('should alert in overlay mode if no tutor available', () => {
      document.body.innerHTML = '';
      game.tutorController.getTutorHints = null;
      TutorUI.showTutorSuggestions(game);
      expect(window.alert).toHaveBeenCalledWith('Tutor nicht verfügbar!');
    });

    test('should alert in overlay mode if no hints available', () => {
      document.body.innerHTML = '';
      game.tutorController.getTutorHints = jest.fn(() => []);
      TutorUI.showTutorSuggestions(game);
      expect(window.alert).toHaveBeenCalledWith(
        'Keine Tipps verfügbar! Spiele erst ein paar Züge.'
      );
    });

    test('should close overlay when close button clicked', () => {
      document.body.innerHTML = '';
      TutorUI.showTutorSuggestions(game);
      const closeBtn = document.getElementById('close-tutor-btn');
      closeBtn.click();
      const overlay = document.getElementById('tutor-overlay');
      expect(overlay.classList.contains('hidden')).toBe(true);
    });

    test('should execute move and hide overlay when hint clicked in overlay', () => {
      document.body.innerHTML = '';
      TutorUI.showTutorSuggestions(game);
      const hintItem = document.querySelector('.tutor-hint-item');
      hintItem.click();

      expect(game.executeMove).toHaveBeenCalled();
      const overlay = document.getElementById('tutor-overlay');
      expect(overlay.classList.contains('hidden')).toBe(true);
    });

    test('should render setup suggestions in panel during setup phase', () => {
      game.phase = 'setup_white';
      TutorUI.showTutorSuggestions(game);

      const container = document.getElementById('tutor-suggestions');
      expect(container.textContent).toContain('Empfohlene Aufstellungen');
      expect(container.textContent).toContain('Template 1');
    });

    test('should handle click on setup template in panel', () => {
      game.phase = 'setup_white';
      TutorUI.showTutorSuggestions(game);

      const templateEl = document.querySelector('.setup-template');
      templateEl.onclick();

      expect(window.confirm).toHaveBeenCalled();
      expect(game.tutorController.applySetupTemplate).toHaveBeenCalledWith('template1');
    });

    test('should show "No suggestions" if hints empty in panel', () => {
      game.getTutorHints = jest.fn(() => []);
      TutorUI.showTutorSuggestions(game);

      const container = document.getElementById('tutor-suggestions');
      expect(container.textContent).toContain('Keine Vorschläge verfügbar');
    });

    test('should render hints in panel with details', () => {
      TutorUI.showTutorSuggestions(game);

      const container = document.getElementById('tutor-suggestions');
      expect(container.textContent).toContain('a1');
      expect(container.textContent).toContain('Top Move');
      expect(container.textContent).toContain('Why?');
    });

    test('should toggle details in panel', () => {
      TutorUI.showTutorSuggestions(game);

      const showBtn = document.querySelector('.show-details-btn');
      const detailsEl = document.querySelector('.suggestion-details');

      expect(detailsEl.classList.contains('hidden')).toBe(true);

      showBtn.click();
      expect(detailsEl.classList.contains('hidden')).toBe(false);
      expect(showBtn.textContent).toBe('Erklärung ausblenden');

      showBtn.click();
      expect(detailsEl.classList.contains('hidden')).toBe(true);
    });

    test('should execute move from panel "Try" button', () => {
      TutorUI.showTutorSuggestions(game);

      const tryBtn = document.querySelector('.try-move-btn');
      tryBtn.onclick({ stopPropagation: () => {} });

      expect(game.executeMove).toHaveBeenCalled();
      const panel = document.getElementById('tutor-panel');
      expect(panel.classList.contains('hidden')).toBe(true);
    });

    test('should handle mouse hover on "Try" button', () => {
      TutorUI.showTutorSuggestions(game);
      const tryBtn = document.querySelector('.try-move-btn');

      tryBtn.onmouseover();
      expect(tryBtn.style.transform).toBe('translateY(-2px)');

      tryBtn.onmouseout();
      expect(tryBtn.style.transform).toBe('');
    });

    test('should handle mouse hover on setup template in panel', () => {
      game.phase = 'setup_white';
      TutorUI.showTutorSuggestions(game);
      const templateEl = document.querySelector('.setup-template');

      templateEl.onmouseover();
      expect(templateEl.style.background).toContain('0.2');

      templateEl.onmouseout();
      expect(templateEl.style.background).toContain('0.1');
    });

    test('should render hints without questions', () => {
      game.getTutorHints = jest.fn(() => [
        {
          move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
          notation: 'a1',
          analysis: {
            category: 'good',
            qualityLabel: 'Good Move',
            tacticalExplanations: [],
            strategicExplanations: ['Some strategy'],
            warnings: [],
            questions: [],
          },
          score: 50,
        },
      ]);
      TutorUI.showTutorSuggestions(game);
      const showBtn = document.querySelector('.show-details-btn');
      expect(showBtn.textContent.trim()).toBe('Warum ist das ein guter Zug?');
    });

    test('should not crash if arrowRenderer is missing', () => {
      game.arrowRenderer = null;
      TutorUI.showTutorSuggestions(game);
      const suggEl = document.querySelector('.tutor-suggestion');
      suggEl.click();
      // Should not throw
    });

    test('should highlight move and cells when suggestion clicked in panel', () => {
      // Create cells for highlighting
      document.body.innerHTML += `
        <div class="cell" data-r="0" data-c="0"></div>
        <div class="cell" data-r="1" data-c="1"></div>
      `;

      TutorUI.showTutorSuggestions(game);

      const suggEl = document.querySelector('.tutor-suggestion');
      suggEl.click();

      expect(game.arrowRenderer.highlightMove).toHaveBeenCalled();
      const fromCell = document.querySelector('.cell[data-r="0"][data-c="0"]');
      const toCell = document.querySelector('.cell[data-r="1"][data-c="1"]');
      expect(fromCell.classList.contains('suggestion-highlight')).toBe(true);
      expect(toCell.classList.contains('suggestion-highlight')).toBe(true);
    });
  });
});
