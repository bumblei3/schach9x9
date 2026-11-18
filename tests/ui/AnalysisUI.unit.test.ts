import { describe, test, expect, beforeEach, vi } from 'vitest';
// Mock DOM
document.body.innerHTML = `
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
    document.getElementById('analysis-panel')!.classList.remove('hidden');
    const data = { score: 120, depth: 10, nodes: 1000, topMoves: [] };
    analysisUI.update(data);

    expect(document.getElementById('eval-score')!.textContent).toBe('+1.20');
    expect(document.getElementById('eval-bar')!.style.width).toBe('56%');
  });

  test('update should handle large positive scores', () => {
    document.getElementById('analysis-panel')!.classList.remove('hidden');
    const data = { score: 500, depth: 10, nodes: 1000, topMoves: [] };
    analysisUI.update(data);

    expect(document.getElementById('eval-score')!.textContent).toBe('+5.00');
    expect(document.getElementById('eval-bar')!.style.width).toBe('75%');
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

  test('update should handle negative scores', () => {
    document.getElementById('analysis-panel')!.classList.remove('hidden');
    analysisUI.updatePanel(-350, [], 10, 1000);
    expect(document.getElementById('eval-score')!.textContent).toBe('-3.50');
    // 50 + (-350)/20 = 32.5%
    expect(document.getElementById('eval-bar')!.style.width).toBe('32.5%');
  });

  test('update should clamp extreme scores', () => {
    document.getElementById('analysis-panel')!.classList.remove('hidden');
    analysisUI.updatePanel(2000, [], 10, 1000);
    expect(document.getElementById('eval-bar')!.style.width).toBe('100%');

    analysisUI.updatePanel(-2000, [], 10, 1000);
    expect(document.getElementById('eval-bar')!.style.width).toBe('0%');
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

  test('togglePanel should return false when panel is null', () => {
    analysisUI.panel = null;
    expect(analysisUI.togglePanel()).toBe(false);
  });
});
