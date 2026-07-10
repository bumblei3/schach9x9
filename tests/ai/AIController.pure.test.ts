import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AIController } from '../../js/aiController.js';
import { PHASES } from '../../js/gameEngine.js';
import * as UI from '../../js/ui.js';

vi.mock('../../js/ui.js', () => ({
  updateStatus: vi.fn(),
  showModal: vi.fn(),
  closeModal: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderEvalGraph: vi.fn(),
  drawEngineArrow: vi.fn(),
  renderBoard: vi.fn(),
}));

vi.mock('../../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn().mockResolvedValue(0),
  getBestMove: vi.fn(),
  getParamsForElo: vi.fn(() => ({ maxDepth: 4, elo: 2500 })),
  convertBoardToInt: vi.fn(() => new Int32Array(81)),
}));

// Minimal Worker mock; aiController methods under test don't drive the pool.
class MockWorker {
  onmessage: ((e: any) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}
// @ts-ignore
global.Worker = MockWorker;
Object.defineProperty(global.navigator, 'hardwareConcurrency', { value: 4, configurable: true });

function makeGame(overrides: any = {}): any {
  return {
    board: Array(9).fill(null).map(() => Array(9).fill(null)),
    phase: PHASES.PLAY,
    turn: 'black',
    difficulty: 'medium',
    mode: 'standard',
    boardShape: null,
    boardSize: 9,
    moveHistory: [],
    positionHistory: [],
    points: 15,
    drawOffered: false,
    drawOfferedBy: null,
    halfMoveClock: 0,
    lastMove: null,
    gameController: {
      resign: vi.fn(),
      offerDraw: vi.fn(),
      acceptDraw: vi.fn(),
      declineDraw: vi.fn(),
      placeKing: vi.fn(),
      placeShopPiece: vi.fn(),
      finishSetupPhase: vi.fn(),
    },
    analysisManager: null,
    evaluationBar: null,
    arrowRenderer: { clearArrows: vi.fn(), drawArrow: vi.fn() },
    findKing: vi.fn().mockReturnValue({ r: 0, c: 4 }),
    getAllLegalMoves: vi.fn().mockReturnValue([]),
    executeMove: vi.fn(),
    calculateMaterialAdvantage: vi.fn().mockReturnValue(0),
    isInsufficientMaterial: vi.fn().mockReturnValue(false),
    getBoardHash: vi.fn().mockReturnValue('h'),
    renderBoard: vi.fn(),
    log: vi.fn(),
    ...overrides,
  };
}

describe('AIController pure-method coverage', () => {
  let controller: AIController;
  let game: any;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="ai-depth"></div>
      <div id="ai-nodes"></div>
      <div id="ai-best-move"></div>
      <div id="progress-fill"></div>
      <div id="analysis-engine-info"></div>
    `;
    game = makeGame();
    controller = new AIController(game);
  });

  // --- getAlgebraicNotation ---
  test('getAlgebraicNotation builds file-rank from r/c (board size 9)', () => {
    expect(controller.getAlgebraicNotation({ from: { r: 8, c: 0 }, to: { r: 6, c: 4 } })).toBe('a1-e3');
  });

  test('getAlgebraicNotation returns ?? for null/partial move', () => {
    expect(controller.getAlgebraicNotation(null)).toBe('??');
    expect(controller.getAlgebraicNotation({ from: { r: 0, c: 0 } } as any)).toBe('??');
  });

  // --- terminate ---
  test('terminate clears pool workers', () => {
    const w = new MockWorker();
    controller.aiWorkers = [w] as any;
    controller.terminate();
    expect(w.terminate).toHaveBeenCalled();
    expect(controller.aiWorkers.length).toBe(0);
  });

  test('terminate handles null aiWorker without throwing', () => {
    controller.aiWorker = null;
    controller.aiWorkers = [];
    expect(() => controller.terminate()).not.toThrow();
  });

  test('terminate clears aiWorker when present', () => {
    const w = new MockWorker();
    controller.aiWorker = w as any;
    controller.terminate();
    expect(w.terminate).toHaveBeenCalled();
    expect(controller.aiWorker).toBeNull();
  });

  // --- setBoardShapeForWorkers ---
  test('setBoardShapeForWorkers posts to main + pool workers', () => {
    const main = new MockWorker();
    const pool = new MockWorker();
    controller.aiWorker = main as any;
    controller.aiWorkers = [pool] as any;
    controller.setBoardShapeForWorkers('cross');
    expect(main.postMessage).toHaveBeenCalledWith({ type: 'setBoardShape', data: { shape: 'cross' } });
    expect(pool.postMessage).toHaveBeenCalledWith({ type: 'setBoardShape', data: { shape: 'cross' } });
  });

  test('setBoardShapeForWorkers works with no workers', () => {
    controller.aiWorker = null;
    controller.aiWorkers = [];
    expect(() => controller.setBoardShapeForWorkers('standard')).not.toThrow();
  });

  // --- handleWorkerMessage dispatch ---
  test('handleWorkerMessage progress updates analysisUI live progress', () => {
    const analysisUI: any = { updateLiveProgress: vi.fn() };
    controller.analysisUI = analysisUI;
    (controller as any).handleWorkerMessage({ data: { type: 'progress', data: { depth: 3, maxDepth: 9 } } } as any, 0);
    expect(analysisUI.updateLiveProgress).toHaveBeenCalledWith({ depth: 3, maxDepth: 9 });
  });

  test('handleWorkerMessage progress updates analysisUI for any worker index', () => {
    const analysisUI: any = { updateLiveProgress: vi.fn() };
    controller.analysisUI = analysisUI;
    (controller as any).handleWorkerMessage({ data: { type: 'progress', data: { depth: 1 } } } as any, 1);
    expect(analysisUI.updateLiveProgress).toHaveBeenCalled();
  });

  test('handleWorkerMessage bestMove stores lastBestMove', () => {
    const data = { move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } } };
    (controller as any).handleWorkerMessage({ data: { type: 'bestMove', data } } as any, 0);
    expect(game.lastBestMove).toBe(data);
  });

  test('handleWorkerMessage analysis delegates to handleAnalysisResult', () => {
    const analysisUI: any = { update: vi.fn() };
    controller.analysisUI = analysisUI;
    const payload = { score: 12, topMoves: [] };
    (controller as any).handleWorkerMessage({ data: { type: 'analysis', data: payload } } as any, 0);
    expect(analysisUI.update).toHaveBeenCalledWith(payload);
  });

  // --- handleAnalysisResult ---
  test('handleAnalysisResult updates bestMoves + eval bar when topMoves present', () => {
    const evalUpdate = vi.fn();
    game.evaluationBar = { update: evalUpdate };
    game.analysisManager = { updateArrows: vi.fn() };
    const topMoves = [{ move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, score: 50, notation: 'e4' }];
    (controller as any).handleAnalysisResult({ score: 50, topMoves });
    expect(game.bestMoves.length).toBe(1);
    expect(evalUpdate).toHaveBeenCalledWith(50);
    expect(game.analysisManager.updateArrows).toHaveBeenCalled();
  });

  test('handleAnalysisResult without analysisUI still updates bestMoves', () => {
    controller.analysisUI = null;
    const topMoves = [{ move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, score: 5, notation: 'a1' }];
    (controller as any).handleAnalysisResult({ score: 5, topMoves });
    expect(game.bestMoves.length).toBe(1);
  });

  test('handleAnalysisResult without topMoves does not set bestMoves', () => {
    (controller as any).handleAnalysisResult({ score: 100 });
    expect(game.bestMoves).toBeUndefined();
  });

  // --- updateAIProgress ---
  test('updateAIProgress returns early on null data', () => {
    expect(() => controller.updateAIProgress(null)).not.toThrow();
  });

  test('updateAIProgress updates depth/nodes/bestMove and draws engine arrow', () => {
    controller.updateAIProgress({
      depth: 7,
      maxDepth: 10,
      nodes: 12345,
      bestMove: { from: { r: 8, c: 0 }, to: { r: 6, c: 4 } },
    });
    expect(document.getElementById('ai-depth')!.textContent).toBe('Tiefe 7/10');
    expect(document.getElementById('ai-nodes')!.textContent).toBe('12.345 Positionen');
    expect(document.getElementById('ai-best-move')!.textContent).toContain('a1-e3');
    expect((UI as any).drawEngineArrow).toHaveBeenCalled();
  });

  test('updateAIProgress skips elements that are missing', () => {
    document.body.innerHTML = '';
    expect(() =>
      controller.updateAIProgress({ depth: 1, nodes: 5, bestMove: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } } })
    ).not.toThrow();
  });

  test('updateAIProgress progress bar scales with depth/maxDepth', () => {
    controller.updateAIProgress({ depth: 5, maxDepth: 10 });
    expect(document.getElementById('progress-fill')!.style.width).toBe('50%');
  });

  test('updateAIProgress progress bar guarded when maxDepth is 0 (no NaN)', () => {
    const fill = document.getElementById('progress-fill')!;
    fill.style.width = 'initial';
    controller.updateAIProgress({ depth: 0, maxDepth: 0 });
    // Block is skipped when maxDepth <= 0, so width is left untouched (no 'NaN%')
    expect(fill.style.width).not.toBe('NaN%');
  });

  // --- highlightMove ---
  test('highlightMove returns early on null/incomplete move', () => {
    document.body.innerHTML = '<div class="cell" data-r="0" data-c="0"></div>';
    expect(() => controller.highlightMove(null)).not.toThrow();
    expect(() => controller.highlightMove({ from: { r: 0, c: 0 } } as any)).not.toThrow();
  });

  test('highlightMove adds analysis-from/to classes and draws arrow', () => {
    document.body.innerHTML = `
      <div class="cell" data-r="5" data-c="2"></div>
      <div class="cell" data-r="3" data-c="6"></div>
    `;
    controller.highlightMove({ from: { r: 5, c: 2 }, to: { r: 3, c: 6 } });
    expect(document.querySelector('.cell[data-r="5"][data-c="2"]')!.classList.contains('analysis-from')).toBe(true);
    expect(document.querySelector('.cell[data-r="3"][data-c="6"]')!.classList.contains('analysis-to')).toBe(true);
    expect(game.arrowRenderer.drawArrow).toHaveBeenCalled();
  });

  test('highlightMove clears previous highlights before applying new ones', () => {
    document.body.innerHTML = `
      <div class="cell analysis-from" data-r="1" data-c="1"></div>
      <div class="cell" data-r="2" data-c="2"></div>
      <div class="cell" data-r="4" data-c="4"></div>
    `;
    controller.highlightMove({ from: { r: 2, c: 2 }, to: { r: 4, c: 4 } });
    expect(document.querySelector('.cell[data-r="1"][data-c="1"]')!.classList.contains('analysis-from')).toBe(false);
  });

  test('highlightMove without arrowRenderer only toggles classes', () => {
    game.arrowRenderer = null;
    document.body.innerHTML = `
      <div class="cell" data-r="5" data-c="2"></div>
      <div class="cell" data-r="3" data-c="6"></div>
    `;
    expect(() => controller.highlightMove({ from: { r: 5, c: 2 }, to: { r: 3, c: 6 } })).not.toThrow();
    expect(document.querySelector('.cell[data-r="5"][data-c="2"]')!.classList.contains('analysis-from')).toBe(true);
  });

  // --- updateAnalysisStats ---
  test('updateAnalysisStats writes engine info with de-DE number formatting', () => {
    controller.updateAnalysisStats({ depth: 3, maxDepth: 8, nodes: 1000 });
    expect(document.getElementById('analysis-engine-info')!.textContent).toBe('Tiefe: 3/8 | Knoten: 1.000');
  });

  test('updateAnalysisStats handles missing nodes', () => {
    controller.updateAnalysisStats({ depth: 1, maxDepth: 2 });
    expect(document.getElementById('analysis-engine-info')!.textContent).toBe('Tiefe: 1/2 | Knoten: 0');
  });

  // --- toggleAnalysisMode ---
  test('toggleAnalysisMode flips flag and calls analyzePosition when activated', () => {
    const analyzeSpy = vi.spyOn(controller, 'analyzePosition');
    const result = controller.toggleAnalysisMode();
    expect(result).toBe(true);
    expect(controller.analysisActive).toBe(true);
    expect(analyzeSpy).toHaveBeenCalled();
  });

  test('toggleAnalysisMode deactivates without analyzePosition', () => {
    controller.analysisActive = true;
    const analyzeSpy = vi.spyOn(controller, 'analyzePosition');
    const result = controller.toggleAnalysisMode();
    expect(result).toBe(false);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  test('toggleAnalysisMode updates evaluationBar + analysisManager when present', () => {
    const show = vi.fn();
    game.evaluationBar = { show };
    game.analysisManager = { showBestMove: false, updateArrows: vi.fn() };
    controller.toggleAnalysisMode();
    expect(show).toHaveBeenCalledWith(true);
    expect(game.analysisManager.showBestMove).toBe(true);
  });
});
