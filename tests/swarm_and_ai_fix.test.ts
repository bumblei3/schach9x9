import { describe, test, expect, vi } from 'vitest';
import { Game } from '../js/gameEngine.js';
import * as HintGenerator from '../js/tutor/HintGenerator.js';

// Mock UI module to prevent errors when calling UI.renderBoard etc.
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showTutorSuggestions: vi.fn(),
  updateShopUI: vi.fn(),
}));

// Mock DOM
(global as any).document = {
  querySelectorAll: vi.fn(() => ({
    forEach: vi.fn(),
  })),
  querySelector: vi.fn(() => null),
  getElementById: vi.fn(() => ({
    style: {},
    textContent: '',
  })),
};

describe('Verification: Swarm Template and AI Fix', () => {
  describe('Swarm Templates', () => {
    test('swarm_12 should have 8 pieces and cost 12', () => {
      const game = { initialPoints: 12 };
      const templates = HintGenerator.getSetupTemplates(game);
      const swarm12 = templates.find(t => t.id === 'swarm_12');

      expect(swarm12).toBeDefined();
      expect(swarm12!.pieces.length).toBe(8);
      expect(swarm12!.cost).toBe(12);

      // Verification of pieces: ['n', 'b', 'p', 'p', 'p', 'p', 'p', 'p']
      // 3 (N) + 3 (B) + 6 * 1 (P) = 12
      const pieceCounts = swarm12!.pieces.reduce((acc: any, p: any) => {
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});
      expect(pieceCounts['n']).toBe(1);
      expect(pieceCounts['b']).toBe(1);
      expect(pieceCounts['p']).toBe(6);
    });

    test('swarm_18 should have 8 pieces and cost 18', () => {
      const game = { initialPoints: 18 };
      const templates = HintGenerator.getSetupTemplates(game);
      const swarm18 = templates.find(t => t.id === 'swarm_18');

      expect(swarm18).toBeDefined();
      expect(swarm18!.pieces.length).toBe(8);
      expect(swarm18!.cost).toBe(18);

      // Verification of pieces: ['n', 'n', 'b', 'r', 'p', 'p', 'p', 'p']
      // 3+3 (2N) + 3 (B) + 5 (R) + 4 * 1 (P) = 18
      const pieceCounts = swarm18!.pieces.reduce((acc: any, p: any) => {
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});
      expect(pieceCounts['n']).toBe(2);
      expect(pieceCounts['b']).toBe(1);
      expect(pieceCounts['r']).toBe(1);
      expect(pieceCounts['p']).toBe(4);
    });
  });

  describe('AI Controller Fix', () => {
    test('highlightMove should not throw when move is undefined or incomplete', async () => {
      // Import AIController after mocking dependencies if needed
      const { AIController } = await import('../js/aiController.js');
      const game = new Game(15, 'play' as any);
      const ai = new AIController(game);

      // These should not throw TypeError
      expect(() => ai.highlightMove(null)).not.toThrow();
      expect(() => ai.highlightMove({})).not.toThrow();
      expect(() => ai.highlightMove({ from: {} })).not.toThrow();
      expect(() => ai.highlightMove({ to: {} })).not.toThrow();
      expect(() => ai.highlightMove({ from: { r: 0, c: 0 } } as any)).not.toThrow(); // missing 'to'
    });
  });
});
