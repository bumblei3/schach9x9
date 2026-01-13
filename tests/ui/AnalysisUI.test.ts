/**
 * AnalysisUI Tests
 * Coverage target: 66% -> 85%+
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AnalysisUI } from '../../js/ui/AnalysisUI.js';

// Mock PostGameAnalyzer
vi.mock('../../js/tutor/PostGameAnalyzer.js', () => ({
    analyzeGame: vi.fn().mockResolvedValue({
        blunders: [],
        mistakes: [],
        accuracy: 85,
    }),
}));

describe('AnalysisUI', () => {
    let analysisUI: AnalysisUI;
    let mockApp: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup DOM
        document.body.innerHTML = `
      <div id="evaluation-bar" class="hidden">
        <div id="eval-fill"></div>
        <span id="eval-text"></span>
        <div id="eval-marker"></div>
      </div>
      <div id="analysis-panel" class="hidden">
        <span id="analysis-score-value"></span>
        <div id="top-moves-content"></div>
        <div id="eval-bar"></div>
        <span id="eval-score"></span>
        <span id="analysis-engine-info"></span>
      </div>
    `;

        mockApp = {
            game: {
                board: [],
                moveHistory: [],
                phase: 'PLAY',
            },
        };

        analysisUI = new AnalysisUI(mockApp);
    });

    describe('constructor', () => {
        test('should initialize DOM references', () => {
            expect(analysisUI.bar).not.toBeNull();
            expect(analysisUI.fill).not.toBeNull();
            expect(analysisUI.text).not.toBeNull();
            expect(analysisUI.panel).not.toBeNull();
        });

        test('should expose game via getter', () => {
            expect(analysisUI.game).toBe(mockApp.game);
        });
    });

    describe('update()', () => {
        test('should update bar and panel', () => {
            const analysis = {
                score: 150,
                topMoves: [
                    { move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }, notation: 'e4', score: 150 },
                ],
                depth: 6,
                nodes: 10000,
            };

            // Show panel first
            analysisUI.panel?.classList.remove('hidden');

            analysisUI.update(analysis);

            expect(analysisUI.fill?.style.height).toBeDefined();
            expect(analysisUI.text?.textContent).toContain('+');
        });
    });

    describe('updateBar()', () => {
        test('should set fill height based on score', () => {
            analysisUI.updateBar(200); // +2.00

            const fillHeight = parseFloat(analysisUI.fill?.style.height || '0');
            expect(fillHeight).toBeGreaterThan(50); // White advantage
        });

        test('should handle negative scores', () => {
            analysisUI.updateBar(-300); // -3.00

            const fillHeight = parseFloat(analysisUI.fill?.style.height || '0');
            expect(fillHeight).toBeLessThan(50); // Black advantage
        });

        test('should clamp extreme scores', () => {
            analysisUI.updateBar(5000); // Very high

            const fillHeight = parseFloat(analysisUI.fill?.style.height || '0');
            expect(fillHeight).toBeLessThanOrEqual(100);
        });

        test('should show bar when updating', () => {
            analysisUI.bar?.classList.add('hidden');

            analysisUI.updateBar(0);

            expect(analysisUI.bar?.classList.contains('hidden')).toBe(false);
        });

        test('should display formatted score text', () => {
            analysisUI.updateBar(150);

            expect(analysisUI.text?.textContent).toBe('+1.5');
        });
    });

    describe('updatePanel()', () => {
        test('should not update if panel is hidden', () => {
            analysisUI.panel?.classList.add('hidden');

            analysisUI.updatePanel(100, [], 4, 500);

            // Should not throw, just return early
        });

        test('should update score display', () => {
            analysisUI.panel?.classList.remove('hidden');

            analysisUI.updatePanel(250, [], 6, 1000);

            expect(analysisUI.evalScoreValue?.textContent).toBe('+2.50');
        });

        test('should render top moves', () => {
            analysisUI.panel?.classList.remove('hidden');
            const topMoves = [
                { move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }, notation: 'e4', score: 50 },
                { move: { from: { r: 6, c: 3 }, to: { r: 4, c: 3 } }, notation: 'd4', score: 40 },
            ];

            analysisUI.updatePanel(50, topMoves, 4, 500);

            expect(analysisUI.topMovesContainer?.innerHTML).toContain('e4');
            expect(analysisUI.topMovesContainer?.innerHTML).toContain('d4');
        });

        test('should update engine info', () => {
            analysisUI.panel?.classList.remove('hidden');

            analysisUI.updatePanel(100, [], 8, 50000);

            expect(analysisUI.engineInfo?.textContent).toContain('Tiefe: 8');
            expect(analysisUI.engineInfo?.textContent).toContain('Knoten: 50000');
        });
    });

    describe('togglePanel()', () => {
        test('should show hidden panel', () => {
            analysisUI.panel?.classList.add('hidden');

            const result = analysisUI.togglePanel();

            // togglePanel returns !isHidden (state BEFORE toggle)
            // If was hidden (isHidden=true), returns !true = false
            expect(result).toBe(false);
            expect(analysisUI.panel?.classList.contains('hidden')).toBe(false);
        });

        test('should hide visible panel', () => {
            analysisUI.panel?.classList.remove('hidden');

            const result = analysisUI.togglePanel();

            // togglePanel returns !isHidden (state BEFORE toggle)  
            // If was visible (isHidden=false), returns !false = true
            expect(result).toBe(true);
            expect(analysisUI.panel?.classList.contains('hidden')).toBe(true);
        });

        test('should return false if panel is null', () => {
            analysisUI.panel = null;

            const result = analysisUI.togglePanel();

            expect(result).toBe(false);
        });
    });
});
