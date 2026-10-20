/**
 * Regression: the blunder confirmation dialog repeated the same tutor reason
 * once per threatened piece and then claimed "Kein konkretes taktisches Motiv
 * erkannt" although it had just listed tactical motifs — a self-contradicting
 * dialog. Reasons are now de-duplicated and the "no motif" line only appears
 * when there is nothing else to say.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { showBlunderWarning, buildTutorSummary } from '../../js/tutor/MoveAnalyzer.js';

const PAWN_XRAY = '🌟 Bauer deckt Abzugsangriff auf! Gegner droht durch Wegzug.';

function mountModal() {
  document.body.innerHTML = `
    <div id="generic-modal" class="modal-overlay hidden">
      <div class="modal-content">
        <h2 id="modal-title"></h2>
        <div id="modal-message"></div>
        <div id="modal-actions"></div>
      </div>
    </div>`;
}

function makeAnalysis(over: Record<string, unknown> = {}) {
  return {
    move: { from: { r: 4, c: 4 }, to: { r: 4, c: 6 } },
    score: 0,
    category: 'mistake',
    qualityLabel: '? Fehler (3.0 Bauern schlechter)',
    summary: '',
    tacticalExplanations: [] as string[],
    strategicExplanations: [] as string[],
    warnings: [] as string[],
    tacticalPatterns: [],
    strategicValue: [],
    questions: [],
    scoreDiff: -300,
    notation: 'e4-e6',
    ...over,
  };
}

function messageText(): string {
  return document.getElementById('modal-message')?.textContent ?? '';
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('showBlunderWarning — reason rendering', () => {
  beforeEach(mountModal);

  test('lists an identical warning only once', () => {
    showBlunderWarning(
      {} as never,
      makeAnalysis({
        warnings: [
          'Dieser Zug verschlechtert deine Stellung spürbar.',
          PAWN_XRAY,
          PAWN_XRAY,
          PAWN_XRAY,
        ],
      }) as never,
      () => {}
    );

    expect(countOccurrences(messageText(), PAWN_XRAY)).toBe(1);
  });

  test('does not claim "no tactical motif" while tactical motifs are listed', () => {
    showBlunderWarning(
      {} as never,
      makeAnalysis({
        warnings: ['Dieser Zug verschlechtert deine Stellung spürbar.', PAWN_XRAY],
      }) as never,
      () => {}
    );

    expect(messageText()).not.toContain('Kein konkretes taktisches Motiv erkannt');
    expect(messageText()).toContain('Möchtest du diesen Zug wirklich ausführen?');
    // the verdict itself must still be named
    expect(messageText()).toContain('3.0 Bauern');
  });

  test('still says "no tactical motif" when there is no reason at all', () => {
    showBlunderWarning(
      {} as never,
      makeAnalysis({ warnings: [], tacticalExplanations: [] }) as never,
      () => {}
    );

    expect(messageText()).toContain('Kein konkretes taktisches Motiv erkannt');
  });

  test('lists an identical tactical explanation only once', () => {
    showBlunderWarning(
      {} as never,
      makeAnalysis({
        warnings: ['Dieser Zug verschlechtert deine Stellung spürbar.'],
        tacticalExplanations: [PAWN_XRAY, PAWN_XRAY],
      }) as never,
      () => {}
    );

    expect(countOccurrences(messageText(), PAWN_XRAY)).toBe(1);
  });
});

describe('buildTutorSummary — de-duplication', () => {
  test('never repeats a reason', () => {
    const summary = buildTutorSummary(
      makeAnalysis({
        warnings: [PAWN_XRAY, PAWN_XRAY, 'Dieser Zug verschlechtert deine Stellung spürbar.'],
      }) as never
    );

    expect(summary).toContain(PAWN_XRAY);
    expect(countOccurrences(summary, PAWN_XRAY)).toBe(1);
  });
});
