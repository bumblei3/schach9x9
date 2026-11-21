/**
 * `showTutorSuggestions` ohne DOM muss ein No-op sein.
 *
 * Befund (intermittierend, `Errors 1 error` bei sonst 3318 grünen Tests):
 * `ReferenceError: document is not defined` in `TutorUI.showTutorSuggestions`,
 * ausgeloest ueber den 300-ms-Debounce in `TutorController`. Node 26 legt einen
 * globalen `navigator` ab, `document` ist nach dem jsdom-Abriss weg — der Timer
 * feuert noch, die Promise-Rejection blieb ungefangen und vitest zaehlt sie als
 * Unhandled Error, ohne dass ein Test rot wird.
 *
 * Der Guard ist die Verlaengerung des Musters aus
 * `MoveAnalyzer.clearBetterMoveHighlights`.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { showTutorSuggestions } from '../../js/ui/TutorUI.js';

describe('TutorUI ohne DOM', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('showTutorSuggestions ist ohne document ein No-op', async () => {
    vi.stubGlobal('document', undefined);
    await expect(showTutorSuggestions({} as never)).resolves.toBeUndefined();
  });

  test('der Debounce-Pfad wirft nicht, wenn jsdom bereits abgerissen ist', async () => {
    vi.stubGlobal('document', undefined);
    const { TutorController } = await import('../../js/tutorController.js');
    const controller = new TutorController({} as never);
    expect(() => controller.debouncedGetTutorHints()).not.toThrow();
  });
});
