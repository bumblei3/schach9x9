import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildTutorSummary,
  analyzeMoveWithExplanation,
  showTutorMoveFeedback,
  checkBlunder,
  findBetterAlternative,
} from '../../js/tutor/MoveAnalyzer.js';
import { PHASES } from '../../js/gameEngine.js';
import { setupJSDOM } from '../test-utils.js';

vi.mock('../../js/tutor/TacticsDetector.js', () => ({
  detectThreatsAfterMove: vi.fn().mockReturnValue([
    { piece: { type: 'n', color: 'white' }, pos: { r: 4, c: 4 }, warning: 'Springer hängt ungedeckt!' },
  ]),
  isTactical: vi.fn().mockReturnValue(false),
  detectTacticalPatterns: vi.fn().mockReturnValue([
    {
      type: 'fork',
      severity: 'high',
      explanation: '🍴 Gabelangriff! Bedroht: Dame und König',
      question: 'Siehst du die Gabel?',
      targets: [],
    },
  ]),
}));

vi.mock('../../js/ui.js', () => ({
  showToast: vi.fn(),
  showModal: vi.fn(),
  getPieceText: vi.fn(() => '♞'),
  showMoveQuality: vi.fn(),
}));

vi.mock('../../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn().mockResolvedValue(0),
  getTopMoves: vi.fn().mockResolvedValue([
    {
      move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
      score: 120,
      depth: 2,
      nodes: 10,
    },
  ]),
}));

import { showToast, showMoveQuality } from '../../js/ui.js';
import { getTopMoves } from '../../js/aiEngine.js';

describe('Tutor explanations', () => {
  beforeEach(() => {
    setupJSDOM();
    document.body.innerHTML = '<div id="game-panel"></div>';
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildTutorSummary prefers tactics then warnings', () => {
    const summary = buildTutorSummary({
      move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
      score: 0,
      category: 'mistake',
      qualityLabel: '? Fehler',
      tacticalExplanations: ['🍴 Gabelangriff! Bedroht: Dame und König'],
      strategicExplanations: ['🏰 Besetzt das Zentrum'],
      warnings: ['Springer hängt ungedeckt!'],
      tacticalPatterns: [],
      strategicValue: [],
      questions: [],
      scoreDiff: -250,
      notation: 'Springer nach e5',
    });
    expect(summary).toContain('Gabel');
    expect(summary).toContain('hängt');
  });

  it('buildTutorSummary falls back by category', () => {
    expect(
      buildTutorSummary({
        move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
        score: 0,
        category: 'best',
        qualityLabel: 'Bester Zug',
        tacticalExplanations: [],
        strategicExplanations: [],
        warnings: [],
        tacticalPatterns: [],
        strategicValue: [],
        questions: [],
        scoreDiff: 0,
        notation: 'e4',
      })
    ).toMatch(/Engine|stärkst/i);
  });

  it('analyzeMoveWithExplanation includes summary field', () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = { type: 'n', color: 'white' };
    const game = {
      board,
      phase: PHASES.PLAY,
      isInCheck: () => false,
    } as any;

    const analysis = analyzeMoveWithExplanation(
      game,
      { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
      -50,
      100
    );
    expect(analysis.summary).toBeTruthy();
    expect(analysis.category).toBeTruthy();
    expect(analysis.tacticalExplanations.length).toBeGreaterThan(0);
  });

  it('showTutorMoveFeedback shows toast and panel', () => {
    const analysis = analyzeMoveWithExplanation(
      {
        board: Array.from({ length: 9 }, () => Array(9).fill(null)),
        isInCheck: () => false,
      } as any,
      { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
      0,
      0
    );
    showTutorMoveFeedback(analysis);
    expect(showToast).toHaveBeenCalled();
    const panel = document.getElementById('tutor-feedback');
    expect(panel).toBeTruthy();
    expect(panel?.hidden).toBe(false);
    expect(panel?.textContent).toBeTruthy();
  });

  it('checkBlunder shows feedback for human white move', async () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[3][3] = { type: 'p', color: 'white' };
    const game = {
      board,
      phase: PHASES.PLAY,
      mode: 'classic',
      isAI: true,
      lastEval: 0,
      stats: { accuracies: [] },
      bestMoves: [],
      kiMentorEnabled: false,
      isInCheck: () => false,
    } as any;

    const tutorController = { showBlunderWarning: vi.fn() };
    await checkBlunder(game, tutorController, {
      from: { r: 4, c: 3 },
      to: { r: 3, c: 3 },
      piece: { type: 'p', color: 'white' },
      evalScore: -50,
    });

    expect(showMoveQuality).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
    expect(game.stats.accuracies.length).toBe(1);
    expect(tutorController.showBlunderWarning).not.toHaveBeenCalled(); // mentor off / drop < 300
  });

  it('checkBlunder skips AI black moves in solo', async () => {
    const game = {
      board: Array.from({ length: 9 }, () => Array(9).fill(null)),
      phase: PHASES.PLAY,
      isAI: true,
      lastEval: 0,
      stats: { accuracies: [] },
      isInCheck: () => false,
    } as any;
    await checkBlunder(game, { showBlunderWarning: vi.fn() }, {
      from: { r: 1, c: 0 },
      to: { r: 2, c: 0 },
      piece: { type: 'p', color: 'black' },
      evalScore: 0,
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('findBetterAlternative reverses board, searches, restores', async () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    const piece = { type: 'n', color: 'white' };
    board[4][4] = piece; // after move: knight on e5
    const game = { board, isInCheck: () => false } as any;

    const better = await findBetterAlternative(
      game,
      { from: { r: 6, c: 3 }, to: { r: 4, c: 4 } },
      'white',
      null
    );

    expect(getTopMoves).toHaveBeenCalled();
    expect(better).toBeTruthy();
    expect(better?.from).toEqual({ r: 6, c: 4 });
    // Board restored
    expect(board[4][4]).toBe(piece);
    expect(board[6][3]).toBeNull();
  });

  it('checkBlunder attaches betterMove on large drop and draws highlight', async () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[3][3] = { type: 'p', color: 'white' };
    document.body.innerHTML = `
      <div id="game-panel"></div>
      <div class="cell" data-r="6" data-c="4"></div>
      <div class="cell" data-r="4" data-c="4"></div>
    `;
    const game = {
      board,
      phase: PHASES.PLAY,
      mode: 'classic',
      isAI: true,
      lastEval: 200,
      stats: { accuracies: [] },
      bestMoves: [],
      kiMentorEnabled: false,
      isInCheck: () => false,
    } as any;

    await checkBlunder(game, { showBlunderWarning: vi.fn() }, {
      from: { r: 4, c: 3 },
      to: { r: 3, c: 3 },
      piece: { type: 'p', color: 'white' },
      evalScore: -100, // big drop from 200
      captured: null,
    });

    expect(showToast).toHaveBeenCalled();
    const toastArg = vi.mocked(showToast).mock.calls[0][0] as string;
    // better move suggestion may appear in toast
    expect(toastArg.length).toBeGreaterThan(5);
    expect(document.querySelector('.cell.better-move-from, .cell.better-move-to')).toBeTruthy();
  });
});


