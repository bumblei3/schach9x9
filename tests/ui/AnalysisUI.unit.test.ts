import { describe, test, expect, beforeEach, vi } from 'vitest';
// Mock DOM
document.body.innerHTML = `
  <div id="evaluation-bar">
    <div id="eval-fill"></div>
    <div id="eval-text"></div>
    <div id="eval-marker"></div>
  </div>
  <div id="analysis-panel" class="hidden">
    <div id="eval-score"></div>
    <div id="eval-bar"></div>
    <div id="top-moves-content"></div>
    <div id="analysis-engine-info"></div>
  </div>
`;

// Mock PostGameAnalyzer
vi.mock('../../js/tutor/PostGameAnalyzer.js', () => ({
  analyzeGame: vi.fn(),
  classifyMove: vi.fn(),
  QUALITY_METADATA: {},
}));

const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');

describe('AnalysisUI', () => {
  let analysisUI: any;

  beforeEach(() => {
    analysisUI = new AnalysisUI({} as any);
    document.getElementById('analysis-panel')!.classList.add('hidden');
  });

  test('update should update evaluation bar', () => {
    const data = { score: 120, depth: 10, nodes: 1000, topMoves: [] };
    analysisUI.update(data);

    const evalText = document.getElementById('eval-text')!;
    expect(evalText.textContent).toBe('+1.2');
  });

  test('update should handle large positive scores', () => {
    const data = { score: 500, depth: 10, nodes: 1000, topMoves: [] };
    analysisUI.update(data);

    const evalText = document.getElementById('eval-text')!;
    expect(evalText.textContent).toBe('+5.0');
  });

  test('togglePanel should toggle visibility', () => {
    analysisUI.togglePanel();
    expect(document.getElementById('analysis-panel')!.classList.contains('hidden')).toBe(false);

    analysisUI.togglePanel();
    expect(document.getElementById('analysis-panel')!.classList.contains('hidden')).toBe(true);
  });

  test('renderTopMoves should create list items when panel is visible', () => {
    // First show the panel
    analysisUI.togglePanel();

    const data = {
      score: 0,
      depth: 10,
      nodes: 1000,
      topMoves: [
        { notation: 'e4', score: 10, move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } } },
        { notation: 'd4', score: -10, move: { from: { r: 6, c: 3 }, to: { r: 4, c: 3 } } },
      ],
    };
    analysisUI.update(data);

    const list = document.getElementById('top-moves-content')!;
    expect(list.children.length).toBe(2);
    expect(list.innerHTML).toContain('e4');
    expect(list.innerHTML).toContain('d4');
  });

  test('updateBar should handle negative scores', () => {
    analysisUI.updateBar(-350);
    const evalText = document.getElementById('eval-text')!;
    expect(evalText.textContent).toBe('-3.5');
    const fill = document.getElementById('eval-fill')!;
    // Percentage = 50 + (-350)/20 = 50 - 17.5 = 32.5%
    expect(fill.style.height).toBe('32.5%');
  });

  test('updateBar should clamp extreme scores', () => {
    analysisUI.updateBar(2000); // Greater than 1000, should clamp to 1000
    const fill = document.getElementById('eval-fill')!;
    expect(fill.style.height).toBe('100%'); // 50 + 1000/20 = 100

    analysisUI.updateBar(-2000); // Less than -1000, should clamp to -1000
    expect(fill.style.height).toBe('0%'); // 50 + (-1000)/20 = 0
  });

  test('updatePanel should update engine info', () => {
    analysisUI.togglePanel(); // Show panel first
    analysisUI.updatePanel(100, [], 15, 50000);
    const engineInfo = document.getElementById('analysis-engine-info')!;
    expect(engineInfo.textContent).toContain('Tiefe: 15');
    expect(engineInfo.textContent).toContain('Knoten: 50000');
  });

  test('updatePanel should handle missing depth/nodes gracefully', () => {
    analysisUI.togglePanel();
    analysisUI.updatePanel(0, [], undefined, undefined);
    const engineInfo = document.getElementById('analysis-engine-info')!;
    expect(engineInfo.textContent).toContain('Tiefe: -');
    expect(engineInfo.textContent).toContain('Knoten: -');
  });

  test('updateBar should not crash when bar elements are null', () => {
    analysisUI.bar = null;
    analysisUI.fill = null;
    expect(() => analysisUI.updateBar(100)).not.toThrow();
  });

  test('togglePanel should return false when panel is null', () => {
    analysisUI.panel = null;
    expect(analysisUI.togglePanel()).toBe(false);
  });
});
