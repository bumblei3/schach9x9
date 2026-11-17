// Mock config
import { describe, expect, test, beforeEach, vi } from 'vitest';

vi.mock('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: {
    PLAY: 'PLAY',
    SETUP_WHITE_PIECES: 'SETUP_WHITE_PIECES',
    SETUP_BLACK_PIECES: 'SETUP_BLACK_PIECES',
  },
  PIECE_VALUES: { p: 100 },
}));

import * as TutorUI from '../../js/ui/TutorUI.js';

describe('TutorUI Component', () => {
  let game: any;

  beforeEach(() => {
    document.body.innerHTML = `
            <div id="tutor-recommendations-section" class="hidden">
                <div id="tutor-recommendations-container"></div>
                <button id="toggle-tutor-recommendations"></button>
            </div>
            <div class="suggestion-highlight"></div>
        `;

    game = {
      initialPoints: 25,
      phase: 'PLAY',
      turn: 'white',
      tutorController: {
        getSetupTemplates: vi.fn(() => [
          {
            id: 'template1',
            name: 'Template 1',
            description: 'Desc 1',
            pieces: ['p', 'n'],
            cost: 10,
          },
        ]),
        applySetupTemplate: vi.fn(),
        getTutorHints: vi.fn(async () => [
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
      getTutorHints: vi.fn(async () => [
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
      executeMove: vi.fn(),
      analyzeMoveWithExplanation: vi.fn((_move: any, _score: any) => ({
        category: 'excellent',
        qualityLabel: 'Top Move',
        tacticalExplanations: [],
        strategicExplanations: [],
        warnings: [],
        questions: [],
      })),
      getScoreDescription: vi.fn((_score: any) => ({
        emoji: '🔥',
        label: 'Super',
        color: '#ff0000',
      })),
      arrowRenderer: {
        clearArrows: vi.fn(),
        highlightMoves: vi.fn(),
      },
    };

    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    (window as any).PIECE_SVGS = null;
    vi.clearAllMocks();
  });

  describe('updateTutorRecommendations', () => {
    test('should return if elements are missing', () => {
      document.body.innerHTML = '';
      TutorUI.updateTutorRecommendations(game);
      expect(game.tutorController.getSetupTemplates).not.toHaveBeenCalled();
    });

    test('should hide tutor section if not in setup phase', () => {
      game.phase = 'PLAY';
      TutorUI.updateTutorRecommendations(game);
      const section = document.getElementById('tutor-recommendations-section');
      expect(section?.classList.contains('hidden')).toBe(true);
    });

    test('should show tutor section and initialize toggle in setup phase', () => {
      game.phase = 'SETUP_WHITE_PIECES';
      TutorUI.updateTutorRecommendations(game);

      const section = document.getElementById('tutor-recommendations-section');
      expect(section?.classList.contains('hidden')).toBe(false);

      const toggleBtn = document.getElementById('toggle-tutor-recommendations');
      expect(toggleBtn?.dataset.initialized).toBe('true');

      const container = document.getElementById('tutor-recommendations-container');
      container?.classList.add('hidden');
      toggleBtn?.click();
      expect(container?.classList.contains('hidden')).toBe(false);
      expect(toggleBtn?.textContent).toContain('ausblenden');

      toggleBtn?.click();
      expect(container?.classList.contains('hidden')).toBe(true);
      expect(toggleBtn?.textContent).toContain('anzeigen');
    });

    test('should render templates correctly for black pieces', () => {
      game.phase = 'SETUP_BLACK_PIECES';
      TutorUI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container?.children.length).toBe(1);
    });

    test('should render templates with PIECE_SVGS if available', () => {
      (window as any).PIECE_SVGS = { white: { p: '<svg>pawn</svg>', n: '<svg>knight</svg>' } };
      game.phase = 'SETUP_WHITE_PIECES';
      TutorUI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container?.innerHTML).toContain('<svg>knight</svg>');
    });

    test('should handle missing PIECE_SVGS keys', () => {
      (window as any).PIECE_SVGS = { white: {} }; // Missing 'p' and 'n'
      game.phase = 'SETUP_WHITE_PIECES';
      TutorUI.updateTutorRecommendations(game);

      const container = document.getElementById('tutor-recommendations-container');
      expect(container?.textContent).toContain('♞');
    });

    test('should apply template directly on click', () => {
      game.phase = 'SETUP_WHITE_PIECES';
      TutorUI.updateTutorRecommendations(game);

      const card = document.querySelector('.setup-template-card') as HTMLElement;
      card.click();

      // confirm() dialog was removed - templates apply directly
      expect(game.tutorController.applySetupTemplate).toHaveBeenCalledWith('template1');
    });
  });

  describe('showTutorSuggestions', () => {
    test('should show overlay if panel/elements are missing', async () => {
      document.body.innerHTML = ''; // Force overlay path
      await TutorUI.showTutorSuggestions(game);

      const overlay = document.getElementById('tutor-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.classList.contains('hidden')).toBe(false);

      const hintsBody = document.getElementById('tutor-hints-body');
      expect(hintsBody?.children.length).toBe(1);
      expect(hintsBody?.textContent).toContain('a1');
    });

    test('should toast in overlay mode if no tutor available', async () => {
      document.body.innerHTML = '';
      game.tutorController.getTutorHints = null;
      await TutorUI.showTutorSuggestions(game);
      expect(window.alert).not.toHaveBeenCalled();
      expect(document.querySelector('#toast-container')?.textContent).toContain(
        'Tutor nicht verfügbar!'
      );
    });

    test('should log in overlay mode if no hints available', async () => {
      document.body.innerHTML = '';
      const consoleSpy = vi.spyOn(console, 'log');
      game.tutorController.getTutorHints = vi.fn(async () => []);
      await TutorUI.showTutorSuggestions(game);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No hints available'));
    });

    test('should close overlay when close button clicked', async () => {
      document.body.innerHTML = '';
      await TutorUI.showTutorSuggestions(game);
      const closeBtn = document.getElementById('close-tutor-btn');
      closeBtn?.click();
      const overlay = document.getElementById('tutor-overlay');
      expect(overlay?.classList.contains('hidden')).toBe(true);
    });

    test('should execute move and hide overlay when hint clicked in overlay', async () => {
      document.body.innerHTML = '';
      await TutorUI.showTutorSuggestions(game);
      const hintItem = document.querySelector('.tutor-hint-item') as HTMLElement;
      hintItem.click();

      expect(game.executeMove).toHaveBeenCalled();
      const overlay = document.getElementById('tutor-overlay');
      expect(overlay?.classList.contains('hidden')).toBe(true);
    });

  });
});
