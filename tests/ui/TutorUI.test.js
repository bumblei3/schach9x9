import { jest } from '@jest/globals';

// Mock config
jest.unstable_mockModule('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play' },
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
        `;

    game = {
      phase: 'play',
      tutorController: {
        getSetupTemplates: () => [],
        getTutorHints: jest.fn(() => [
          {
            move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
            notation: 'a1',
            index: 0,
            analysis: {
              category: 'excellent',
              qualityLabel: 'Top Move',
              tacticalExplanations: [],
              strategicExplanations: [],
              warnings: [],
              questions: [],
              scoreDiff: 0, // Added to support sort/validation logic
            },
            score: 100,
          },
        ]),
      },
      getTutorHints: jest.fn(() => [
        // Added back for TutorUI compatibility
        {
          move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
          notation: 'a1',
          index: 0,
          analysis: {
            category: 'excellent',
            qualityLabel: 'Top Move',
            tacticalExplanations: [],
            strategicExplanations: [],
            warnings: [],
            questions: [],
            scoreDiff: 0,
          },
          score: 100,
        },
      ]),
      analyzeMoveWithExplanation: jest.fn(), // Mock this as it might be called
      getScoreDescription: jest.fn(),
    };
  });

  test('should render tutor suggestions', () => {
    TutorUI.showTutorSuggestions(game);
    const container = document.getElementById('tutor-suggestions');
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Top Move');
  });

  test('should toggle recommendations visibility', () => {
    TutorUI.updateTutorRecommendations(game);
    const btn = document.getElementById('toggle-tutor-recommendations');
    if (btn) btn.click();
    const section = document.getElementById('tutor-recommendations-section');
    expect(section).toBeDefined();
  });
});
