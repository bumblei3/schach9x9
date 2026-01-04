import { jest } from '@jest/globals';

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
jest.unstable_mockModule('../../js/tutor/PostGameAnalyzer.js', () => ({
  analyzeGame: jest.fn(),
  classifyMove: jest.fn(),
  QUALITY_METADATA: {},
}));

const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');

describe('AnalysisUI', () => {
  let analysisUI;

  beforeEach(() => {
    analysisUI = new AnalysisUI();
    document.getElementById('analysis-panel').classList.add('hidden');
  });

  test('update should update evaluation bar', () => {
    const data = { score: 120, depth: 10, nodes: 1000, topMoves: [] };
    analysisUI.update(data);

    const evalText = document.getElementById('eval-text');
    expect(evalText.textContent).toBe('+1.2');
  });

  test('update should handle large positive scores', () => {
    const data = { score: 500, depth: 10, nodes: 1000, topMoves: [] };
    analysisUI.update(data);

    const evalText = document.getElementById('eval-text');
    expect(evalText.textContent).toBe('+5.0');
  });

  test('togglePanel should toggle visibility', () => {
    analysisUI.togglePanel();
    expect(document.getElementById('analysis-panel').classList.contains('hidden')).toBe(false);

    analysisUI.togglePanel();
    expect(document.getElementById('analysis-panel').classList.contains('hidden')).toBe(true);
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

    const list = document.getElementById('top-moves-content');
    expect(list.children.length).toBe(2);
    expect(list.innerHTML).toContain('e4');
    expect(list.innerHTML).toContain('d4');
  });
});
