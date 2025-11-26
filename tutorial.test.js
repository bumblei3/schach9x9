/**
 * Tests for Tutorial System
 * @jest-environment jsdom
 */

import { Tutorial } from './tutorial.js';

describe('Tutorial', () => {
  let tutorial;

  beforeEach(() => {
    // Setup complete DOM structure that tutorial.js expects
    document.body.innerHTML = `
      <div id="tutorial-overlay" class="hidden">
        <div id="tutorial-modal">
          <div id="tutorial-header">
            <h2 id="tutorial-title"></h2>
            <button id="tutorial-close">×</button>
          </div>
          <div id="tutorial-body">
            <div id="tutorial-steps"></div>
            <div id="tutorial-content"></div>
            <div id="tutorial-demo"></div>
          </div>
          <div id="tutorial-footer">
            <div id="tutorial-step-indicator">
              <span id="tutorial-current-step"></span> / <span id="tutorial-total-steps"></span>
            </div>
            <div id="tutorial-navigation">
              <button id="tutorial-prev">Zurück</button>
              <button id="tutorial-next">Weiter</button>
            </div>
          </div>
        </div>
      </div>
    `;

    tutorial = new Tutorial();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should initialize with first step', () => {
      expect(tutorial.currentStep).toBe(0);
    });

    test('should create tutorial steps', () => {
      expect(tutorial.steps).toBeDefined();
      expect(tutorial.steps.length).toBeGreaterThan(0);
    });

    test('should have steps with title and content', () => {
      const firstStep = tutorial.steps[0];
      expect(firstStep).toHaveProperty('title');
      expect(firstStep).toHaveProperty('content');
    });
  });

  describe('Step Creation', () => {
    test('should create Archbishop demo step', () => {
      const arcDemo = tutorial.createArchbishopDemo();

      expect(arcDemo).toContain('Erzbischof'); // Archbishop in German
      expect(arcDemo).toContain('svg'); // Should contain SVG grid
    });

    test('should create Chancellor demo step', () => {
      const chanDemo = tutorial.createChancellorDemo();

      expect(chanDemo).toContain('Kanzler'); // Chancellor in German
      expect(chanDemo).toContain('svg'); // Should contain SVG grid
    });

    test('should create corridor demo', () => {
      const corridorDemo = tutorial.createCorridorDemo();

      expect(corridorDemo).toContain('Korridore');
      expect(corridorDemo).toContain('svg');
    });

    test('should create shop demo', () => {
      const shopDemo = tutorial.createShopDemo();

      expect(shopDemo).toContain('Shop');
      expect(shopDemo).toContain('Punkte');
    });
  });

  describe('Move Grid Creation', () => {
    test('should create move grid for Archbishop', () => {
      const grid = tutorial.createMoveGrid({ type: 'a' });

      expect(grid).toContain('svg');
      expect(grid).toContain('rect'); // Should have cells
    });

    test('should create move grid for Chancellor', () => {
      const grid = tutorial.createMoveGrid({ type: 'c' });

      expect(grid).toContain('svg');
      expect(grid).toContain('rect');
    });

    test('should include piece SVG in grid', () => {
      const grid = tutorial.createMoveGrid({ type: 'a' });

      // Should contain piece symbol or SVG
      expect(grid.length).toBeGreaterThan(100); // Grid should be non-trivial
    });
  });

  describe('Move Type Detection', () => {
    test('should detect bishop moves for Archbishop', () => {
      const piece = { type: 'a' };

      // Diagonal move
      const type1 = tutorial.getMoveType(piece, 1, 1); // From center (4,4)
      expect(['bishop', 'knight']).toContain(type1);

      // Knight move
      const type2 = tutorial.getMoveType(piece, 2, 1);
      expect(['bishop', 'knight']).toContain(type2);
    });

    test('should detect rook moves for Chancellor', () => {
      const piece = { type: 'c' };

      // Straight move
      const type1 = tutorial.getMoveType(piece, 4, 0);
      expect(['rook', 'knight']).toContain(type1);

      // Knight move
      const type2 = tutorial.getMoveType(piece, 2, 1);
      expect(['rook', 'knight']).toContain(type2);
    });

    test('should return null for invalid moves', () => {
      const piece = { type: 'a' };

      // Same square
      const type = tutorial.getMoveType(piece, 4, 4);
      expect(type).toBeNull();
    });
  });

  describe('Navigation', () => {
    test('should navigate to next step', () => {
      const initialStep = tutorial.currentStep;
      tutorial.nextStep();

      expect(tutorial.currentStep).toBe(initialStep + 1);
    });

    test('should not go past last step', () => {
      tutorial.currentStep = tutorial.steps.length - 1;
      tutorial.nextStep();

      expect(tutorial.currentStep).toBe(tutorial.steps.length - 1);
    });

    test('should navigate to previous step', () => {
      tutorial.currentStep = 2;
      tutorial.prevStep();

      expect(tutorial.currentStep).toBe(1);
    });

    test('should not go before first step', () => {
      tutorial.currentStep = 0;
      tutorial.prevStep();

      expect(tutorial.currentStep).toBe(0);
    });
  });

  describe('Show and Hide', () => {
    test('should show tutorial overlay', () => {
      tutorial.show();

      const overlay = document.getElementById('tutorial-overlay');
      expect(overlay.classList.contains('hidden')).toBe(false);
    });

    test('should hide tutorial overlay', () => {
      tutorial.show();
      tutorial.close();

      const overlay = document.getElementById('tutorial-overlay');
      expect(overlay.classList.contains('hidden')).toBe(true);
    });

    test('should reset to first step when closed', () => {
      tutorial.currentStep = 3;
      tutorial.close();

      expect(tutorial.currentStep).toBe(0);
    });
  });

  describe('Update Step Display', () => {
    test('should update content when step changes', () => {
      tutorial.updateStep();

      const content = document.getElementById('tutorial-content');
      expect(content.innerHTML).toBeTruthy();
    });

    test('should update step indicator', () => {
      tutorial.updateStep();

      const indicator = document.getElementById('tutorial-step-indicator');
      expect(indicator.textContent).toContain('1'); // Step 1 of N
    });

    test('should disable prev button on first step', () => {
      tutorial.currentStep = 0;
      tutorial.updateStep();

      const prevBtn = document.getElementById('tutorial-prev');
      expect(prevBtn.disabled).toBe(true);
    });

    test('should disable next button on last step', () => {
      tutorial.currentStep = tutorial.steps.length - 1;
      tutorial.updateStep();

      const nextBtn = document.getElementById('tutorial-next');
      expect(nextBtn.disabled).toBe(true);
    });
  });

  describe('Piece Moves Logic', () => {
    test('should return bishop and knight moves for Archbishop', () => {
      const moves = tutorial.getPieceMoves({ type: 'a' });

      expect(moves.length).toBeGreaterThan(0);
      // Archbishop combines bishop and knight moves
      expect(moves.length).toBeLessThan(28); // Max possible on 9x9
    });

    test('should return rook and knight moves for Chancellor', () => {
      const moves = tutorial.getPieceMoves({ type: 'c' });

      expect(moves.length).toBeGreaterThan(0);
      // Chancellor combines rook and knight moves
      expect(moves.length).toBeLessThan(28);
    });

    test('should return empty array for unknown piece type', () => {
      const moves = tutorial.getPieceMoves({ type: 'x' });

      expect(moves).toEqual([]);
    });
  });
});
